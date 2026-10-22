import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * The API trusts the user id in x-user-id, so only the web app may call it.
 * Every request must carry one of:
 * - x-internal-secret: the INTERNAL_API_SECRET shared with the web app, which
 *   adds it when forwarding a signed-in user's request; or
 * - a run token (Authorization: Bearer ...): signed by the web app for one
 *   user and one workflow, so the browser can start a long run directly.
 * Slack and Telegram webhooks (/hooks/...) are exempt; they check their own signatures.
 */

type GuardedRequest = {
  method?: string;
  path?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  userId?: string;
};

const RUN_PATH = /^\/workflows\/([^/]+)\/run\/?$/;

function header(req: GuardedRequest, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function sameString(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** The user a run token was issued to, if it is valid for this workflow and unexpired. Mirrors the web app's signer. */
export function verifyRunToken(token: string, workflowId: string, secret: string): string | null {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  if (!sameString(expected, signature)) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { u?: unknown; w?: unknown; exp?: unknown };
    if (claims.w !== workflowId || typeof claims.u !== 'string' || typeof claims.exp !== 'number') return null;
    return claims.exp > Date.now() ? claims.u : null;
  } catch {
    return null;
  }
}

@Injectable()
export class InternalAuthGuard implements CanActivate {
  private readonly logger = new Logger(InternalAuthGuard.name);
  private warned = false;

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<GuardedRequest>();
    const path = (req.path ?? req.url ?? '').split('?')[0];
    if (path.startsWith('/hooks/')) return true;

    const secret = process.env.INTERNAL_API_SECRET;
    if (!secret || secret.length < 32) {
      if (process.env.NODE_ENV !== 'production') {
        if (!this.warned) this.logger.warn('INTERNAL_API_SECRET is not set; allowing all requests outside production.');
        this.warned = true;
        return true;
      }
      this.logger.error('INTERNAL_API_SECRET is not set (at least 32 characters); refusing requests.');
      throw new UnauthorizedException('API is not configured.');
    }

    const internal = header(req, 'x-internal-secret');
    if (internal && sameString(internal, secret)) return true;

    const runMatch = req.method === 'POST' ? RUN_PATH.exec(path) : null;
    const bearer = header(req, 'authorization')?.replace(/^Bearer\s+/i, '');
    if (runMatch && bearer) {
      const userId = verifyRunToken(bearer, decodeURIComponent(runMatch[1]), secret);
      if (userId) {
        // The token decides who the user is; a client-sent x-user-id never does.
        delete req.headers['x-user-id'];
        req.userId = userId;
        return true;
      }
    }

    throw new UnauthorizedException('Authentication required.');
  }
}
