import type { NodeHandler } from './base.handler';

/** A Files node does no work itself; it tells the agent it is wired into where to save files and who to notify. */
export class FilesHandler implements NodeHandler {
  async execute(params: Record<string, unknown>): Promise<unknown> {
    return {
      integrationId: String(params.integrationId ?? ''),
      folder: String(params.folder ?? ''),
      notifySlackChannel: typeof params.notifySlackChannel === 'string' ? params.notifySlackChannel : '',
      notifyTelegramChatId: typeof params.notifyTelegramChatId === 'string' ? params.notifyTelegramChatId : '',
    };
  }
}
