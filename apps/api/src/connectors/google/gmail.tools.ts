import type { Tool } from '../../handlers/tools/base.tool';
import { googleError, type GoogleSession } from './google.client';

const API = 'https://gmail.googleapis.com/gmail/v1/users/me';
const MAX_SEARCH_RESULTS = 20;
const MAX_BODY_CHARS = 15_000;

type Header = { name: string; value: string };
type MessagePart = {
  mimeType?: string;
  headers?: Header[];
  body?: { data?: string; size?: number };
  parts?: MessagePart[];
  filename?: string;
};
type GmailMessage = {
  id: string;
  threadId: string;
  snippet?: string;
  labelIds?: string[];
  payload?: MessagePart;
};

function header(message: GmailMessage, name: string): string {
  return message.payload?.headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

function decode(data: string): string {
  return Buffer.from(data, 'base64url').toString('utf8');
}

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** The readable text of a message: its text/plain part, or its HTML part stripped of tags. */
function bodyText(part: MessagePart | undefined): string {
  if (!part) return '';
  const plain: string[] = [];
  const html: string[] = [];
  const walk = (p: MessagePart) => {
    if (p.mimeType === 'text/plain' && p.body?.data && !p.filename) plain.push(decode(p.body.data));
    else if (p.mimeType === 'text/html' && p.body?.data && !p.filename) html.push(decode(p.body.data));
    p.parts?.forEach(walk);
  };
  walk(part);
  return plain.length > 0 ? plain.join('\n') : stripHtml(html.join('\n'));
}

function attachments(part: MessagePart | undefined): string[] {
  const names: string[] = [];
  const walk = (p: MessagePart) => {
    if (p.filename) names.push(p.filename);
    p.parts?.forEach(walk);
  };
  if (part) walk(part);
  return names;
}

/** "=?UTF-8?B?...?=" so non-ASCII subjects survive. */
function encodeHeader(value: string): string {
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

export function createGmailTools(session: GoogleSession, allowSend: boolean): Tool[] {
  const search: Tool = {
    definition: {
      name: 'gmail_search',
      description:
        `Search the connected Gmail inbox (${session.email}) with Gmail search syntax, e.g. "from:alice is:unread newer_than:7d". ` +
        'Returns message ids with sender, subject, date and a snippet.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Gmail search query.' },
          max_results: { type: 'number', description: `How many messages to return, up to ${MAX_SEARCH_RESULTS}. Default 10.` },
        },
        required: ['query'],
      },
    },
    async run(args) {
      const query = String(args.query ?? '');
      const max = Math.min(Math.max(Number(args.max_results) || 10, 1), MAX_SEARCH_RESULTS);
      const list = await session.json<{ messages?: { id: string }[] }>(
        `${API}/messages?${new URLSearchParams({ q: query, maxResults: String(max) })}`,
      );
      if (!list.messages?.length) return 'No messages match that search.';

      const messages = await Promise.all(
        list.messages.map(({ id }) =>
          session.json<GmailMessage>(
            `${API}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          ),
        ),
      );
      return JSON.stringify(
        messages.map(message => ({
          id: message.id,
          threadId: message.threadId,
          from: header(message, 'From'),
          subject: header(message, 'Subject'),
          date: header(message, 'Date'),
          unread: message.labelIds?.includes('UNREAD') ?? false,
          snippet: message.snippet,
        })),
        null,
        2,
      );
    },
  };

  const read: Tool = {
    definition: {
      name: 'gmail_read',
      description: 'Read one Gmail message in full by its id (from gmail_search).',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: 'The message id.' } },
        required: ['id'],
      },
    },
    async run(args) {
      const id = encodeURIComponent(String(args.id ?? ''));
      const message = await session.json<GmailMessage>(`${API}/messages/${id}?format=full`);
      let body = bodyText(message.payload);
      if (body.length > MAX_BODY_CHARS) body = `${body.slice(0, MAX_BODY_CHARS)}\n...[truncated]`;
      const files = attachments(message.payload);
      return [
        `From: ${header(message, 'From')}`,
        `To: ${header(message, 'To')}`,
        `Date: ${header(message, 'Date')}`,
        `Subject: ${header(message, 'Subject')}`,
        `Thread id: ${message.threadId}`,
        ...(files.length > 0 ? [`Attachments: ${files.join(', ')}`] : []),
        '',
        body || '(no text body)',
      ].join('\n');
    },
  };

  const send: Tool = {
    definition: {
      name: 'gmail_send',
      description: `Send a plain-text email from ${session.email}. Pass thread_id to reply inside an existing thread.`,
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Recipient address, or several separated by commas.' },
          subject: { type: 'string' },
          body: { type: 'string', description: 'Plain-text body.' },
          thread_id: { type: 'string', description: 'Optional thread id to reply in.' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
    async run(args) {
      const to = singleLine(String(args.to ?? ''));
      const subject = singleLine(String(args.subject ?? ''));
      if (!to) throw new Error('A recipient is required.');

      const raw = [
        `To: ${to}`,
        `Subject: ${encodeHeader(subject)}`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset="UTF-8"',
        'Content-Transfer-Encoding: base64',
        '',
        Buffer.from(String(args.body ?? ''), 'utf8').toString('base64'),
      ].join('\r\n');

      const response = await session.fetch(`${API}/messages/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw: Buffer.from(raw, 'utf8').toString('base64url'),
          ...(args.thread_id ? { threadId: String(args.thread_id) } : {}),
        }),
      });
      if (!response.ok) throw new Error(await googleError(response));
      const sent = (await response.json()) as { id: string };
      return `Email sent to ${to} (message id ${sent.id}).`;
    },
  };

  return allowSend ? [search, read, send] : [search, read];
}
