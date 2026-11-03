import type { ConnectorStore } from './connector.store';
import { slackApi } from './slack/slack.client';
import { sendTelegramMessage } from './telegram/telegram.client';

/** A photo or document sent with a chat message; downloaded later with the bot token. */
export interface ChatAttachment {
  /** Telegram's file_id, or Slack's private download URL. */
  ref: string;
  name: string;
  mimeType: string;
  size: number;
}

/** The chat message that started a run. Set only by the webhook endpoints, never by a client. */
export type TriggerEvent =
  | {
      source: 'slack';
      channel: string;
      /** The message's ts; replies go into its thread. */
      ts: string;
      threadTs?: string;
      user: string;
      text: string;
      /** Files shared with the message. */
      attachments?: ChatAttachment[];
    }
  | {
      source: 'telegram';
      chatId: number;
      messageId: number;
      from: string;
      text: string;
      /** Photos and documents sent with the message. */
      attachments?: ChatAttachment[];
    };

export function isTriggerEvent(value: unknown): value is TriggerEvent {
  const source = (value as { source?: unknown } | null)?.source;
  return source === 'slack' || source === 'telegram';
}

/** One line telling an agent where the message it is handling came from. */
export function describeTriggerEvent(event: TriggerEvent): string {
  const files = event.attachments?.length
    ? `, with ${event.attachments.length} attached file(s): ${event.attachments.map(file => file.name).join(', ')}.`
    : '.';
  return event.source === 'slack'
    ? `This run was started by a Slack message from user ${event.user} in channel ${event.channel} ` +
        `(message ts ${event.ts}${event.threadTs ? `, thread ${event.threadTs}` : ''})${files}`
    : `This run was started by a Telegram message from ${event.from} in chat ${event.chatId}${files}`;
}

/** Sends `text` back to the chat the trigger message came from, as a reply to it. */
export async function replyToTrigger(store: ConnectorStore, userId: string, event: TriggerEvent, text: string): Promise<void> {
  if (event.source === 'slack') {
    const { data } = await store.require(userId, 'slack');
    await slackApi(data.botToken, 'chat.postMessage', {
      channel: event.channel,
      text,
      // In a DM a threaded reply would hide the answer, so only channel messages get one.
      ...(event.channel.startsWith('D') && !event.threadTs ? {} : { thread_ts: event.threadTs ?? event.ts }),
    });
  } else {
    const { data } = await store.require(userId, 'telegram');
    await sendTelegramMessage(data.botToken, event.chatId, text, event.messageId);
  }
}
