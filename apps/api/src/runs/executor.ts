import { Logger } from '@nestjs/common';
import { registry } from '../handlers/registry';
import { assembleNodeInput, handlerPayload } from './node-input';

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
  sourceHandle?: string;
  targetHandle?: string;
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

const logger = new Logger('WorkflowExecutor');

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

function resolveHandlerType(node: FlowNode): string {
  return node.type === 'schema' ? 'integration' : node.type;
}

function buildNodeParams(node: FlowNode, context: ExecutorContext): Record<string, unknown> {
  if (node.type === 'schema') {
    return {
      integrationId: node.integrationId,
      actionId: 'introspect',
      actionParams: {},
      ...context,
    };
  }

  if (node.params && typeof node.params === 'object' && !Array.isArray(node.params)) {
    return {
      ...node.params,
      ...context,
    };
  }

  const { id, type, label, subtitle, x, y, params, connectionName, ...canvasParams } = node;

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
  assertCanvasJson(canvasJson);
  const sortedNodes = sortNodesTopologically(canvasJson);
  const results: StepResult[] = [];
  const stepOutputs = new Map<string, unknown>();

  logger.log(
    `Execution order: ${sortedNodes.map(node => `${node.id}:${node.type}`).join(' -> ')}`,
  );

  for (const node of sortedNodes) {
    const handler = registry[resolveHandlerType(node)];

    if (!handler) {
      throw new Error(`No handler registered for node type: ${node.type}`);
    }

    const nodeInput = assembleNodeInput(node.id, canvasJson.edges, stepOutputs);
    if (node.type === 'trigger' && context.initialInput !== undefined && nodeInput.data === undefined) {
      nodeInput.data = context.initialInput;
    }

    const input = handlerPayload(node.type, nodeInput);

    try {
      const params = buildNodeParams(node, context);
      logger.log(
        `Starting node ${node.id} (${node.type}) input=${formatLogValue(input)} params=${formatNodeParams(params)}`,
      );
      const output = await handler.execute(params, input);
      logger.log(`Completed node ${node.id} (${node.type}) output=${formatLogValue(output)}`);

      results.push({
        nodeId: node.id,
        input,
        output,
        status: 'COMPLETED',
      });

      stepOutputs.set(node.id, output);
    } catch (error) {
      logger.error(
        `Failed node ${node.id} (${node.type}): ${error instanceof Error ? error.message : String(error)}`,
      );
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

function formatNodeParams(params: Record<string, unknown>): string {
  const { prompt, userId, workflowOwnerId, ...safeParams } = params;
  return formatLogValue({
    ...safeParams,
    hasPrompt: typeof prompt === 'string' && prompt.length > 0,
    userId: typeof userId === 'string' ? userId : undefined,
    workflowOwnerId: typeof workflowOwnerId === 'string' ? workflowOwnerId : undefined,
  });
}

function formatLogValue(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (!text) {
    return 'undefined';
  }

  return text.length > 500 ? `${text.slice(0, 500)}...` : text;
}
