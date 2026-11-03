import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Inject, NotFoundException, Post, Query, Req, Res } from '@nestjs/common';
import { ConnectorStore } from '../connectors/connector.store';
import { encryptCredential } from '../integrations/credential.crypto';
import { CredentialResolver } from '../integrations/credential.resolver';
import { requireUserId, type AuthenticatedRequest } from '../integrations/integrations.controller';
import { PrismaService } from '../prisma/prisma.service';
import { fileNotifySettings, notifyFileAdded } from './file-notify';
import {
  MAX_FILE_BYTES,
  STORAGE_PREFIX,
  deleteFile,
  getFile,
  listFiles,
  requireFileName,
  requireFolderName,
  requireStorageCredential,
  saveFile,
  storageCredential,
  testStorage,
} from './files.store';

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

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Storage connections, and the files in a Files node's folder. */
@Controller('files')
export class FilesController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CredentialResolver) private readonly resolver: CredentialResolver,
    @Inject(ConnectorStore) private readonly store: ConnectorStore,
  ) {}

  @Get('storages')
  async listStorages(@Req() req: AuthenticatedRequest) {
    const records = await this.prisma.userIntegrationCredential.findMany({
      where: { userId: requireUserId(req), integrationId: { startsWith: `${STORAGE_PREFIX}:` } },
      select: { integrationId: true, name: true, maskedHint: true },
      orderBy: { createdAt: 'asc' },
    });
    return records.map(record => ({ integrationId: record.integrationId, name: record.name ?? record.integrationId, maskedHint: record.maskedHint }));
  }

  /** Checks the credentials can reach the bucket, then saves them encrypted. */
  @Post('storages')
  @HttpCode(200)
  saveStorage(@Body() body: Record<string, unknown>, @Req() req: AuthenticatedRequest) {
    const userId = requireUserId(req);
    return orBadRequest(async () => {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!slugify(name)) throw new Error('Give the storage a name.');
      const storage = requireStorageCredential(body);
      await testStorage(storage);

      const integrationId = `${STORAGE_PREFIX}:${slugify(name)}`;
      const maskedHint = `${storage.bucket} · ${new URL(storage.endpoint).hostname}`;
      const encryptedData = encryptCredential(JSON.stringify(storage));
      await this.prisma.userIntegrationCredential.upsert({
        where: { userId_integrationId: { userId, integrationId } },
        update: { encryptedData, maskedHint, name, authType: 's3' },
        create: { userId, integrationId, name, authType: 's3', encryptedData, maskedHint },
      });
      return { integrationId, name, maskedHint };
    });
  }

  @Delete('storages')
  @HttpCode(200)
  async deleteStorage(@Query('integrationId') integrationId: string, @Req() req: AuthenticatedRequest) {
    const userId = requireUserId(req);
    if (typeof integrationId !== 'string' || !integrationId.startsWith(`${STORAGE_PREFIX}:`)) {
      throw new BadRequestException('Unknown storage.');
    }
    // Only the saved credentials are removed; the files stay in the bucket.
    await this.prisma.userIntegrationCredential.deleteMany({ where: { userId, integrationId } });
    return { ok: true };
  }

  @Get()
  list(@Query('integrationId') integrationId: string, @Query('folder') folder: string, @Req() req: AuthenticatedRequest) {
    const userId = requireUserId(req);
    return orBadRequest(async () => {
      const storage = await storageCredential(this.resolver, userId, integrationId);
      return { files: await listFiles(storage, requireFolderName(folder)) };
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
      const storage = await storageCredential(this.resolver, userId, body.integrationId);
      const saved = await saveFile(storage, {
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
      const storage = await storageCredential(this.resolver, userId, integrationId);
      const found = await getFile(storage, String(id ?? ''));
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
      const storage = await storageCredential(this.resolver, userId, integrationId);
      await deleteFile(storage, String(id ?? ''));
      return { ok: true };
    });
  }
}
