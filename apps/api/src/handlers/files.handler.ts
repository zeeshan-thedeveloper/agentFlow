import type { NodeHandler } from './base.handler';
import type { ConnectorStore } from '../connectors/connector.store';
import { downloadSlackFile } from '../connectors/slack/slack.client';
import { downloadTelegramFile } from '../connectors/telegram/telegram.client';
import { isTriggerEvent } from '../connectors/trigger-event';
import type { CredentialResolver } from '../integrations/credential.resolver';
import { MAX_FILE_BYTES, requireFileName, requireFolderName, saveFile, storageCredential } from '../files/files.store';

/**
 * A Files node tells the agent it is wired into where to save files and who to
 * notify. When a Slack or Telegram message with photos or documents started the run, it
 * also saves those files to the folder first, so the agent can read them.
 */
export class FilesHandler implements NodeHandler {
  constructor(
    private readonly credentialResolver?: CredentialResolver,
    private readonly connectorStore?: ConnectorStore,
  ) {}

  async execute(params: Record<string, unknown>): Promise<unknown> {
    const ref = {
      integrationId: String(params.integrationId ?? ''),
      folder: String(params.folder ?? ''),
      notifySlackChannel: typeof params.notifySlackChannel === 'string' ? params.notifySlackChannel : '',
      notifyTelegramChatId: typeof params.notifyTelegramChatId === 'string' ? params.notifyTelegramChatId : '',
    };
    const event = params.triggerEvent;
    if (!isTriggerEvent(event) || !event.attachments?.length) return ref;
    if (!this.credentialResolver || !this.connectorStore || typeof params.userId !== 'string') return ref;

    const storage = await storageCredential(this.credentialResolver, params.userId, ref.integrationId);
    const folder = requireFolderName(ref.folder);
    const download =
      event.source === 'slack'
        ? await this.connectorStore.require(params.userId, 'slack').then(({ data }) => (ref: string) => downloadSlackFile(data.botToken, ref))
        : await this.connectorStore.require(params.userId, 'telegram').then(({ data }) => (ref: string) => downloadTelegramFile(data.botToken, ref));

    // One line per file for the agent: where it was saved, or why it wasn't.
    const received: string[] = [];
    for (const attachment of event.attachments) {
      try {
        if (attachment.size > MAX_FILE_BYTES) throw new Error(`it is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB`);
        const data = await download(attachment.ref);
        if (data.length > MAX_FILE_BYTES) throw new Error(`it is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB`);
        const name = requireFileName(attachment.name.replace(/[/\\\u0000-\u001f]/g, '_'));
        await saveFile(storage, { folder, name, contentType: attachment.mimeType, data, source: 'upload' });
        received.push(`saved "${name}"`);
      } catch (error) {
        received.push(`could not save "${attachment.name}": ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return { ...ref, received };
  }
}
