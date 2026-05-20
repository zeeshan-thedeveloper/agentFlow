import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createCipheriv, createHash, randomBytes } from 'crypto';
import { MongoClient } from 'mongodb';
import { Client } from 'pg';
import { PrismaService } from '../prisma/prisma.service';
import { CredentialResolver } from './credential.resolver';
import type { SchemaConfig } from './integration.interfaces';
import { integrationRegistry } from './integration.registry';
import { testConnection } from './providers/database/database.connection';
import { maskConnectionString } from './providers/database/database.sanitizer';

function getEncryptionKey() {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET ?? process.env.NEXTAUTH_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error('API_KEY_ENCRYPTION_SECRET must be set to at least 32 characters.');
  }

  return createHash('sha256').update(secret).digest();
}

function encryptCredential(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = cipher.update(plaintext, 'utf8', 'hex') + cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentialResolver: CredentialResolver,
  ) {}

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

  async testDatabaseConnection(connectionString: string, engine?: string) {
    try {
      if (engine === 'mongodb' || connectionString.startsWith('mongodb')) {
        const { testMongoConnection } = await import('./providers/database/mongo.connection');
        const version = await testMongoConnection(connectionString);
        return { ok: true, serverVersion: version };
      }

      const version = await testConnection(connectionString);
      return { ok: true, serverVersion: version };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`Connection failed: ${message}`);
    }
  }

  async fetchDatabaseSchema(userId: string, integrationId: string): Promise<string[]> {
    const credentials = await this.credentialResolver.resolve(userId, integrationId);
    const connectionString = credentials.connectionString as string;

    const isMongo = integrationId.includes('mongo');

    if (isMongo) {
      const client = new MongoClient(connectionString, { serverSelectionTimeoutMS: 5000 });
      try {
        await client.connect();
        const db = client.db();
        const collections = await db.listCollections().toArray();
        return collections.map((c) => c.name).sort();
      } finally {
        await client.close();
      }
    } else {
      const client = new Client({ connectionString, connectionTimeoutMillis: 5000 });
      try {
        await client.connect();
        const { rows } = await client.query<{ table_name: string }>(
          `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_type = 'BASE TABLE'
         ORDER BY table_name`,
        );
        return rows.map((r) => r.table_name);
      } finally {
        await client.end();
      }
    }
  }

  async getSchemaConfig(userId: string, integrationId: string): Promise<SchemaConfig | null> {
    const row = await this.prisma.databaseSchemaConfig.findUnique({
      where: { userId_integrationId: { userId, integrationId } },
    });
    if (!row) return null;
    return row.config as unknown as SchemaConfig;
  }

  async saveSchemaConfig(
    userId: string,
    integrationId: string,
    config: SchemaConfig,
  ): Promise<void> {
    await this.prisma.databaseSchemaConfig.upsert({
      where: { userId_integrationId: { userId, integrationId } },
      update: { config: config as object },
      create: { userId, integrationId, config: config as object },
    });
  }
}
