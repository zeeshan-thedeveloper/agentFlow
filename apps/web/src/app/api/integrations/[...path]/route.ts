import { NextRequest } from 'next/server';
import { proxyIntegrationRequest } from '../proxy';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    path: string[];
  };
};

export async function GET(req: NextRequest, { params }: RouteContext) {
  return proxyIntegrationRequest(req, params.path);
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  return proxyIntegrationRequest(req, params.path);
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  return proxyIntegrationRequest(req, params.path);
}
