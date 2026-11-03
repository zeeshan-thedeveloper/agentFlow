import type { Tool } from '../../handlers/tools/base.tool';

const MAX_MESSAGE_CHARS = 4096;

export async function telegramApi<T>(botToken: string, method: string, body: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = (await response.json().catch(() => ({ ok: false, description: response.statusText }))) as {
    ok: boolean;
    result?: T;
    description?: string;
  };
  if (!result.ok) throw new Error(`Telegram ${method} failed: ${result.description ?? 'unknown error'}`);
  return result.result as T;
}

/** Downloads a file someone sent the bot; Telegram serves files up to 20 MB this way. */
export async function downloadTelegramFile(botToken: string, fileId: string): Promise<Buffer> {
  const { file_path } = await telegramApi<{ file_path?: string }>(botToken, 'getFile', { file_id: fileId });
  if (!file_path) throw new Error('Telegram did not return a download path for the file.');
  const response = await fetch(`https://api.telegram.org/file/bot${botToken}/${file_path}`);
  if (!response.ok) throw new Error(`Telegram file download failed with ${response.status}.`);
  return Buffer.from(await response.arrayBuffer());
}

/** Sends text, split into Telegram's 4096-character limit. */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string | number,
  text: string,
  replyToMessageId?: number,
): Promise<void> {
  const chunks: string[] = [];
  for (let i = 0; i < Math.max(text.length, 1); i += MAX_MESSAGE_CHARS) chunks.push(text.slice(i, i + MAX_MESSAGE_CHARS));
  for (const [index, chunk] of chunks.entries()) {
    await telegramApi(botToken, 'sendMessage', {
      chat_id: chatId,
      text: chunk || '(empty reply)',
      ...(index === 0 && replyToMessageId ? { reply_parameters: { message_id: replyToMessageId, allow_sending_without_reply: true } } : {}),
    });
  }
}

export function createTelegramTools(botToken: string, botUsername: string): Tool[] {
  const send: Tool = {
    definition: {
      name: 'telegram_send_message',
      description:
        `Send a Telegram message as @${botUsername}. chat_id must be a chat that has messaged the bot ` +
        '(or a group/channel the bot was added to); bots cannot start conversations with people.',
      parameters: {
        type: 'object',
        properties: {
          chat_id: { type: 'string', description: 'Numeric chat id, or @channelusername for a channel.' },
          text: { type: 'string' },
        },
        required: ['chat_id', 'text'],
      },
    },
    async run(args) {
      await sendTelegramMessage(botToken, String(args.chat_id ?? ''), String(args.text ?? ''));
      return `Sent to chat ${String(args.chat_id)}.`;
    },
  };
  return [send];
}
