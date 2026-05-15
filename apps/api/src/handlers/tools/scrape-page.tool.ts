import { Logger } from '@nestjs/common';
import { parse } from 'node-html-parser';
import type { Tool, ToolContext, ToolDefinition } from './base.tool';

const DEFAULT_MAX_LENGTH = 8000;
const MAX_LENGTH_CAP = 20000;
const MIN_LENGTH = 100;

function clampMaxLength(value: unknown): number {
  const numericValue = typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_MAX_LENGTH;
  return Math.max(MIN_LENGTH, Math.min(MAX_LENGTH_CAP, Math.floor(numericValue)));
}

function collapseWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function truncateText(text: string, maxLength: number): string {
  const suffix = '\n[truncated]';
  return text.length > maxLength ? `${text.slice(0, maxLength - suffix.length)}${suffix}` : text;
}

export class ScrapePageTool implements Tool {
  private readonly logger = new Logger(ScrapePageTool.name);

  definition: ToolDefinition = {
    name: 'scrape_page',
    description:
      'Fetch a URL and return its readable text content with all HTML tags, scripts, and styles removed. Use this to read the full content of a webpage after finding its URL via web_search.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The full URL of the page to scrape.',
        },
        maxLength: {
          type: 'number',
          description: 'Maximum number of characters to return. Defaults to 8000 and is capped at 20000.',
        },
      },
      required: ['url'],
    },
  };

  async run(args: Record<string, unknown>, _context?: ToolContext): Promise<string> {
    const url = args.url;

    if (typeof url !== 'string' || url.trim().length === 0) {
      this.logger.warn('Rejected scrape page call: url is missing or empty.');
      return 'Error: url is required and must be a non-empty string.';
    }

    const trimmedUrl = url.trim();
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      this.logger.warn('Rejected scrape page call: url must be http or https.');
      return 'Error: url must start with http:// or https://';
    }

    const maxLength = clampMaxLength(args.maxLength);
    this.logger.log(`Starting page scrape: url="${trimmedUrl}" maxLength=${maxLength}`);

    try {
      const response = await fetch(trimmedUrl, {
        signal: AbortSignal.timeout(15_000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AgentFlow/1.0)',
        },
      });

      if (!response.ok) {
        return `Error: HTTP ${response.status} ${response.statusText}`.trim();
      }

      const html = await response.text();
      const root = parse(html);
      const contentRoot = root.querySelector('body') ?? root;

      contentRoot.querySelectorAll('script, style, noscript').forEach(node => node.remove());

      const text = collapseWhitespace(contentRoot.structuredText || contentRoot.innerText);

      if (!text) {
        this.logger.log(`Completed page scrape: url="${trimmedUrl}" characters=0`);
        return 'No readable text content found on this page.';
      }

      const result = truncateText(text, maxLength);
      this.logger.log(`Completed page scrape: url="${trimmedUrl}" characters=${result.length}`);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Page scrape failed: ${message}`);
      return `Error: ${message}`;
    }
  }
}
