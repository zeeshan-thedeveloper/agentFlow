import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encryptApiKey, maskApiKey } from '@/server/apiKeyCrypto';

export const dynamic = 'force-dynamic';

const OPENAI_MODELS = [
  { id: 'gpt-4.1', label: 'GPT-4.1' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
  { id: 'gpt-4o', label: 'GPT-4o' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
];

async function getUserId() {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

async function findOpenAICredential(userId: string) {
  const rows = await prisma.$queryRaw<Array<{ maskedKey: string; updatedAt: Date }>>`
    SELECT "maskedKey", "updatedAt"
    FROM "user_api_keys"
    WHERE "userId" = ${userId} AND "provider" = 'OPENAI'::"ApiProvider"
    LIMIT 1
  `;

  return rows[0] ?? null;
}

function serializeCredential(credential: { maskedKey: string; updatedAt: Date } | null) {
  return {
    provider: 'openai',
    configured: Boolean(credential),
    maskedKey: credential?.maskedKey ?? null,
    updatedAt: credential?.updatedAt.toISOString() ?? null,
    models: OPENAI_MODELS,
  };
}

export async function GET() {
  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const credential = await findOpenAICredential(userId);

  return NextResponse.json(serializeCredential(credential));
}

export async function PUT(request: Request) {
  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { apiKey?: unknown } | null;
  const apiKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : '';

  if (!apiKey || !apiKey.startsWith('sk-') || apiKey.length < 20) {
    return NextResponse.json({ error: 'Enter a valid OpenAI API key.' }, { status: 400 });
  }

  const encryptedKey = encryptApiKey(apiKey);
  const maskedKey = maskApiKey(apiKey);
  const id = `apikey_${randomUUID().replaceAll('-', '')}`;
  await prisma.$executeRaw`
    INSERT INTO "user_api_keys" ("id", "userId", "provider", "encryptedKey", "maskedKey", "createdAt", "updatedAt")
    VALUES (${id}, ${userId}, 'OPENAI'::"ApiProvider", ${encryptedKey}, ${maskedKey}, NOW(), NOW())
    ON CONFLICT ("userId", "provider")
    DO UPDATE SET "encryptedKey" = ${encryptedKey}, "maskedKey" = ${maskedKey}, "updatedAt" = NOW()
  `;

  const credential = await findOpenAICredential(userId);

  return NextResponse.json(serializeCredential(credential));
}

export async function DELETE() {
  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await prisma.$executeRaw`
    DELETE FROM "user_api_keys"
    WHERE "userId" = ${userId} AND "provider" = 'OPENAI'::"ApiProvider"
  `;

  return NextResponse.json(serializeCredential(null));
}
