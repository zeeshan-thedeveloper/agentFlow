import type OpenAI from 'openai';
import type { Tool, ToolDefinition } from '../handlers/tools/base.tool';
import { searchKnowledge } from './knowledge.store';
import { embed } from './knowledge.text';

const DEFAULT_RESULTS = 5;
const MAX_RESULTS = 10;

/** A knowledge base wired into an agent, ready to be searched. */
export interface AgentKnowledgeBase {
  /** Name the model uses to pick a knowledge base. */
  name: string;
  knowledgeBase: string;
  connectionString: string;
}

export function createKnowledgeTool(client: OpenAI, bases: AgentKnowledgeBase[]): Tool {
  const byName = new Map(bases.map(base => [base.name, base]));
  const several = bases.length > 1;

  const definition: ToolDefinition = {
    name: 'search_knowledge',
    description:
      `Search ${several ? 'a connected knowledge base' : 'the connected knowledge base'} for passages related to a question, ` +
      'by meaning rather than exact words. Returns the closest passages with their document name and a relevance score. ' +
      'Search again with different wording if the first results do not answer the question.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What to look for, as a question or a short description.' },
        limit: { type: 'integer', minimum: 1, maximum: MAX_RESULTS, description: `How many passages to return (default ${DEFAULT_RESULTS}).` },
        ...(several
          ? { knowledge_base: { type: 'string', enum: [...byName.keys()], description: 'Which knowledge base to search.' } }
          : {}),
      },
      required: several ? ['query', 'knowledge_base'] : ['query'],
    },
  };

  return {
    definition,
    async run(args) {
      const base = several ? byName.get(String(args.knowledge_base ?? '')) : bases[0];
      if (!base) throw new Error(`Unknown knowledge base. Choose one of: ${[...byName.keys()].join(', ')}.`);
      if (typeof args.query !== 'string' || !args.query.trim()) throw new Error('The "query" argument must be a non-empty string.');
      const limit = Math.min(MAX_RESULTS, Math.max(1, Math.floor(Number(args.limit) || DEFAULT_RESULTS)));

      const [embedding] = await embed(client, [args.query.trim()]);
      const matches = await searchKnowledge(base.connectionString, base.knowledgeBase, embedding, limit);
      if (matches.length === 0) return JSON.stringify({ matches: [], note: 'The knowledge base has no documents yet.' });
      return JSON.stringify({
        matches: matches.map(match => ({ document: match.document, score: Number(match.score.toFixed(3)), content: match.content })),
      });
    },
  };
}
