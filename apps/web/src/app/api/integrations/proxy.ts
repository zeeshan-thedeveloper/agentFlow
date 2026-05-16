import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const API_BASE = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function proxyIntegrationRequest(req: NextRequest, path: string[] = []) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const upstreamUrl = new URL(`/integrations/${path.join('/')}`, API_BASE);
  upstreamUrl.search = req.nextUrl.search;

  const body = req.method !== 'GET' && req.method !== 'DELETE' ? await req.text() : undefined;
  const headers = new Headers();
  const contentType = req.headers.get('content-type');
  const cookie = req.headers.get('cookie');
  const authorization = req.headers.get('authorization');

  if (contentType) headers.set('Content-Type', contentType);
  if (cookie) headers.set('cookie', cookie);
  if (authorization) headers.set('authorization', authorization);
  headers.set('x-user-id', userId);

  const upstream = await fetch(upstreamUrl, {
    method: req.method,
    headers,
    body,
  });

  const data = await upstream.text();
  return new NextResponse(data, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
    },
  });
}
