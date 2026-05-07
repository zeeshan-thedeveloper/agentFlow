export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolContext {
  userId?: string;
}

export interface Tool {
  definition: ToolDefinition;
  run(args: Record<string, unknown>, context?: ToolContext): Promise<string>;
}
