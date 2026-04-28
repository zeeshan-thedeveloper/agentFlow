import { prisma } from '@/lib/prisma';
import { decryptApiKey } from './apiKeyCrypto';

export async function getOpenAIApiKeyForUser(userId: string) {
  const rows = await prisma.$queryRaw<Array<{ encryptedKey: string }>>`
    SELECT "encryptedKey"
    FROM "user_api_keys"
    WHERE "userId" = ${userId} AND "provider" = 'OPENAI'::"ApiProvider"
    LIMIT 1
  `;

  return rows[0] ? decryptApiKey(rows[0].encryptedKey) : null;
}
