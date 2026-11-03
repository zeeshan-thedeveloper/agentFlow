import { NextRequest } from 'next/server';
import { proxyApiRequest } from '../../integrations/proxy';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    path: string[];
  };
};

export async function GET(req: NextRequest, { params }: RouteContext) {
  return proxyApiRequest(req, `/knowledge/${params.path.join('/')}`);
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  return proxyApiRequest(req, `/knowledge/${params.path.join('/')}`);
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  return proxyApiRequest(req, `/knowledge/${params.path.join('/')}`);
}
