import { createDecipheriv, createHash } from 'crypto';
import OpenAI from 'openai';
import type { PrismaService } from '../prisma/prisma.service';

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey() {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET ?? process.env.NEXTAUTH_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error('API_KEY_ENCRYPTION_SECRET must be set to at least 32 characters.');
  }

  return createHash('sha256').update(secret).digest();
}

function decryptApiKey(encryptedApiKey: string) {
  const [ivValue, tagValue, encryptedValue] = encryptedApiKey.split('.');

  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error('Invalid encrypted API key payload.');
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivValue, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

/** An OpenAI client using the API key the user saved under Keys. */
export async function openAIClientFor(prisma: PrismaService, userId: string): Promise<OpenAI> {
  const apiKey = await prisma.userApiKey.findUnique({
    where: { userId_provider: { userId, provider: 'OPENAI' } },
    select: { encryptedKey: true },
  });

  if (!apiKey) {
    throw new Error('No OpenAI API key configured for workflow owner.');
  }

  return new OpenAI({ apiKey: decryptApiKey(apiKey.encryptedKey) });
}
