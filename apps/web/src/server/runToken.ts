import { createHmac } from 'crypto';

const RUN_TOKEN_TTL_MS = 2 * 60 * 1000;

/**
 * A short-lived pass that lets the browser start one workflow run straight on
 * the API, since runs can outlast a proxied request. The API checks it with
 * the same INTERNAL_API_SECRET (see apps/api/src/auth/internal-auth.guard.ts).
 */
export function signRunToken(userId: string, workflowId: string): string | null {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return null;
  const payload = Buffer.from(JSON.stringify({ u: userId, w: workflowId, exp: Date.now() + RUN_TOKEN_TTL_MS })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}
