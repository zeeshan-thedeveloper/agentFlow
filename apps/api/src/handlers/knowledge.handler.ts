import type { NodeHandler } from './base.handler';

/** A Knowledge node does no work itself; it tells the agent it is wired into which knowledge base to search. */
export class KnowledgeHandler implements NodeHandler {
  async execute(params: Record<string, unknown>): Promise<unknown> {
    return {
      integrationId: String(params.integrationId ?? ''),
      knowledgeBase: String(params.knowledgeBase ?? ''),
      name: String(params.label ?? ''),
    };
  }
}
