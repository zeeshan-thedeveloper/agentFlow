import { Injectable } from '@nestjs/common';
import { createDecipheriv } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { ResolvedCredentials } from './integration.interfaces';

function decryptCredential(encrypted: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
  const [ivHex, authTagHex, ciphertext] = encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext, 'hex', 'utf8') + decipher.final('utf8');
}

@Injectable()
export class CredentialResolver {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(userId: string, integrationId: string): Promise<ResolvedCredentials> {
    const record = await this.prisma.userIntegrationCredential.findUnique({
      where: { userId_integrationId: { userId, integrationId } },
    });

    if (!record) {
      throw new Error(
        `No credentials found for "${integrationId}". Connect it in the canvas config panel first.`,
      );
    }

    const data = JSON.parse(decryptCredential(record.encryptedData)) as ResolvedCredentials;
    return data;
  }
}
