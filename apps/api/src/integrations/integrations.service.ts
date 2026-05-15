import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createCipheriv, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { integrationRegistry } from './integration.registry';
import { testConnection } from './providers/database/database.connection';
import { maskConnectionString } from './providers/database/database.sanitizer';

function encryptCredential(plaintext: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = cipher.update(plaintext, 'utf8', 'hex') + cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

@Injectable()
export class IntegrationsService {
  constructor(private readonly prisma: PrismaService) {}

  getAll() {
    return integrationRegistry
      .getAll()
      .map(({ id, name, description, authType, credentialLabel, actions }) => ({
        id,
        name,
        description,
        authType,
        credentialLabel,
        actions,
      }));
  }

  async getCredentialStatus(userId: string, integrationId: string) {
    const record = await this.prisma.userIntegrationCredential.findUnique({
      where: { userId_integrationId: { userId, integrationId } },
      select: { maskedHint: true },
    });

    return { connected: !!record, maskedHint: record?.maskedHint ?? null };
  }

  async listDatabaseConnections(userId: string) {
    const records = await this.prisma.userIntegrationCredential.findMany({
      where: {
        userId,
        integrationId: { startsWith: 'database' },
      },
      select: { integrationId: true, name: true, maskedHint: true, updatedAt: true },
      orderBy: { createdAt: 'asc' },
    });

    return records.map((record) => ({
      integrationId: record.integrationId,
      name: record.name ?? record.integrationId,
      maskedHint: record.maskedHint,
      updatedAt: record.updatedAt,
    }));
  }

  async saveCredential(userId: string, integrationId: string, connectionString: string, name?: string) {
    const maskedHint = maskConnectionString(connectionString);
    const encryptedData = encryptCredential(JSON.stringify({ connectionString }));

    await this.prisma.userIntegrationCredential.upsert({
      where: { userId_integrationId: { userId, integrationId } },
      update: { encryptedData, maskedHint, authType: 'connection_string', name: name ?? null },
      create: {
        userId,
        integrationId,
        name: name ?? null,
        authType: 'connection_string',
        encryptedData,
        maskedHint,
      },
    });

    return { ok: true, maskedHint };
  }

  async deleteCredential(userId: string, integrationId: string) {
    const existing = await this.prisma.userIntegrationCredential.findUnique({
      where: { userId_integrationId: { userId, integrationId } },
    });

    if (!existing) {
      throw new NotFoundException(`No credential found for "${integrationId}".`);
    }

    await this.prisma.userIntegrationCredential.delete({
      where: { userId_integrationId: { userId, integrationId } },
    });

    return { ok: true };
  }

  async testDatabaseConnection(connectionString: string) {
    try {
      const version = await testConnection(connectionString);
      return { ok: true, serverVersion: version };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`Connection failed: ${message}`);
    }
  }
}
