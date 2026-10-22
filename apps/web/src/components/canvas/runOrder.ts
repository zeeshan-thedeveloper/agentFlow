import type { FlowEdge, FlowNode } from './types';

// Wires decide what must run before what. Among nodes that are free to run at
// the same moment, the saved run order (set by dragging in the run order bar)
// picks who goes first; nodes it doesn't list go last, in id order. The API
// executor applies the same rule.

function rankOf(runOrder: string[] | undefined) {
  const ranks = new Map((runOrder ?? []).map((id, index) => [id, index]));
  return (a: FlowNode, b: FlowNode) => {
    const ra = ranks.get(a.id) ?? Infinity;
    const rb = ranks.get(b.id) ?? Infinity;
    if (ra !== rb) return ra < rb ? -1 : 1;
    return a.id.localeCompare(b.id);
  };
}

/** The order nodes run in one at a time. Falls back to canvas order if the wires form a loop. */
export function orderNodesForRun(nodes: FlowNode[], edges: FlowEdge[], runOrder?: string[]): FlowNode[] {
  const nodesById = new Map(nodes.map(node => [node.id, node]));
  const indegree = new Map(nodes.map(node => [node.id, 0]));
  const outgoing = new Map(nodes.map(node => [node.id, [] as string[]]));
  const compare = rankOf(runOrder);

  for (const edge of edges) {
    if (!nodesById.has(edge.from) || !nodesById.has(edge.to)) continue;
    outgoing.get(edge.from)!.push(edge.to);
    indegree.set(edge.to, indegree.get(edge.to)! + 1);
  }

  const ready = nodes.filter(node => indegree.get(node.id) === 0).sort(compare);
  const sorted: FlowNode[] = [];

  while (ready.length > 0) {
    const node = ready.shift()!;
    sorted.push(node);

    for (const nextNodeId of outgoing.get(node.id)!) {
      const nextIndegree = indegree.get(nextNodeId)! - 1;
      indegree.set(nextNodeId, nextIndegree);
      if (nextIndegree === 0) {
        ready.push(nodesById.get(nextNodeId)!);
        ready.sort(compare);
      }
    }
  }

  return sorted.length === nodes.length ? sorted : nodes;
}

/** In parallel mode, nodes in the same stage start together. */
export function stagesOf(orderedNodes: FlowNode[], edges: FlowEdge[]): Map<string, number> {
  const stages = new Map<string, number>();
  for (const node of orderedNodes) {
    const upstream = edges.filter(edge => edge.to === node.id).map(edge => stages.get(edge.from) ?? 0);
    stages.set(node.id, upstream.length > 0 ? Math.max(...upstream) + 1 : 0);
  }
  return stages;
}

/** Why `order` can't run as listed, or null when every wire's source comes before its target. */
export function orderViolation(order: string[], nodes: FlowNode[], edges: FlowEdge[]): string | null {
  const position = new Map(order.map((id, index) => [id, index]));
  const labelOf = (id: string) => nodes.find(node => node.id === id)?.label ?? id;

  for (const edge of edges) {
    const from = position.get(edge.from);
    const to = position.get(edge.to);
    if (from === undefined || to === undefined || from < to) continue;
    return `${labelOf(edge.to)} has to run after ${labelOf(edge.from)}`;
  }
  return null;
}

/** `order` with the id at `from` moved so it lands at index `to`. */
export function moveInOrder(order: string[], from: number, to: number): string[] {
  const next = [...order];
  const [id] = next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}
