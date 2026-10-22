import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { API_BASE, internalApiHeaders } from '../../../integrations/proxy';
import { STATE_COOKIE, canvasUrl, googleRedirectUri } from '../oauth';

export const dynamic = 'force-dynamic';

// Sends the user to Google's consent screen. ?chat=1 also asks for Google Chat access.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.redirect(new URL('/login', req.nextUrl.origin));

  const state = randomBytes(24).toString('hex');
  const params = new URLSearchParams({
    redirectUri: googleRedirectUri(req),
    state,
    chat: req.nextUrl.searchParams.get('chat') === '1' ? '1' : '0',
  });
  const upstream = await fetch(new URL(`/connectors/google/auth-url?${params}`, API_BASE), {
    headers: internalApiHeaders(userId),
  });
  const body = (await upstream.json().catch(() => null)) as { url?: string; message?: string } | null;
  if (!upstream.ok || !body?.url) {
    return NextResponse.redirect(canvasUrl(req, { connectError: body?.message ?? 'Google is not set up on the server.' }));
  }

  const response = NextResponse.redirect(body.url);
  // The callback only accepts the state it gave out here, so a forged callback can't attach someone else's account.
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: req.nextUrl.protocol === 'https:',
    sameSite: 'lax',
    maxAge: 600,
    path: '/api/connectors/google',
  });
  return response;
}
