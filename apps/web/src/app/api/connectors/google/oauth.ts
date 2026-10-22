import type { NextRequest } from 'next/server';

export const STATE_COOKIE = 'agentflow_google_connect_state';

/** Where Google sends the user back; this exact URL must be listed on the OAuth client in Google Cloud. */
export function googleRedirectUri(req: NextRequest): string {
  const origin = process.env.NEXTAUTH_URL?.replace(/\/+$/, '') ?? req.nextUrl.origin;
  return `${origin}/api/connectors/google/callback`;
}

/** Back to the canvas, with the outcome in the query so the page can say what happened. */
export function canvasUrl(req: NextRequest, outcome: Record<string, string>): URL {
  const origin = process.env.NEXTAUTH_URL?.replace(/\/+$/, '') ?? req.nextUrl.origin;
  const url = new URL('/canvas', origin);
  for (const [key, value] of Object.entries(outcome)) url.searchParams.set(key, value);
  return url;
}
