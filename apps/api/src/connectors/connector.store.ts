import type { PrismaService } from '../prisma/prisma.service';
import { decryptCredential, encryptCredential } from '../integrations/credential.crypto';

/**
 * Each user can connect one account per provider. Google covers Gmail and
 * Drive. Credentials live in user_integration_credentials like database
 * connections, under the provider name as integrationId.
 */
export type ConnectorProvider = 'google' | 'slack' | 'telegram' | 'github';
export const CONNECTOR_PROVIDERS: ConnectorProvider[] = ['google', 'slack', 'telegram', 'github'];

/** The apps a canvas connector node can stand for. */
export type ConnectorKind = 'gmail' | 'drive' | 'slack' | 'telegram' | 'github';

export const PROVIDER_OF: Record<ConnectorKind, ConnectorProvider> = {
  gmail: 'google',
  drive: 'google',
  slack: 'slack',
  telegram: 'telegram',
  github: 'github',
};

export const PROVIDER_LABELS: Record<ConnectorProvider, string> = {
  google: 'Google',
  slack: 'Slack',
  telegram: 'Telegram',
  github: 'GitHub',
};

export interface GoogleCredential {
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds. */
  expiresAt: number;
  email: string;
  scopes: string[];
}

export interface SlackCredential {
  botToken: string;
  signingSecret: string;
  teamName: string;
  botUserId: string;
}

export interface TelegramCredential {
  botToken: string;
  botUsername: string;
  /** Sent back by Telegram in X-Telegram-Bot-Api-Secret-Token on every update. */
  webhookSecret: string;
}

export interface GitHubCredential {
  /** A fine-grained personal access token; the repos it covers are chosen on GitHub. */
  token: string;
  login: string;
}

export interface CredentialData {
  google: GoogleCredential;
  slack: SlackCredential;
  telegram: TelegramCredential;
  github: GitHubCredential;
}

export interface StoredConnector<P extends ConnectorProvider> {
  /** Row id; used in webhook URLs so an incoming event maps to one connection. */
  id: string;
  userId: string;
  name: string | null;
  data: CredentialData[P];
}

export class ConnectorStore {
  constructor(private readonly prisma: PrismaService) {}

  async get<P extends ConnectorProvider>(userId: string, provider: P): Promise<StoredConnector<P> | null> {
    const record = await this.prisma.userIntegrationCredential.findUnique({
      where: { userId_integrationId: { userId, integrationId: provider } },
    });
    return record ? this.decode<P>(record) : null;
  }

  async require<P extends ConnectorProvider>(userId: string, provider: P): Promise<StoredConnector<P>> {
    const connector = await this.get(userId, provider);
    if (!connector) {
      throw new Error(`${PROVIDER_LABELS[provider]} is not connected. Connect it from the node's settings first.`);
    }
    return connector;
  }

  async findById<P extends ConnectorProvider>(id: string, provider: P): Promise<StoredConnector<P> | null> {
    const record = await this.prisma.userIntegrationCredential.findUnique({ where: { id } });
    if (!record || record.integrationId !== provider) return null;
    return this.decode<P>(record);
  }

  async save<P extends ConnectorProvider>(
    userId: string,
    provider: P,
    data: CredentialData[P],
    name: string,
  ): Promise<StoredConnector<P>> {
    const encryptedData = encryptCredential(JSON.stringify(data));
    const record = await this.prisma.userIntegrationCredential.upsert({
      where: { userId_integrationId: { userId, integrationId: provider } },
      update: { encryptedData, name, maskedHint: name },
      create: { userId, integrationId: provider, authType: 'connector', encryptedData, name, maskedHint: name },
    });
    return { id: record.id, userId, name, data };
  }

  /** Replaces the stored data of an existing connection, e.g. after an OAuth token refresh. */
  async update<P extends ConnectorProvider>(id: string, data: CredentialData[P]): Promise<void> {
    await this.prisma.userIntegrationCredential.update({
      where: { id },
      data: { encryptedData: encryptCredential(JSON.stringify(data)) },
    });
  }

  async delete(userId: string, provider: ConnectorProvider): Promise<void> {
    await this.prisma.userIntegrationCredential.deleteMany({ where: { userId, integrationId: provider } });
  }

  async list(userId: string) {
    const records = await this.prisma.userIntegrationCredential.findMany({
      where: { userId, integrationId: { in: CONNECTOR_PROVIDERS } },
      select: { id: true, integrationId: true, name: true },
    });
    return records;
  }

  private decode<P extends ConnectorProvider>(record: {
    id: string;
    userId: string;
    name: string | null;
    encryptedData: string;
  }): StoredConnector<P> {
    return {
      id: record.id,
      userId: record.userId,
      name: record.name,
      data: JSON.parse(decryptCredential(record.encryptedData)) as CredentialData[P],
    };
  }
}
