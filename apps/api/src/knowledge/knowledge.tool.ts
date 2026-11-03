import type OpenAI from 'openai';
import type { Tool, ToolDefinition } from '../handlers/tools/base.tool';
import { searchKnowledge } from './knowledge.store';
import { embed } from './knowledge.text';
import { ingestDocument, requireDocumentTitle } from './knowledge.ingest';

const DEFAULT_RESULTS = 5;
const MAX_RESULTS = 10;
// Agents write notes and summaries, not whole books; large documents go in from the canvas.
const MAX_AGENT_DOCUMENT_CHARS = 50_000;

/** A knowledge base wired into an agent, ready to be searched. */
export interface AgentKnowledgeBase {
  /** Name the model uses to pick a knowledge base. */
  name: string;
  integrationId: string;
  knowledgeBase: string;
  connectionString: string;
  /** The node allows the agent to add documents. */
  allowWrite: boolean;
}

/** search_knowledge for every wired knowledge base, and add_to_knowledge for those that allow writes. */
export function createKnowledgeTools(client: OpenAI, bases: AgentKnowledgeBase[]): Tool[] {
  const writable = bases.filter(base => base.allowWrite);
  return [createSearchTool(client, bases), ...(writable.length > 0 ? [createAddTool(client, writable)] : [])];
}

function createAddTool(client: OpenAI, bases: AgentKnowledgeBase[]): Tool {
  const byName = new Map(bases.map(base => [base.name, base]));
  const several = bases.length > 1;

  return {
    definition: {
      name: 'add_to_knowledge',
      description:
        `Save a document to ${several ? 'a connected knowledge base' : 'the connected knowledge base'} so it can be found by ` +
        'search_knowledge later, in this run or future ones. Use it for facts, notes, answers or summaries worth keeping. ' +
        'A document with the same title is replaced, so reuse a title to update it.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'A short, specific document title, e.g. "Refund policy" or "Customer 1042 notes".' },
          text: { type: 'string', description: `The document text, at most ${MAX_AGENT_DOCUMENT_CHARS.toLocaleString('en-US')} characters.` },
          ...(several
            ? { knowledge_base: { type: 'string', enum: [...byName.keys()], description: 'Which knowledge base to save to.' } }
            : {}),
        },
        required: several ? ['title', 'text', 'knowledge_base'] : ['title', 'text'],
      },
    },
    async run(args) {
      const base = several ? byName.get(String(args.knowledge_base ?? '')) : bases[0];
      if (!base) throw new Error(`Unknown knowledge base. Choose one of: ${[...byName.keys()].join(', ')}.`);
      const title = requireDocumentTitle(args.title);
      if (typeof args.text !== 'string') throw new Error('The "text" argument must be a string.');
      const chunks = await ingestDocument(client, base.connectionString, base.knowledgeBase, title, args.text, MAX_AGENT_DOCUMENT_CHARS);
      return JSON.stringify({ saved: { title, knowledgeBase: base.name, chunks } });
    },
  };
}

function createSearchTool(client: OpenAI, bases: AgentKnowledgeBase[]): Tool {
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
