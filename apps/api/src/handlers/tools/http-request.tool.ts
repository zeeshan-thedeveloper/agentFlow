import type { Tool, ToolDefinition } from './base.tool';

export class HttpRequestTool implements Tool {
  definition: ToolDefinition = {
    name: 'http_request',
    description:
      'Make an HTTP request to any URL and return the response body. Use this to fetch data from external APIs or services.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The full URL to request.',
        },
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
          description: 'HTTP method. Defaults to GET.',
        },
        headers: {
          type: 'object',
          description: 'Optional key-value HTTP headers.',
          additionalProperties: { type: 'string' },
        },
        body: {
          type: 'string',
          description: 'Optional request body (for POST/PUT/PATCH).',
        },
      },
      required: ['url'],
    },
  };

  async run(args: Record<string, unknown>): Promise<string> {
    const url = args.url;
    const method = typeof args.method === 'string' ? args.method.toUpperCase() : 'GET';
    const headers =
      args.headers && typeof args.headers === 'object' && !Array.isArray(args.headers)
        ? (args.headers as Record<string, string>)
        : {};
    const body = typeof args.body === 'string' ? args.body : undefined;

    if (typeof url !== 'string' || !url) {
      return 'Error: url is required and must be a string.';
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body && method !== 'GET' && method !== 'DELETE' ? body : undefined,
        signal: AbortSignal.timeout(15_000),
      });

      const text = await response.text();

      // Truncate very large responses so they don't blow up the context window.
      const truncated = text.length > 8000 ? text.slice(0, 8000) + '\n[truncated]' : text;

      return `HTTP ${response.status} ${response.statusText}\n\n${truncated}`;
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}
