import { NextRequest } from 'next/server';
import { proxyIntegrationRequest } from './proxy';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return proxyIntegrationRequest(req);
}
