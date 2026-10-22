import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { API_BASE, internalApiHeaders } from '../../../integrations/proxy';
import { STATE_COOKIE, canvasUrl, googleRedirectUri } from '../oauth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.redirect(new URL('/login', req.nextUrl.origin));

  const params = req.nextUrl.searchParams;
  const expectedState = req.cookies.get(STATE_COOKIE)?.value;
  const finish = (outcome: Record<string, string>) => {
    const response = NextResponse.redirect(canvasUrl(req, outcome));
    response.cookies.delete({ name: STATE_COOKIE, path: '/api/connectors/google' });
    return response;
  };

  if (params.get('error')) return finish({ connectError: `Google: ${params.get('error')}` });
  const code = params.get('code');
  if (!code || !expectedState || params.get('state') !== expectedState) {
    return finish({ connectError: 'Google sign-in expired or did not match. Try connecting again.' });
  }

  const upstream = await fetch(new URL('/connectors/google', API_BASE), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...internalApiHeaders(userId) },
    body: JSON.stringify({ code, redirectUri: googleRedirectUri(req) }),
  });
  if (!upstream.ok) {
    const body = (await upstream.json().catch(() => null)) as { message?: string } | null;
    return finish({ connectError: body?.message ?? 'Could not connect Google.' });
  }
  return finish({ connected: 'google' });
}
