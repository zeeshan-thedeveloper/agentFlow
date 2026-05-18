import { ScrapePageTool } from './scrape-page.tool';

type FetchCall = {
  input: string | URL | Request;
  init?: RequestInit;
};

type MockFetch = typeof fetch & {
  calls: FetchCall[];
  resolveText: (body: string) => void;
  resolveHttpError: (status: number, statusText: string) => void;
  rejectWith: (error: Error) => void;
};

const originalFetch = globalThis.fetch;

function createResponse(body: string): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: () => Promise.resolve(body),
  } as Response;
}

function createHttpErrorResponse(status: number, statusText: string): Response {
  return {
    ok: false,
    status,
    statusText,
    text: () => Promise.resolve(''),
  } as Response;
}

function createMockFetch(): MockFetch {
  const calls: FetchCall[] = [];
  let nextResult: Promise<Response> = Promise.resolve(createResponse(''));

  const mockFetch = ((input: string | URL | Request, init?: RequestInit) => {
    calls.push({ input, init });
    return nextResult;
  }) as MockFetch;

  mockFetch.calls = calls;
  mockFetch.resolveText = (body: string) => {
    nextResult = Promise.resolve(createResponse(body));
  };
  mockFetch.resolveHttpError = (status: number, statusText: string) => {
    nextResult = Promise.resolve(createHttpErrorResponse(status, statusText));
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

describe('ScrapePageTool', () => {
  beforeEach(() => {
    useMockFetch();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns cleaned text from valid HTML', async () => {
    const fetchMock = useMockFetch();
    fetchMock.resolveText('<html><body><h1>Hello</h1><p>World</p></body></html>');

    const result = await new ScrapePageTool().run({ url: 'https://example.com' });

    expect(result).toContain('Hello');
    expect(result).toContain('World');
    expect(String(result).includes('<h1>')).toBe(false);
  });

  it('strips script and style tags', async () => {
    const fetchMock = useMockFetch();
    fetchMock.resolveText(
      '<html><body><style>body{color:red}</style><h1>Hello</h1><script>alert(\'xss\')</script></body></html>',
    );

    const result = await new ScrapePageTool().run({ url: 'https://example.com' });

    expect(result).toContain('Hello');
    expect(String(result).includes('alert')).toBe(false);
    expect(String(result).includes('color:red')).toBe(false);
  });

  it('returns error string for non-http URL', async () => {
    const result = await new ScrapePageTool().run({ url: 'ftp://example.com' });

    expect(result).toBe('Error: url must start with http:// or https://');
  });

  it('returns error string for empty url', async () => {
    const result = await new ScrapePageTool().run({ url: '' });

    expect(result).toBe('Error: url is required and must be a non-empty string.');
  });

  it('returns error string when fetch rejects', async () => {
    const fetchMock = useMockFetch();
    fetchMock.rejectWith(new Error('network failed'));

    const result = await new ScrapePageTool().run({ url: 'https://example.com' });

    expect(result).toBe('Error: network failed');
  });

  it('returns error string on HTTP error status', async () => {
    const fetchMock = useMockFetch();
    fetchMock.resolveHttpError(403, 'Forbidden');

    const result = await new ScrapePageTool().run({ url: 'https://example.com' });

    expect(result).toBe('Error: HTTP 403 Forbidden');
  });

  it('respects maxLength cap', async () => {
    const fetchMock = useMockFetch();
    fetchMock.resolveText(`<html><body><p>${'x'.repeat(30000)}</p></body></html>`);

    const result = await new ScrapePageTool().run({ url: 'https://example.com', maxLength: 30000 });

    expect(result.length <= 20000).toBe(true);
    expect(result).toContain('[truncated]');
  });

  it('uses default maxLength of 8000', async () => {
    const fetchMock = useMockFetch();
    fetchMock.resolveText(`<html><body><p>${'x'.repeat(10000)}</p></body></html>`);

    const result = await new ScrapePageTool().run({ url: 'https://example.com' });

    expect(result.length <= 8000 + '\n[truncated]'.length).toBe(true);
    expect(result).toContain('[truncated]');
  });

  it('returns no-content message for empty body', async () => {
    const fetchMock = useMockFetch();
    fetchMock.resolveText('<html><body></body></html>');

    const result = await new ScrapePageTool().run({ url: 'https://example.com' });

    expect(result).toBe('No readable text content found on this page.');
  });
});
