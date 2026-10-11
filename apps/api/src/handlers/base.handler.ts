/** One tool call an agent made during a run, reported back with the step. */
export interface ToolCallRecord {
  tool: string;
  args: Record<string, unknown>;
  ok: boolean;
  /** Tool output or error message, shortened for display. */
  result: string;
}

export interface HandlerContext {
  recordToolCall(call: ToolCallRecord): void;
}

export interface NodeHandler {
  execute(params: Record<string, unknown>, input: unknown, context?: HandlerContext): Promise<unknown>;
}
