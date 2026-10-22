import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { signRunToken } from '@/server/runToken';

export const dynamic = 'force-dynamic';

type RouteContext = { params: { id: string } };

/** Issues a run token for one of the signed-in user's workflows. */
export async function POST(_request: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workflow = await prisma.workflow.findFirst({ where: { id: params.id, userId }, select: { id: true } });
  if (!workflow) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });

  // Without a secret (local development) the API lets requests through, so no token is needed.
  return NextResponse.json({ token: signRunToken(userId, workflow.id) });
}
