import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { API_BASE, internalApiHeaders } from '../../integrations/proxy';

export const dynamic = 'force-dynamic';

// The JSON proxy reads bodies as text, which would corrupt a PDF, so downloads pass the bytes straight through.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const upstreamUrl = new URL('/files/download', API_BASE);
  upstreamUrl.search = req.nextUrl.search;
  const upstream = await fetch(upstreamUrl, { headers: internalApiHeaders(userId) });

  const headers = new Headers({ 'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream' });
  for (const name of ['content-disposition', 'x-content-type-options']) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
