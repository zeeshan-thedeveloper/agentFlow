import { createDecipheriv, createHash } from 'crypto';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import type { NodeHandler } from './base.handler';

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

export class AgentHandler implements NodeHandler {
  constructor(private readonly prisma = new PrismaClient()) {}

  async execute(params: Record<string, unknown>, input: unknown): Promise<unknown> {
    // The executor injects the workflow owner id into params before dispatch.
    const userId = params.userId ?? params.workflowOwnerId;
    const model = params.model ?? 'gpt-4o-mini';
    const prompt = params.prompt;

    if (typeof userId !== 'string' || !userId) {
      throw new Error('Agent node requires workflow owner userId.');
    }

    if (typeof model !== 'string' || !model) {
      throw new Error('Agent node model must be a non-empty string.');
    }

    if (typeof prompt !== 'string' || !prompt) {
      throw new Error('Agent node prompt must be a non-empty string.');
    }

    // API keys stay encrypted at rest and are decrypted only for the API call.
    const apiKey = await this.prisma.userApiKey.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: 'OPENAI',
        },
      },
      select: {
        encryptedKey: true,
      },
    });

    if (!apiKey) {
      throw new Error('No OpenAI API key configured for workflow owner.');
    }

    const client = new OpenAI({
      apiKey: decryptApiKey(apiKey.encryptedKey),
    });

    // Treat the node prompt as the instruction and prior node output as user data.
    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: prompt,
        },
        {
          role: 'user',
          content: typeof input === 'string' ? input : JSON.stringify(input ?? ''),
        },
      ],
    });

    return completion.choices[0]?.message?.content ?? '';
  }
}
