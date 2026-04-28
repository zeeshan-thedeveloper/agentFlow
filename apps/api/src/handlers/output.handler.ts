import type { NodeHandler } from './base.handler';

export class OutputHandler implements NodeHandler {
  async execute(_params: Record<string, unknown>, input: unknown): Promise<unknown> {
    return input;
  }
}
