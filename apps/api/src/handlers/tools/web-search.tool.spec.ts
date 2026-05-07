import { WebSearchTool } from './web-search.tool';

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => Promise<void> | void) => void;
declare const beforeEach: (fn: () => void) => void;
declare const afterEach: (fn: () => void) => void;
declare const expect: (value: unknown) => {
  toBe: (expected: unknown) => void;
  toContain: (expected: string) => void;
};

type FetchCall = {
  input: string | URL | Request;
  init?: RequestInit;
};

type MockFetch = typeof fetch & {
  calls: FetchCall[];
  resolveJson: (body: unknown) => void;
  rejectWith: (error: Error) => void;
};

const originalEnv = {
  BRAVE_SEARCH_API_KEY: process.env.BRAVE_SEARCH_API_KEY,
  SERPER_API_KEY: process.env.SERPER_API_KEY,
  TAVILY_API_KEY: process.env.TAVILY_API_KEY,
};

const originalFetch = globalThis.fetch;

function restoreEnv(): void {
  delete process.env.BRAVE_SEARCH_API_KEY;
  delete process.env.SERPER_API_KEY;
  delete process.env.TAVILY_API_KEY;

  if (originalEnv.BRAVE_SEARCH_API_KEY !== undefined) {
    process.env.BRAVE_SEARCH_API_KEY = originalEnv.BRAVE_SEARCH_API_KEY;
  }

  if (originalEnv.SERPER_API_KEY !== undefined) {
    process.env.SERPER_API_KEY = originalEnv.SERPER_API_KEY;
  }

  if (originalEnv.TAVILY_API_KEY !== undefined) {
    process.env.TAVILY_API_KEY = originalEnv.TAVILY_API_KEY;
  }
}

function createResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(body),
  } as Response;
}

function createMockFetch(): MockFetch {
  const calls: FetchCall[] = [];
  let nextResult: Promise<Response> = Promise.resolve(createResponse({}));

  const mockFetch = ((input: string | URL | Request, init?: RequestInit) => {
    calls.push({ input, init });
    return nextResult;
  }) as MockFetch;

  mockFetch.calls = calls;
  mockFetch.resolveJson = (body: unknown) => {
    nextResult = Promise.resolve(createResponse(body));
  };
  mockFetch.rejectWith = (error: Error) => {
    nextResult = Promise.reject(error);
  };

  return mockFetch;
}

function useMockFetch(): MockFetch {
  const mockFetch = createMockFetch();
  globalThis.fetch = mockFetch;
  return mockFetch;
}

describe('WebSearchTool', () => {
  beforeEach(() => {
    delete process.env.BRAVE_SEARCH_API_KEY;
    delete process.env.SERPER_API_KEY;
    delete process.env.TAVILY_API_KEY;
  });

  afterEach(() => {
    restoreEnv();
    globalThis.fetch = originalFetch;
  });

  it('returns formatted results when Brave key is set', async () => {
    process.env.BRAVE_SEARCH_API_KEY = 'brave-key';
    const fetchMock = useMockFetch();
    fetchMock.resolveJson({
      web: {
        results: [
          { title: 'First result', url: 'https://example.com/one', description: 'First snippet' },
          { title: 'Second result', url: 'https://example.com/two', description: 'Second snippet' },
        ],
      },
    });

    const result = await new WebSearchTool().run({ query: 'agent orchestration', numResults: 2 });

    expect(result).toBe(
      '1. First result\n   URL: https://example.com/one\n   Snippet: First snippet\n\n2. Second result\n   URL: https://example.com/two\n   Snippet: Second snippet',
    );
    expect(String(fetchMock.calls[0]?.input)).toBe(
      'https://api.search.brave.com/res/v1/web/search?q=agent%20orchestration&count=2',
    );
  });

  it('falls back to Serper when only SERPER_API_KEY is set', async () => {
    process.env.SERPER_API_KEY = 'serper-key';
    const fetchMock = useMockFetch();
    fetchMock.resolveJson({
      organic: [{ title: 'Serper result', link: 'https://example.com/serper', snippet: 'Serper snippet' }],
    });

    const result = await new WebSearchTool().run({ query: 'current docs' });

    expect(result).toContain('1. Serper result');
    expect(String(fetchMock.calls[0]?.input)).toBe('https://google.serper.dev/search');
  });

  it('falls back to Tavily when only TAVILY_API_KEY is set', async () => {
    process.env.TAVILY_API_KEY = 'tavily-key';
    const fetchMock = useMockFetch();
    fetchMock.resolveJson({
      results: [{ title: 'Tavily result', url: 'https://example.com/tavily', content: 'Tavily snippet' }],
    });

    const result = await new WebSearchTool().run({ query: 'web facts' });

    expect(result).toContain('1. Tavily result');
    expect(String(fetchMock.calls[0]?.input)).toBe('https://api.tavily.com/search');
  });

  it('returns the no key configured error string when no env vars are set', async () => {
    const result = await new WebSearchTool().run({ query: 'missing key' });

    expect(result).toBe(
      'Error: Web Search requires a Tavily API key. Add one in Settings → Search.',
    );
  });

  it('returns an error string when fetch rejects', async () => {
    process.env.BRAVE_SEARCH_API_KEY = 'brave-key';
    const fetchMock = useMockFetch();
    fetchMock.rejectWith(new Error('network failed'));

    const result = await new WebSearchTool().run({ query: 'agent orchestration' });

    expect(result).toBe('Error: network failed');
  });

  it('clamps numResults to 10 when caller passes 99', async () => {
    process.env.BRAVE_SEARCH_API_KEY = 'brave-key';
    const fetchMock = useMockFetch();
    fetchMock.resolveJson({ web: { results: [] } });

    await new WebSearchTool().run({ query: 'agent orchestration', numResults: 99 });

    expect(String(fetchMock.calls[0]?.input)).toContain('&count=10');
  });

  it('returns an error string for empty query', async () => {
    process.env.BRAVE_SEARCH_API_KEY = 'brave-key';

    const result = await new WebSearchTool().run({ query: '   ' });

    expect(result).toBe('Error: query is required and must be a non-empty string.');
  });
});
