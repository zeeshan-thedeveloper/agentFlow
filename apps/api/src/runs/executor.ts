import { Logger } from '@nestjs/common';
import type { NodeHandler, ToolCallRecord } from '../handlers/base.handler';
import { registry } from '../handlers/registry';
import type { TriggerEvent } from '../connectors/trigger-event';
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

/** Steps that run in order; the node ids in one step run side by side. */
export type RunPlan = string[][];

type WorkflowCanvasJson = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** The run plan from the canvas's run order bar. Older saves may hold a flat list of ids. */
  runOrder?: RunPlan | string[];
  /** Only on workflows saved before run plans existed; picks their starting plan. */
  runMode?: 'parallel' | 'sequential';
};

type ExecutorContext = {
  userId?: string;
  initialInput?: unknown;
  /** The Slack or Telegram message that started the run, if one did. */
  triggerEvent?: TriggerEvent;
};

export type StepResult = {
  nodeId: string;
  input: unknown;
  output: unknown;
  /** SKIPPED: never ran because a node it depends on failed or was skipped. */
  status: 'COMPLETED' | 'FAILED' | 'SKIPPED';
  /** The index of the plan step the node ran in; steps with the same wave ran side by side. */
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

function resolveHandlerType(node: FlowNode): string {
  if (node.type === 'schema') return 'integration';
  if (node.type === 'query-runner') return 'query-runner';
  if (node.type === 'connector') return 'connector';
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

  if (node.type === 'connector') {
    return {
      connector: node.connector,
      allowWrite: node.allowWrite === true,
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

const byId = (a: FlowNode, b: FlowNode) => a.id.localeCompare(b.id);

export function sortNodesTopologically(canvasJson: unknown): FlowNode[] {
  assertCanvasJson(canvasJson);
  const { nodesById, upstream, downstream } = buildGraph(canvasJson);
  const remaining = new Map([...upstream].map(([id, deps]) => [id, deps.size]));

  const queue = canvasJson.nodes.filter(node => remaining.get(node.id) === 0).sort(byId);
  const sorted: FlowNode[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);

    for (const nextNodeId of downstream.get(node.id) ?? []) {
      const nextRemaining = (remaining.get(nextNodeId) ?? 0) - 1;
      remaining.set(nextNodeId, nextRemaining);
      if (nextRemaining === 0) {
        queue.push(nodesById.get(nextNodeId)!);
        queue.sort(byId);
      }
    }
  }

  if (sorted.length !== canvasJson.nodes.length) {
    throw new Error('Workflow graph contains a cycle.');
  }

  return sorted;
}

/** The steps saved on the canvas, including workflows saved before run plans existed. */
function savedRunPlan(canvasJson: WorkflowCanvasJson, sorted: FlowNode[]): RunPlan {
  if (Array.isArray(canvasJson.runOrder)) {
    // A flat list of ids (an earlier save format) means one node per step.
    return canvasJson.runOrder.map(step => (Array.isArray(step) ? step : [step]));
  }
  // Older workflows ran one node at a time unless they were set to parallel.
  if (canvasJson.runMode === 'parallel') return [];
  return sorted.map(node => [node.id]);
}

/**
 * The steps to run, in order. Follows the saved plan, but moves a node to a
 * later step when a node wired into it isn't in an earlier one; nodes the plan
 * doesn't list join the earliest step their wires allow. Matches the canvas's
 * resolveRunPlan.
 */
export function buildRunPlan(canvasJson: unknown): RunPlan {
  assertCanvasJson(canvasJson);
  const sorted = sortNodesTopologically(canvasJson);
  const { upstream } = buildGraph(canvasJson);
  const plan = savedRunPlan(canvasJson, sorted);

  const wanted = new Map<string, number>();
  plan.forEach((step, index) => step.forEach(id => { if (!wanted.has(id)) wanted.set(id, index); }));

  const placed = new Map<string, number>();
  for (const node of sorted) {
    const earliest = Math.max(-1, ...[...upstream.get(node.id)!].map(id => placed.get(id)!)) + 1;
    placed.set(node.id, Math.max(wanted.get(node.id) ?? earliest, earliest));
  }

  const position = new Map(plan.flat().map((id, index) => [id, index]));
  const rank = (id: string) => position.get(id) ?? Infinity;
  const steps = new Map<number, string[]>();
  for (const node of sorted) {
    const index = placed.get(node.id)!;
    steps.set(index, [...(steps.get(index) ?? []), node.id]);
  }
  return [...steps.keys()]
    .sort((a, b) => a - b)
    .map(index => steps.get(index)!.sort((a, b) => rank(a) - rank(b)));
}

/**
 * Runs the plan one step at a time; the nodes in a step run side by side, and
 * the next step starts once they have all finished. A failure skips only the
 * nodes downstream of it, so other branches still finish.
 */
export async function executeWorkflow(
  canvasJson: unknown,
  context: ExecutorContext = {},
  handlers: Record<string, NodeHandler> = registry,
): Promise<StepResult[]> {
  assertCanvasJson(canvasJson);
  // Also rejects cycles.
  const plan = buildRunPlan(canvasJson);
  const { edges } = canvasJson;
  const { nodesById, upstream } = buildGraph(canvasJson);
  const results: StepResult[] = [];
  const stepOutputs = new Map<string, unknown>();
  const blocked = new Set<string>();

  logger.log(`Run plan: ${plan.map(step => step.join(' + ')).join(' -> ')}`);

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

  for (const [wave, step] of plan.entries()) {
    const toRun: FlowNode[] = [];
    for (const nodeId of step) {
      const blocker = [...upstream.get(nodeId)!].find(id => blocked.has(id));
      if (!blocker) {
        toRun.push(nodesById.get(nodeId)!);
        continue;
      }
      logger.log(`Skipping node ${nodeId}: upstream node ${blocker} did not complete`);
      blocked.add(nodeId);
      results.push({
        nodeId,
        input: null,
        output: `Skipped because ${blocker} did not complete.`,
        status: 'SKIPPED',
        wave,
      });
    }

    for (const result of await Promise.all(toRun.map(node => runNode(node, wave)))) {
      results.push(result);
      if (result.status === 'COMPLETED') stepOutputs.set(result.nodeId, result.output);
      else blocked.add(result.nodeId);
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
