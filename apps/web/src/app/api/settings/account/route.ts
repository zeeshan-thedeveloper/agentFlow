import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

async function getUserId() {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

function serializeUser(user: {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function GET() {
  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, image: true, createdAt: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json(serializeUser(user));
}

export async function PATCH(request: Request) {
  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  const name = typeof body?.name === 'string' ? body.name.trim() : '';

  if (!name || name.length > 120) {
    return NextResponse.json({ error: 'Enter a display name (1–120 characters).' }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { name },
    select: { id: true, name: true, email: true, image: true, createdAt: true },
  });

  return NextResponse.json(serializeUser(user));
}

export async function DELETE() {
  const userId = await getUserId();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await prisma.user.delete({ where: { id: userId } });

  return NextResponse.json({ deleted: true });
}
