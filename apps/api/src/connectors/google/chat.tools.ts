import type { Tool } from '../../handlers/tools/base.tool';
import { GOOGLE_CHAT_SCOPES, type GoogleSession } from './google.client';

const API = 'https://chat.googleapis.com/v1';
const MAX_MESSAGES = 50;
const MAX_RESULT_CHARS = 20_000;

type Space = { name: string; displayName?: string; spaceType?: string };
type Message = {
  name: string;
  text?: string;
  createTime?: string;
  sender?: { name?: string; displayName?: string; type?: string };
  thread?: { name?: string };
};

/** Read-only access to the Google Chat spaces the connected account is in. */
export function createChatTools(session: GoogleSession): Tool[] {
  const assertScope = () => {
    if (!GOOGLE_CHAT_SCOPES.every(scope => session.hasScope(scope))) {
      throw new Error('Google Chat access was not granted. Reconnect Google with "Include Google Chat" ticked.');
    }
  };

  const listSpaces: Tool = {
    definition: {
      name: 'gchat_list_spaces',
      description: `List the Google Chat spaces, group chats and direct messages ${session.email} is in.`,
      parameters: { type: 'object', properties: {} },
    },
    async run() {
      assertScope();
      const result = await session.json<{ spaces?: Space[] }>(`${API}/spaces?pageSize=100`);
      if (!result.spaces?.length) return 'No Google Chat spaces found.';
      return JSON.stringify(
        result.spaces.map(space => ({ space: space.name, name: space.displayName || '(direct message)', type: space.spaceType })),
        null,
        2,
      );
    },
  };

  const readMessages: Tool = {
    definition: {
      name: 'gchat_read_messages',
      description: 'Read the most recent messages in a Google Chat space, newest first.',
      parameters: {
        type: 'object',
        properties: {
          space: { type: 'string', description: 'The space id from gchat_list_spaces, e.g. "spaces/AAAA1234".' },
          max_results: { type: 'number', description: `Up to ${MAX_MESSAGES}. Default 20.` },
          since: { type: 'string', description: 'Optional ISO date-time; only messages after it.' },
        },
        required: ['space'],
      },
    },
    async run(args) {
      assertScope();
      const space = String(args.space ?? '');
      if (!/^spaces\/[\w-]+$/.test(space)) throw new Error('space must look like "spaces/AAAA1234".');
      const max = Math.min(Math.max(Number(args.max_results) || 20, 1), MAX_MESSAGES);
      const since = typeof args.since === 'string' && !Number.isNaN(Date.parse(args.since))
        ? new Date(args.since).toISOString()
        : null;

      const result = await session.json<{ messages?: Message[] }>(
        `${API}/${space}/messages?${new URLSearchParams({
          pageSize: String(max),
          orderBy: 'createTime desc',
          ...(since ? { filter: `createTime > "${since}"` } : {}),
        })}`,
      );
      if (!result.messages?.length) return 'No messages in that space for that time.';

      const text = JSON.stringify(
        result.messages.map(message => ({
          time: message.createTime,
          sender: message.sender?.displayName || message.sender?.name,
          thread: message.thread?.name,
          text: message.text,
        })),
        null,
        2,
      );
      return text.length > MAX_RESULT_CHARS ? `${text.slice(0, MAX_RESULT_CHARS)}\n...[truncated]` : text;
    },
  };

  return [listSpaces, readMessages];
}
