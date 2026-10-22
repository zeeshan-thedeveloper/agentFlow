// A data edge means "run after + pass output"; a wait edge only means "run after".
// Any handle ids from older saves are ignored. What a data link carries is decided
// by the node types it joins.
type FlowEdge = {
  from: string;
  to: string;
  kind?: 'data' | 'wait';
};

export type FlowNodeRef = {
  id: string;
  type: string;
  label?: unknown;
  integrationId?: unknown;
};

/** A connector node (Gmail, Slack, GitHub, ...) wired into an agent. */
export interface ConnectorRef {
  kind: string;
  allowWrite: boolean;
}

export interface NodeInput {
  data?: unknown;
  schema?: string;
  query?: string;
  connection?: string;
  /** Integration ids of databases wired into an agent, used as tools. */
  databases?: string[];
  /** Connector nodes wired into an agent, used as tools. */
  connectors?: ConnectorRef[];
}

export type ConnectionRole = 'database-tool' | 'connector-tool' | 'connection' | 'schema' | 'query' | 'data';

export function isDatabaseConfigNode(node: FlowNodeRef): boolean {
  return node.type === 'integration' && String(node.integrationId ?? '').startsWith('database');
}

export function connectionRole(source: FlowNodeRef, target: FlowNodeRef): ConnectionRole {
  if (isDatabaseConfigNode(source)) return target.type === 'agent' ? 'database-tool' : 'connection';
  if (source.type === 'connector' && target.type === 'agent') return 'connector-tool';
  if (source.type === 'schema') return 'schema';
  if (target.type === 'query-runner') return 'query';
  if (target.type === 'integration' && source.type === 'agent') return 'query';
  return 'data';
}

function isConnectorRef(value: unknown): value is ConnectorRef {
  return typeof (value as ConnectorRef | null)?.kind === 'string';
}

function schemaFromStepOutput(value: unknown): string {
  if (value && typeof value === 'object' && 'schema' in value) {
    const schema = (value as { schema?: unknown }).schema;
    if (typeof schema === 'string') return schema;
  }
  return asText(value);
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return '';
  return JSON.stringify(value);
}

// A Start node with no input emits {} — that is "nothing to pass", not a message.
function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (typeof value === 'object' && !Array.isArray(value)) return Object.keys(value).length === 0;
  return false;
}

export function assembleNodeInput(
  nodeId: string,
  nodesById: Map<string, FlowNodeRef>,
  edges: FlowEdge[],
  stepOutputs: Map<string, unknown>,
): NodeInput {
  const input: NodeInput = {};
  const target = nodesById.get(nodeId);
  if (!target) return input;

  const dataParts: { label: string; value: unknown }[] = [];
  const seenSources = new Set<string>();

  for (const edge of edges) {
    if (edge.to !== nodeId || edge.kind === 'wait' || seenSources.has(edge.from)) continue;
    seenSources.add(edge.from);

    const source = nodesById.get(edge.from);
    if (!source) continue;
    const value = stepOutputs.get(edge.from);

    switch (connectionRole(source, target)) {
      case 'database-tool':
        input.databases = [...(input.databases ?? []), asText(value)];
        break;
      case 'connector-tool':
        if (isConnectorRef(value)) input.connectors = [...(input.connectors ?? []), value];
        break;
      case 'connection':
        input.connection = asText(value);
        break;
      case 'schema':
        input.schema = schemaFromStepOutput(value);
        break;
      case 'query':
        if (!isEmptyValue(value)) input.query = asText(value);
        break;
      default:
        if (!isEmptyValue(value)) {
          dataParts.push({ label: String(source.label || source.id), value });
        }
    }
  }

  if (dataParts.length === 1) {
    input.data = dataParts[0].value;
  } else if (dataParts.length > 1) {
    // Several upstream nodes: hand them over as labelled sections.
    input.data = dataParts.map(part => `## ${part.label}\n${asText(part.value)}`).join('\n\n');
  }

  return input;
}

export function isNodeInput(value: unknown): value is NodeInput {
  return (
    value !== null &&
    typeof value === 'object' &&
    ('data' in value ||
      'schema' in value ||
      'query' in value ||
      'connection' in value ||
      'databases' in value ||
      'connectors' in value)
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
