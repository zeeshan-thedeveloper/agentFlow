import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { decryptCredential } from './credential.crypto';
import type { ResolvedCredentials } from './integration.interfaces';

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
