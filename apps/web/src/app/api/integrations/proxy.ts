import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function proxyIntegrationRequest(req: NextRequest, path: string[] = []) {
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
