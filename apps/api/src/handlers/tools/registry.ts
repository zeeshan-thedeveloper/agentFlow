import type { Tool } from './base.tool';
import { HttpRequestTool } from './http-request.tool';
import { ScrapePageTool } from './scrape-page.tool';
import { WebSearchTool } from './web-search.tool';

export const availableTools: Record<string, Tool> = {
  http_request: new HttpRequestTool(),
  web_search: new WebSearchTool(),
  scrape_page: new ScrapePageTool(),
};

export function resolveTools(names: string[]): Tool[] {
  return names.map(name => {
    const tool = availableTools[name];
    if (!tool) throw new Error(`Unknown tool: "${name}". Available: ${Object.keys(availableTools).join(', ')}`);
    return tool;
  });
}
