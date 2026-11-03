import { Logger } from '@nestjs/common';
import type { ConnectorStore } from '../connectors/connector.store';
import { slackApi } from '../connectors/slack/slack.client';
import { sendTelegramMessage } from '../connectors/telegram/telegram.client';
import type { StoredFileInfo } from './files.store';

const logger = new Logger('FileNotify');

/** Where a Files node tells you about new files. Empty means don't notify there. */
export interface FileNotifySettings {
  slackChannel?: string;
  telegramChatId?: string;
}

export function fileNotifySettings(value: { notifySlackChannel?: unknown; notifyTelegramChatId?: unknown }): FileNotifySettings {
  const clean = (field: unknown) => (typeof field === 'string' && field.trim() ? field.trim() : undefined);
  return { slackChannel: clean(value.notifySlackChannel), telegramChatId: clean(value.notifyTelegramChatId) };
}

const formatSize = (bytes: number) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`);

function caption(file: StoredFileInfo, source: 'agent' | 'upload'): string {
  return `${source === 'agent' ? 'An agent created' : 'New file added:'} ${file.name} (${formatSize(file.size)}) in folder "${file.folder}".`;
}

/** Slack's external upload: get an upload URL, send the bytes, then share the file in the channel. */
async function uploadToSlack(botToken: string, channel: string, file: StoredFileInfo, data: Buffer, comment: string) {
  const form = async <T>(method: string, params: Record<string, string>) => {
    const response = await fetch(`https://slack.com/api/${method}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${botToken}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params),
    });
    const result = (await response.json()) as T & { ok: boolean; error?: string };
    if (!result.ok) throw new Error(result.error ?? 'unknown error');
    return result;
  };

  const { upload_url, file_id } = await form<{ upload_url: string; file_id: string }>('files.getUploadURLExternal', {
    filename: file.name,
    length: String(data.length),
  });
  const upload = await fetch(upload_url, { method: 'POST', body: data });
  if (!upload.ok) throw new Error(`upload failed with ${upload.status}`);
  await form('files.completeUploadExternal', {
    files: JSON.stringify([{ id: file_id, title: file.name }]),
    channel_id: channel,
    initial_comment: comment,
  });
}

async function sendTelegramDocument(botToken: string, chatId: string, file: StoredFileInfo, data: Buffer, comment: string) {
  const body = new FormData();
  body.set('chat_id', chatId);
  body.set('caption', comment.slice(0, 1024));
  body.set('document', new Blob([data], { type: file.contentType }), file.name);
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, { method: 'POST', body });
  const result = (await response.json().catch(() => ({ ok: false, description: response.statusText }))) as { ok: boolean; description?: string };
  if (!result.ok) throw new Error(result.description ?? 'unknown error');
}

/**
 * Tells the user about a new file on Slack and/or Telegram, with the file
 * attached where the app allows it. Returns a line per destination; failures
 * are reported, not thrown, so a notification problem never loses the file.
 */
export async function notifyFileAdded(
  store: ConnectorStore,
  userId: string,
  settings: FileNotifySettings,
  file: StoredFileInfo,
  data: Buffer,
  source: 'agent' | 'upload',
): Promise<string[]> {
  const comment = caption(file, source);
  const results: string[] = [];

  if (settings.slackChannel) {
    const channel = settings.slackChannel;
    try {
      const { data: slack } = await store.require(userId, 'slack');
      try {
        await uploadToSlack(slack.botToken, channel, file, data, comment);
        results.push(`Shared on Slack in ${channel}.`);
      } catch (error) {
        // Apps set up before files:write was in the manifest can still post a message.
        const reason = error instanceof Error ? error.message : String(error);
        await slackApi(slack.botToken, 'chat.postMessage', {
          channel,
          text: `${comment}${reason === 'missing_scope' ? ' (Add the files:write scope to the Slack app to get the file attached.)' : ''}`,
        });
        results.push(`Notified on Slack in ${channel} (file not attached: ${reason}).`);
      }
    } catch (error) {
      results.push(`Slack notification failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (settings.telegramChatId) {
    const chatId = settings.telegramChatId;
    try {
      const { data: telegram } = await store.require(userId, 'telegram');
      try {
        await sendTelegramDocument(telegram.botToken, chatId, file, data, comment);
        results.push(`Sent on Telegram to chat ${chatId}.`);
      } catch (error) {
        await sendTelegramMessage(telegram.botToken, chatId, comment);
        results.push(`Notified on Telegram (file not attached: ${error instanceof Error ? error.message : String(error)}).`);
      }
    } catch (error) {
      results.push(`Telegram notification failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  for (const line of results) logger.log(line);
  return results;
}
