import { NextRequest } from 'next/server';
import { proxyApiRequest } from '../../integrations/proxy';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    path: string[];
  };
};

const upstream = (params: RouteContext['params']) => `/connectors/${params.path.map(encodeURIComponent).join('/')}`;

export async function GET(req: NextRequest, { params }: RouteContext) {
  return proxyApiRequest(req, upstream(params));
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  return proxyApiRequest(req, upstream(params));
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  return proxyApiRequest(req, upstream(params));
}
