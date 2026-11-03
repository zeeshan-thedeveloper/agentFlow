import { NextRequest } from 'next/server';
import { proxyApiRequest } from '../../integrations/proxy';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return proxyApiRequest(req, '/files/storages');
}

export async function POST(req: NextRequest) {
  return proxyApiRequest(req, '/files/storages');
}

export async function DELETE(req: NextRequest) {
  return proxyApiRequest(req, '/files/storages');
}
