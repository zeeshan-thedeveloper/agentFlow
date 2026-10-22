import { NextRequest } from 'next/server';
import { proxyApiRequest } from '../../../integrations/proxy';

export const dynamic = 'force-dynamic';

type RouteContext = { params: { id: string } };

export async function GET(req: NextRequest, { params }: RouteContext) {
  return proxyApiRequest(req, `/workflows/${encodeURIComponent(params.id)}/runs`);
}
