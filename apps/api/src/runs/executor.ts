import { registry } from '../handlers/registry';

type FlowNode = {
  id: string;
  type: string;
  label?: string;
  subtitle?: string;
  x?: number;
  y?: number;
  params?: Record<string, unknown>;
  [key: string]: unknown;
};

type FlowEdge = {
  from: string;
  to: string;
};

type WorkflowCanvasJson = {
  nodes: FlowNode[];
  edges: FlowEdge[];
};

type ExecutorContext = {
  userId?: string;
  initialInput?: unknown;
};

export type StepResult = {
  nodeId: string;
  input: unknown;
  output: unknown;
  status: 'COMPLETED' | 'FAILED';
};

function assertCanvasJson(canvasJson: unknown): asserts canvasJson is WorkflowCanvasJson {
  if (
    !canvasJson ||
    typeof canvasJson !== 'object' ||
    !Array.isArray((canvasJson as WorkflowCanvasJson).nodes) ||
    !Array.isArray((canvasJson as WorkflowCanvasJson).edges)
  ) {
    throw new Error('Invalid workflow canvas JSON.');
  }
}

function buildNodeParams(node: FlowNode, context: ExecutorContext): Record<string, unknown> {
  if (node.params && typeof node.params === 'object' && !Array.isArray(node.params)) {
    return {
      ...node.params,
      ...context,
    };
  }

  const { id, type, label, subtitle, x, y, params, ...canvasParams } = node;

  // Current canvas nodes store config fields at the top level, not under params.
  return {
    ...canvasParams,
    ...context,
  };
}

export function sortNodesTopologically(canvasJson: unknown): FlowNode[] {
  assertCanvasJson(canvasJson);

  const nodesById = new Map(canvasJson.nodes.map(node => [node.id, node]));
  const indegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  for (const node of canvasJson.nodes) {
    indegree.set(node.id, 0);
    outgoing.set(node.id, []);
  }

  for (const edge of canvasJson.edges) {
    if (!nodesById.has(edge.from) || !nodesById.has(edge.to)) {
      throw new Error(`Workflow edge references an unknown node: ${edge.from} -> ${edge.to}`);
    }

    outgoing.get(edge.from)?.push(edge.to);
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
  }

  const queue = canvasJson.nodes
    .filter(node => indegree.get(node.id) === 0)
    .sort((a, b) => a.id.localeCompare(b.id));

  const sorted: FlowNode[] = [];

  while (queue.length > 0) {
    const node = queue.shift();

    if (!node) {
      continue;
    }

    sorted.push(node);

    for (const nextNodeId of outgoing.get(node.id) ?? []) {
      const nextIndegree = (indegree.get(nextNodeId) ?? 0) - 1;
      indegree.set(nextNodeId, nextIndegree);

      if (nextIndegree === 0) {
        const nextNode = nodesById.get(nextNodeId);

        if (nextNode) {
          queue.push(nextNode);
          queue.sort((a, b) => a.id.localeCompare(b.id));
        }
      }
    }
  }

  if (sorted.length !== canvasJson.nodes.length) {
    throw new Error('Workflow graph contains a cycle.');
  }

  return sorted;
}

export async function executeWorkflow(
  canvasJson: unknown,
  context: ExecutorContext = {},
): Promise<StepResult[]> {
  const sortedNodes = sortNodesTopologically(canvasJson);
  const results: StepResult[] = [];
  // Seed the trigger node with request input, then pass each output forward.
  let previousOutput: unknown = context.initialInput;

  for (const node of sortedNodes) {
    const handler = registry[node.type];

    if (!handler) {
      throw new Error(`No handler registered for node type: ${node.type}`);
    }

    const input = previousOutput;

    try {
      const output = await handler.execute(buildNodeParams(node, context), input);

      results.push({
        nodeId: node.id,
        input,
        output,
        status: 'COMPLETED',
      });

      previousOutput = output;
    } catch (error) {
      // Return the failed node as a step result so RunsService can persist it.
      results.push({
        nodeId: node.id,
        input,
        output: error instanceof Error ? error.message : String(error),
        status: 'FAILED',
      });

      break;
    }
  }

  return results;
}
