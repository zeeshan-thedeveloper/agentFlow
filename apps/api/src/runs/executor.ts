import { Logger } from '@nestjs/common';
import type { NodeHandler, ToolCallRecord } from '../handlers/base.handler';
import { registry } from '../handlers/registry';
import { assembleNodeInput, handlerPayload, isDatabaseConfigNode } from './node-input';

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
  /** 'wait' wires only order the run; 'data' (the default) also passes output along. */
  kind?: 'data' | 'wait';
};

export type RunMode = 'parallel' | 'sequential';

type WorkflowCanvasJson = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** Saved workflows from before run modes existed have none and keep running one node at a time. */
  runMode?: RunMode;
  /** Node ids in the order the user picked; breaks ties between nodes free to run at once. */
  runOrder?: string[];
};

type ExecutorContext = {
  userId?: string;
  initialInput?: unknown;
};

export type StepResult = {
  nodeId: string;
  input: unknown;
  output: unknown;
  /** SKIPPED: never ran because a node it depends on failed or was skipped. */
  status: 'COMPLETED' | 'FAILED' | 'SKIPPED';
  /**
   * Steps with the same wave ran side by side. Parallel runs use the node's depth
   * in the graph; sequential runs number each step in turn.
   */
  wave: number;
  /** Tools the node called while running (agents only), in order. */
  toolCalls?: ToolCallRecord[];
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

export function runModeOf(canvasJson: unknown): RunMode {
  const runMode = (canvasJson as WorkflowCanvasJson | null)?.runMode;
  return runMode === 'parallel' ? 'parallel' : 'sequential';
}

function resolveHandlerType(node: FlowNode): string {
  if (node.type === 'schema') return 'integration';
  if (node.type === 'query-runner') return 'query-runner';
  if (isDatabaseConfigNode(node)) return 'database';
  return node.type;
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

  if (node.type === 'query-runner') {
    return {
      integrationId: node.integrationId,
      actionParams: node.actionParams ?? {},
      ...context,
    };
  }

  if (isDatabaseConfigNode(node)) {
    return {
      integrationId: node.integrationId,
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

/** Upstream and downstream node ids, one entry per node pair whatever the wire kind. */
function buildGraph(canvasJson: WorkflowCanvasJson) {
  const nodesById = new Map(canvasJson.nodes.map(node => [node.id, node]));
  const upstream = new Map<string, Set<string>>();
  const downstream = new Map<string, Set<string>>();

  for (const node of canvasJson.nodes) {
    upstream.set(node.id, new Set());
    downstream.set(node.id, new Set());
  }

  for (const edge of canvasJson.edges) {
    if (!nodesById.has(edge.from) || !nodesById.has(edge.to)) {
      throw new Error(`Workflow edge references an unknown node: ${edge.from} -> ${edge.to}`);
    }
    // Older saves can hold several wires between the same pair; the sets count each pair once.
    downstream.get(edge.from)!.add(edge.to);
    upstream.get(edge.to)!.add(edge.from);
  }

  return { nodesById, upstream, downstream };
}

/**
 * Orders nodes that are free to run at the same moment: first by the saved run
 * order, then by id for nodes it doesn't list.
 */
function runPriority(canvasJson: WorkflowCanvasJson) {
  const runOrder = Array.isArray(canvasJson.runOrder) ? canvasJson.runOrder : [];
  const ranks = new Map(runOrder.map((id, index) => [id, index]));
  return (a: FlowNode, b: FlowNode) => {
    const ra = ranks.get(a.id) ?? Infinity;
    const rb = ranks.get(b.id) ?? Infinity;
    if (ra !== rb) return ra < rb ? -1 : 1;
    return a.id.localeCompare(b.id);
  };
}

export function sortNodesTopologically(canvasJson: unknown): FlowNode[] {
  assertCanvasJson(canvasJson);
  const { nodesById, upstream, downstream } = buildGraph(canvasJson);
  const remaining = new Map([...upstream].map(([id, deps]) => [id, deps.size]));
  const byPriority = runPriority(canvasJson);

  const queue = canvasJson.nodes.filter(node => remaining.get(node.id) === 0).sort(byPriority);
  const sorted: FlowNode[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);

    for (const nextNodeId of downstream.get(node.id) ?? []) {
      const nextRemaining = (remaining.get(nextNodeId) ?? 0) - 1;
      remaining.set(nextNodeId, nextRemaining);
      if (nextRemaining === 0) {
        queue.push(nodesById.get(nextNodeId)!);
        queue.sort(byPriority);
      }
    }
  }

  if (sorted.length !== canvasJson.nodes.length) {
    throw new Error('Workflow graph contains a cycle.');
  }

  return sorted;
}

/**
 * Runs every node once all the nodes wired into it have finished. In parallel
 * mode every ready node starts at once; in sequential mode one runs at a time,
 * in the saved run order. A failure skips only the nodes downstream of it, so other
 * branches still finish.
 */
export async function executeWorkflow(
  canvasJson: unknown,
  context: ExecutorContext = {},
  handlers: Record<string, NodeHandler> = registry,
): Promise<StepResult[]> {
  assertCanvasJson(canvasJson);
  // Also rejects cycles, so the scheduler below always drains.
  sortNodesTopologically(canvasJson);

  const runMode = runModeOf(canvasJson);
  const concurrency = runMode === 'parallel' ? Infinity : 1;
  const { edges } = canvasJson;
  const { nodesById, upstream, downstream } = buildGraph(canvasJson);
  const remaining = new Map([...upstream].map(([id, deps]) => [id, deps.size]));
  const results: StepResult[] = [];
  const stepOutputs = new Map<string, unknown>();
  const waves = new Map<string, number>();
  const blocked = new Set<string>();
  const running = new Map<string, Promise<StepResult>>();
  const byPriority = runPriority(canvasJson);
  const ready = canvasJson.nodes.filter(node => remaining.get(node.id) === 0).sort(byPriority);
  let startedCount = 0;

  logger.log(`Run mode: ${runMode}`);

  function waveFor(node: FlowNode): number {
    if (runMode === 'sequential') return startedCount;
    const depWaves = [...upstream.get(node.id)!].map(id => waves.get(id) ?? 0);
    return depWaves.length > 0 ? Math.max(...depWaves) + 1 : 0;
  }

  async function runNode(node: FlowNode, wave: number): Promise<StepResult> {
    const handler = handlers[resolveHandlerType(node)];
    const nodeInput = assembleNodeInput(node.id, nodesById, edges, stepOutputs);
    if (node.type === 'trigger' && context.initialInput !== undefined && nodeInput.data === undefined) {
      nodeInput.data = context.initialInput;
    }

    const input = handlerPayload(node.type, nodeInput);
    const toolCalls: ToolCallRecord[] = [];
    const withToolCalls = () => (toolCalls.length > 0 ? { toolCalls } : {});

    try {
      if (!handler) throw new Error(`No handler registered for node type: ${node.type}`);

      const params = buildNodeParams(node, context);
      logger.log(
        `Starting node ${node.id} (${node.type}) wave=${wave} input=${formatLogValue(input)} params=${formatNodeParams(params)}`,
      );
      const output = await handler.execute(params, input, {
        recordToolCall: call => toolCalls.push(call),
      });
      logger.log(`Completed node ${node.id} (${node.type}) output=${formatLogValue(output)}`);

      return { nodeId: node.id, input, output, status: 'COMPLETED', wave, ...withToolCalls() };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed node ${node.id} (${node.type}): ${message}`);
      // Returned, not thrown, so RunsService can persist the failed step.
      return { nodeId: node.id, input, output: message, status: 'FAILED', wave, ...withToolCalls() };
    }
  }

  // Called once a node has a final result; releases or skips what waits on it.
  function settle(result: StepResult) {
    results.push(result);
    waves.set(result.nodeId, result.wave);
    if (result.status === 'COMPLETED') {
      stepOutputs.set(result.nodeId, result.output);
    } else {
      blocked.add(result.nodeId);
    }

    for (const nextNodeId of downstream.get(result.nodeId) ?? []) {
      const nextRemaining = (remaining.get(nextNodeId) ?? 0) - 1;
      remaining.set(nextNodeId, nextRemaining);
      if (nextRemaining > 0) continue;

      const nextNode = nodesById.get(nextNodeId)!;
      const blocker = [...upstream.get(nextNodeId)!].find(id => blocked.has(id));
      if (blocker) {
        logger.log(`Skipping node ${nextNodeId}: upstream node ${blocker} did not complete`);
        settle({
          nodeId: nextNodeId,
          input: null,
          output: `Skipped because ${blocker} did not complete.`,
          status: 'SKIPPED',
          wave: result.wave + 1,
        });
      } else {
        ready.push(nextNode);
        ready.sort(byPriority);
      }
    }
  }

  while (ready.length > 0 || running.size > 0) {
    while (ready.length > 0 && running.size < concurrency) {
      const node = ready.shift()!;
      const wave = waveFor(node);
      startedCount++;
      running.set(node.id, runNode(node, wave));
    }

    const finished = await Promise.race(running.values());
    running.delete(finished.nodeId);
    settle(finished);
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
