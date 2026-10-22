import type { FlowEdge, FlowNode, RunPlan, WorkflowCanvasJson } from './types';

// A run plan is a list of steps that run left to right; the nodes in one step
// run at the same time. Wires still decide what has to run first, so a node is
// always placed in a later step than every node wired into it. The API
// executor builds its plan with the same rules.

function upstreamOf(nodes: FlowNode[], edges: FlowEdge[]): Map<string, string[]> {
  const ids = new Set(nodes.map(node => node.id));
  const upstream = new Map(nodes.map(node => [node.id, [] as string[]]));
  for (const edge of edges) {
    if (ids.has(edge.from) && ids.has(edge.to)) upstream.get(edge.to)!.push(edge.from);
  }
  return upstream;
}

/** Nodes in wire order, ties broken by id; null if the wires form a loop. */
function topologicalOrder(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] | null {
  const upstream = upstreamOf(nodes, edges);
  const remaining = new Map([...upstream].map(([id, deps]) => [id, new Set(deps).size]));
  const downstream = new Map(nodes.map(node => [node.id, new Set<string>()]));
  for (const [id, deps] of upstream) for (const dep of deps) downstream.get(dep)!.add(id);

  const nodesById = new Map(nodes.map(node => [node.id, node]));
  const byId = (a: FlowNode, b: FlowNode) => a.id.localeCompare(b.id);
  const ready = nodes.filter(node => remaining.get(node.id) === 0).sort(byId);
  const sorted: FlowNode[] = [];

  while (ready.length > 0) {
    const node = ready.shift()!;
    sorted.push(node);
    for (const nextId of downstream.get(node.id)!) {
      remaining.set(nextId, remaining.get(nextId)! - 1);
      if (remaining.get(nextId) === 0) {
        ready.push(nodesById.get(nextId)!);
        ready.sort(byId);
      }
    }
  }

  return sorted.length === nodes.length ? sorted : null;
}

/** The plan a loaded workflow starts with, including ones saved before run plans existed. */
export function savedRunPlan(canvas: WorkflowCanvasJson): RunPlan {
  if (Array.isArray(canvas.runOrder)) {
    // A flat list of ids (an earlier save format) means one node per step.
    return canvas.runOrder.map(step => (Array.isArray(step) ? step : [step]));
  }
  // Older workflows ran one node at a time unless they were set to parallel.
  if (canvas.runMode === 'parallel') return [];
  return (topologicalOrder(canvas.nodes, canvas.edges) ?? canvas.nodes).map(node => [node.id]);
}

/**
 * The plan that will run: `plan` with unknown ids dropped, and every node moved
 * to the earliest step its wires allow if the plan has it too early. Nodes the
 * plan doesn't list join the earliest step they can.
 */
export function resolveRunPlan(nodes: FlowNode[], edges: FlowEdge[], plan: RunPlan): RunPlan {
  const order = topologicalOrder(nodes, edges);
  if (!order) return nodes.map(node => [node.id]);

  const wanted = new Map<string, number>();
  plan.forEach((step, index) => step.forEach(id => { if (!wanted.has(id)) wanted.set(id, index); }));

  const upstream = upstreamOf(nodes, edges);
  const placed = new Map<string, number>();
  for (const node of order) {
    const earliest = Math.max(-1, ...upstream.get(node.id)!.map(id => placed.get(id)!)) + 1;
    placed.set(node.id, Math.max(wanted.get(node.id) ?? earliest, earliest));
  }

  // Keep the saved order inside a step, then close the gaps between steps.
  const position = new Map(plan.flat().map((id, index) => [id, index]));
  const rank = (id: string) => position.get(id) ?? Infinity;
  const steps = new Map<number, string[]>();
  for (const node of order) {
    const index = placed.get(node.id)!;
    steps.set(index, [...(steps.get(index) ?? []), node.id]);
  }
  return [...steps.keys()]
    .sort((a, b) => a - b)
    .map(index => steps.get(index)!.sort((a, b) => rank(a) - rank(b)));
}

/** Why `plan` can't run as laid out, or null when every node comes after the nodes wired into it. */
export function planViolation(plan: RunPlan, nodes: FlowNode[], edges: FlowEdge[]): string | null {
  const stepOf = new Map(plan.flatMap((step, index) => step.map(id => [id, index] as const)));
  const labelOf = (id: string) => nodes.find(node => node.id === id)?.label ?? id;

  for (const edge of edges) {
    const from = stepOf.get(edge.from);
    const to = stepOf.get(edge.to);
    if (from === undefined || to === undefined || from < to) continue;
    return from === to
      ? `${labelOf(edge.to)} can't run alongside ${labelOf(edge.from)}, it needs its result`
      : `${labelOf(edge.to)} has to run after ${labelOf(edge.from)}`;
  }
  return null;
}

/** Where a dragged node is dropped: into an existing step, or as a new step before index `at`. */
export type PlanDrop = { kind: 'join'; step: number } | { kind: 'insert'; at: number };

export function moveInPlan(plan: RunPlan, id: string, drop: PlanDrop): RunPlan {
  const steps = plan.map(step => [...step]);
  const target = drop.kind === 'join' ? steps[drop.step] : [];
  if (drop.kind === 'insert') steps.splice(drop.at, 0, target);
  for (const step of steps) {
    if (step === target) continue;
    const index = step.indexOf(id);
    if (index >= 0) step.splice(index, 1);
  }
  if (!target.includes(id)) target.push(id);
  return steps.filter(step => step.length > 0);
}
