import type { NodeHandler } from './base.handler';

export class DatabaseHandler implements NodeHandler {
  async execute(params: Record<string, unknown>, _input: unknown): Promise<unknown> {
    return String(params.integrationId ?? '');
  }
}
