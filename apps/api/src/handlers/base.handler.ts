export interface NodeHandler {
  execute(params: Record<string, unknown>, input: unknown): Promise<unknown>;
}
