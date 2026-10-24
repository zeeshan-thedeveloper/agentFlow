import type { Tool } from '../../handlers/tools/base.tool';
import { GMAIL_SEND_SCOPE, googleError, type GoogleSession } from './google.client';

// AgentFlow only sends email; it never reads the mailbox.
const API = 'https://gmail.googleapis.com/gmail/v1/users/me';

/** "=?UTF-8?B?...?=" so non-ASCII subjects survive. */
function encodeHeader(value: string): string {
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

/** Sends one plain-text email from the connected account; returns Gmail's message id. */
export async function sendGmail(
  session: GoogleSession,
  message: { to: string; subject: string; body: string; threadId?: string },
): Promise<string> {
  const raw = [
    `To: ${singleLine(message.to)}`,
    `Subject: ${encodeHeader(singleLine(message.subject))}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(message.body, 'utf8').toString('base64'),
  ].join('\r\n');

  const response = await session.fetch(`${API}/messages/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      raw: Buffer.from(raw, 'utf8').toString('base64url'),
      ...(message.threadId ? { threadId: message.threadId } : {}),
    }),
  });
  if (!response.ok) throw new Error(await googleError(response));
  return ((await response.json()) as { id: string }).id;
}

/** The send tool, when the node allows sending and Google granted gmail.send. */
export function createGmailTools(session: GoogleSession, allowSend: boolean): Tool[] {
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

      const id = await sendGmail(session, {
        to,
        subject,
        body: String(args.body ?? ''),
        ...(args.thread_id ? { threadId: String(args.thread_id) } : {}),
      });
      return `Email sent to ${to} (message id ${id}).`;
    },
  };

  return allowSend && session.hasScope(GMAIL_SEND_SCOPE) ? [send] : [];
}
