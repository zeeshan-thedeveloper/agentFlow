import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const API_BASE = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/**
 * Headers that let the API trust a request: who the signed-in user is, and the
 * secret only this server knows. The browser never sees the secret.
 */
export function internalApiHeaders(userId: string): Record<string, string> {
  return {
    'x-user-id': userId,
    ...(process.env.INTERNAL_API_SECRET ? { 'x-internal-secret': process.env.INTERNAL_API_SECRET } : {}),
  };
}

export async function proxyIntegrationRequest(req: NextRequest, path: string[] = []) {
  return proxyApiRequest(req, `/integrations/${path.join('/')}`);
}

/** Forwards a signed-in user's request to the API, telling it who the user is. */
export async function proxyApiRequest(req: NextRequest, upstreamPath: string) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const upstreamUrl = new URL(upstreamPath, API_BASE);
  upstreamUrl.search = req.nextUrl.search;

  const body = req.method !== 'GET' && req.method !== 'DELETE' ? await req.text() : undefined;
  const headers = new Headers();
  const contentType = req.headers.get('content-type');

  if (contentType) headers.set('Content-Type', contentType);
  for (const [name, value] of Object.entries(internalApiHeaders(userId))) headers.set(name, value);

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
