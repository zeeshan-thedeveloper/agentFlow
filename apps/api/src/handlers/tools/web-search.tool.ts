import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createDecipheriv, createHash } from 'crypto';
import type { Tool, ToolContext, ToolDefinition } from './base.tool';

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

type SearchProvider = 'brave' | 'serper' | 'tavily';

const noApiKeyError =
  'Error: Web Search requires a Tavily API key. Add one in Settings → Search.';
const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey() {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET ?? process.env.NEXTAUTH_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error('API_KEY_ENCRYPTION_SECRET must be set to at least 32 characters.');
  }

  return createHash('sha256').update(secret).digest();
}

function decryptKey(encryptedApiKey: string) {
  const [ivValue, tagValue, encryptedValue] = encryptedApiKey.split('.');

  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error('Invalid encrypted API key payload.');
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivValue, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(value: Record<string, unknown>, key: string): string {
  const field = value[key];
  return typeof field === 'string' ? field : '';
}

function clampNumResults(value: unknown): number {
  const numericValue = typeof value === 'number' && Number.isFinite(value) ? value : 5;
  return Math.max(1, Math.min(10, Math.floor(numericValue)));
}

function resolveProvider(): { provider: SearchProvider; apiKey: string } | null {
  if (process.env.BRAVE_SEARCH_API_KEY) {
    return { provider: 'brave', apiKey: process.env.BRAVE_SEARCH_API_KEY };
  }

  if (process.env.SERPER_API_KEY) {
    return { provider: 'serper', apiKey: process.env.SERPER_API_KEY };
  }

  if (process.env.TAVILY_API_KEY) {
    return { provider: 'tavily', apiKey: process.env.TAVILY_API_KEY };
  }

  return null;
}

function normalizeBraveResults(body: unknown): SearchResult[] {
  if (!isRecord(body) || !isRecord(body.web) || !Array.isArray(body.web.results)) {
    return [];
  }

  return body.web.results.filter(isRecord).map(result => ({
    title: stringField(result, 'title'),
    url: stringField(result, 'url'),
    snippet: stringField(result, 'description'),
  }));
}

function normalizeSerperResults(body: unknown): SearchResult[] {
  if (!isRecord(body) || !Array.isArray(body.organic)) {
    return [];
  }

  return body.organic.filter(isRecord).map(result => ({
    title: stringField(result, 'title'),
    url: stringField(result, 'link'),
    snippet: stringField(result, 'snippet'),
  }));
}

function normalizeTavilyResults(body: unknown): SearchResult[] {
  if (!isRecord(body) || !Array.isArray(body.results)) {
    return [];
  }

  return body.results.filter(isRecord).map(result => ({
    title: stringField(result, 'title'),
    url: stringField(result, 'url'),
    snippet: stringField(result, 'content'),
  }));
}

function normalizeResults(provider: SearchProvider, body: unknown): SearchResult[] {
  switch (provider) {
    case 'brave':
      return normalizeBraveResults(body);
    case 'serper':
      return normalizeSerperResults(body);
    case 'tavily':
      return normalizeTavilyResults(body);
  }
}

function formatResults(results: SearchResult[]): string {
  if (results.length === 0) {
    return 'No results found.';
  }

  return results
    .map(
      (result, index) =>
        `${index + 1}. ${result.title}\n   URL: ${result.url}\n   Snippet: ${result.snippet}`,
    )
    .join('\n\n');
}

async function fetchJson(url: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    return Promise.reject(new Error(`HTTP ${response.status} ${response.statusText}`.trim()));
  }

  return response.json() as Promise<unknown>;
}

export class WebSearchTool implements Tool {
  private readonly logger = new Logger(WebSearchTool.name);
  private readonly prisma = new PrismaClient();

  definition: ToolDefinition = {
    name: 'web_search',
    description:
      "Search the web and return the top N results (title, URL, and snippet) for a given query. Use this when you need current information or to find URLs you don't already know.",
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query.',
        },
        numResults: {
          type: 'number',
          description: 'How many results to return. Defaults to 5 and is capped at 10.',
        },
      },
      required: ['query'],
    },
  };

  async run(args: Record<string, unknown>, context?: ToolContext): Promise<string> {
    const query = args.query;

    if (typeof query !== 'string' || query.trim().length === 0) {
      this.logger.warn('Rejected web search call: query is missing or empty.');
      return 'Error: query is required and must be a non-empty string.';
    }

    const providerConfig = await this.resolveProviderConfig(context);
    if (!providerConfig) {
      this.logger.warn('Rejected web search call: no search API key configured.');
      return noApiKeyError;
    }

    const numResults = clampNumResults(args.numResults);
    this.logger.log(
      `Starting web search: provider=${providerConfig.provider} query="${query.trim()}" numResults=${numResults}`,
    );

    try {
      const body = await this.search(providerConfig.provider, providerConfig.apiKey, query.trim(), numResults);
      const results = normalizeResults(providerConfig.provider, body);
      this.logger.log(
        `Completed web search: provider=${providerConfig.provider} normalizedResults=${results.length}`,
      );
      return formatResults(results);
    } catch (error) {
      this.logger.error(`Web search failed: ${error instanceof Error ? error.message : String(error)}`);
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async resolveProviderConfig(
    context?: ToolContext,
  ): Promise<{ provider: SearchProvider; apiKey: string } | null> {
    if (context?.userId) {
      const row = await this.prisma.userApiKey.findUnique({
        where: { userId_provider: { userId: context.userId, provider: 'TAVILY' } },
        select: { encryptedKey: true },
      });

      if (row) {
        return { provider: 'tavily', apiKey: decryptKey(row.encryptedKey) };
      }
    }

    return resolveProvider();
  }

  private search(provider: SearchProvider, apiKey: string, query: string, numResults: number): Promise<unknown> {
    switch (provider) {
      case 'brave':
        return fetchJson(
          `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${numResults}`,
          {
            method: 'GET',
            headers: {
              'X-Subscription-Token': apiKey,
            },
          },
        );
      case 'serper':
        return fetchJson('https://google.serper.dev/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': apiKey,
          },
          body: JSON.stringify({ q: query, num: numResults }),
        });
      case 'tavily':
        return fetchJson('https://api.tavily.com/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ api_key: apiKey, query, max_results: numResults }),
        });
    }
  }
}
