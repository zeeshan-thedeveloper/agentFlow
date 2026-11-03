import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Inject, NotFoundException, Post, Query, Req, Res } from '@nestjs/common';
import { ConnectorStore } from '../connectors/connector.store';
import { CredentialResolver } from '../integrations/credential.resolver';
import { requireUserId, type AuthenticatedRequest } from '../integrations/integrations.controller';
import { fileNotifySettings, notifyFileAdded } from './file-notify';
import { MAX_FILE_BYTES, deleteFile, filesConnectionString, getFile, listFiles, requireFileName, requireFolderName, saveFile } from './files.store';

/** The parts of Express's response the download uses. */
type DownloadResponse = { setHeader(name: string, value: string): void; send(body: Buffer): void };

async function orBadRequest<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof NotFoundException) throw error;
    throw new BadRequestException(error instanceof Error ? error.message : String(error));
  }
}

/** Listing, adding, downloading and removing the files in a Files node's folder. */
@Controller('files')
export class FilesController {
  constructor(
    @Inject(CredentialResolver) private readonly resolver: CredentialResolver,
    @Inject(ConnectorStore) private readonly store: ConnectorStore,
  ) {}

  @Get()
  list(@Query('integrationId') integrationId: string, @Query('folder') folder: string, @Req() req: AuthenticatedRequest) {
    const userId = requireUserId(req);
    return orBadRequest(async () => {
      const connectionString = await filesConnectionString(this.resolver, userId, integrationId);
      return { files: await listFiles(connectionString, requireFolderName(folder)) };
    });
  }

  /** Adds a file from the canvas (sent as base64) and sends the node's notifications. */
  @Post()
  @HttpCode(200)
  upload(
    @Body()
    body: {
      integrationId?: string;
      folder?: string;
      name?: string;
      contentType?: string;
      contentBase64?: string;
      notifySlackChannel?: string;
      notifyTelegramChatId?: string;
    },
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = requireUserId(req);
    return orBadRequest(async () => {
      const data = Buffer.from(typeof body.contentBase64 === 'string' ? body.contentBase64 : '', 'base64');
      if (data.length === 0) throw new Error('The file is empty.');
      if (data.length > MAX_FILE_BYTES) throw new Error(`Files can be at most ${MAX_FILE_BYTES / 1024 / 1024} MB.`);
      const connectionString = await filesConnectionString(this.resolver, userId, body.integrationId);
      const saved = await saveFile(connectionString, {
        folder: requireFolderName(body.folder),
        name: requireFileName(body.name),
        contentType: typeof body.contentType === 'string' && body.contentType ? body.contentType : 'application/octet-stream',
        data,
        source: 'upload',
      });
      const notifications = await notifyFileAdded(this.store, userId, fileNotifySettings(body), saved, data, 'upload');
      return { file: saved, notifications };
    });
  }

  @Get('download')
  async download(
    @Query('integrationId') integrationId: string,
    @Query('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: DownloadResponse,
  ) {
    const userId = requireUserId(req);
    const file = await orBadRequest(async () => {
      const connectionString = await filesConnectionString(this.resolver, userId, integrationId);
      const found = await getFile(connectionString, String(id ?? ''));
      if (!found) throw new NotFoundException('File not found.');
      return found;
    });
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(file.data);
  }

  @Delete()
  @HttpCode(200)
  remove(@Query('integrationId') integrationId: string, @Query('id') id: string, @Req() req: AuthenticatedRequest) {
    const userId = requireUserId(req);
    return orBadRequest(async () => {
      const connectionString = await filesConnectionString(this.resolver, userId, integrationId);
      await deleteFile(connectionString, String(id ?? ''));
      return { ok: true };
    });
  }
}
