type FlowEdge = {
  from: string;
  to: string;
  sourceHandle?: string;
  targetHandle?: string;
};

export interface NodeInput {
  data?: unknown;
  schema?: string;
  query?: string;
  connection?: string;
}

export function getTargetHandleType(
  targetHandle: string | undefined,
): 'data' | 'schema' | 'query' | 'connection' {
  if (targetHandle === 'schema-in') return 'schema';
  if (targetHandle === 'query-in' || targetHandle === 'agent-in') return 'query';
  if (targetHandle === 'db-in') return 'connection';
  return 'data';
}

function schemaFromStepOutput(value: unknown): string {
  if (value && typeof value === 'object' && 'schema' in value) {
    const schema = (value as { schema?: unknown }).schema;
    if (typeof schema === 'string') return schema;
  }
  return typeof value === 'string' ? value : String(value ?? '');
}

export function assembleNodeInput(
  nodeId: string,
  edges: FlowEdge[],
  stepOutputs: Map<string, unknown>,
): NodeInput {
  const input: NodeInput = {};

  for (const edge of edges.filter(item => item.to === nodeId)) {
    const value = stepOutputs.get(edge.from);
    const handleType = getTargetHandleType(edge.targetHandle);

    if (handleType === 'schema') {
      input.schema = schemaFromStepOutput(value);
    } else if (handleType === 'query') {
      input.query = typeof value === 'string' ? value : String(value ?? '');
    } else if (handleType === 'connection') {
      input.connection = typeof value === 'string' ? value : String(value ?? '');
    } else {
      input.data = value;
    }
  }

  return input;
}

export function isNodeInput(value: unknown): value is NodeInput {
  return (
    value !== null &&
    typeof value === 'object' &&
    ('data' in value || 'schema' in value || 'query' in value || 'connection' in value)
  );
}

export function handlerPayload(nodeType: string, input: NodeInput | unknown): unknown {
  if (nodeType === 'agent' || nodeType === 'integration' || nodeType === 'query-runner') {
    return isNodeInput(input) ? input : { data: input };
  }

  if (isNodeInput(input)) {
    return input.data !== undefined ? input.data : input;
  }

  return input;
}
