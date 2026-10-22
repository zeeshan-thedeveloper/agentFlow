import { createHmac, timingSafeEqual } from 'crypto';
import type { Tool } from '../../handlers/tools/base.tool';

const MAX_REQUEST_AGE_S = 5 * 60;
const MAX_HISTORY = 100;

export async function slackApi<T extends Record<string, unknown>>(
  botToken: string,
  method: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${botToken}`, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  const result = (await response.json().catch(() => ({ ok: false, error: response.statusText }))) as T & {
    ok: boolean;
    error?: string;
  };
  if (!result.ok) throw new Error(`Slack ${method} failed: ${result.error ?? 'unknown error'}`);
  return result;
}

/** Checks Slack's request signature, so only Slack can start a workflow through the webhook. */
export function verifySlackSignature(
  signingSecret: string,
  timestamp: string | undefined,
  signature: string | undefined,
  rawBody: Buffer,
): boolean {
  if (!timestamp || !signature) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > MAX_REQUEST_AGE_S) return false;

  const expected = `v0=${createHmac('sha256', signingSecret).update(`v0:${timestamp}:${rawBody.toString('utf8')}`).digest('hex')}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Who the bot token belongs to; also proves the token works. */
export async function slackIdentity(botToken: string) {
  const result = await slackApi<{ team?: string; user_id?: string }>(botToken, 'auth.test');
  return { teamName: result.team ?? 'Slack workspace', botUserId: result.user_id ?? '' };
}

export function createSlackTools(botToken: string, teamName: string): Tool[] {
  const send: Tool = {
    definition: {
      name: 'slack_send_message',
      description:
        `Post a message to Slack (${teamName}) as the bot. channel is a channel id like C0123 or a user id for a DM; ` +
        'pass thread_ts to reply in a thread. The bot must be a member of the channel.',
      parameters: {
        type: 'object',
        properties: {
          channel: { type: 'string' },
          text: { type: 'string', description: 'Message text; Slack mrkdwn is allowed.' },
          thread_ts: { type: 'string', description: 'Optional timestamp of the message to reply under.' },
        },
        required: ['channel', 'text'],
      },
    },
    async run(args) {
      const result = await slackApi<{ ts?: string; channel?: string }>(botToken, 'chat.postMessage', {
        channel: String(args.channel ?? ''),
        text: String(args.text ?? ''),
        ...(args.thread_ts ? { thread_ts: String(args.thread_ts) } : {}),
      });
      return `Posted to ${result.channel} (ts ${result.ts}).`;
    },
  };

  const listChannels: Tool = {
    definition: {
      name: 'slack_list_channels',
      description: `List the Slack channels in ${teamName} with their ids, and whether the bot is a member.`,
      parameters: { type: 'object', properties: {} },
    },
    async run() {
      const result = await slackApi<{ channels?: { id: string; name: string; is_member?: boolean; is_private?: boolean }[] }>(
        botToken,
        'conversations.list',
        { types: 'public_channel,private_channel', exclude_archived: true, limit: 200 },
      );
      return JSON.stringify(
        (result.channels ?? []).map(c => ({ id: c.id, name: c.name, private: c.is_private, botIsMember: c.is_member })),
        null,
        2,
      );
    },
  };

  const readChannel: Tool = {
    definition: {
      name: 'slack_read_channel',
      description: 'Read recent messages from a Slack channel the bot is in, newest first. Pass thread_ts to read one thread.',
      parameters: {
        type: 'object',
        properties: {
          channel: { type: 'string', description: 'Channel id, e.g. C0123.' },
          thread_ts: { type: 'string', description: 'Optional thread to read instead of the channel.' },
          limit: { type: 'number', description: `Up to ${MAX_HISTORY}. Default 30.` },
        },
        required: ['channel'],
      },
    },
    async run(args) {
      const limit = Math.min(Math.max(Number(args.limit) || 30, 1), MAX_HISTORY);
      const channel = String(args.channel ?? '');
      const result = args.thread_ts
        ? await slackApi<{ messages?: SlackMessage[] }>(botToken, 'conversations.replies', { channel, ts: String(args.thread_ts), limit })
        : await slackApi<{ messages?: SlackMessage[] }>(botToken, 'conversations.history', { channel, limit });
      return JSON.stringify(
        (result.messages ?? []).map(m => ({ ts: m.ts, user: m.user ?? m.bot_id, text: m.text, thread_ts: m.thread_ts })),
        null,
        2,
      );
    },
  };

  return [send, listChannels, readChannel];
}

type SlackMessage = { ts: string; user?: string; bot_id?: string; text?: string; thread_ts?: string };
