import type { FlowEdge, FlowNode } from './types';

export function findDbInSourceNode(
  nodeId: string,
  nodes: FlowNode[],
  edges: FlowEdge[],
): FlowNode | undefined {
  const edge = edges.find(
    item => item.to === nodeId && (item.targetHandle ?? 'data-in') === 'db-in',
  );
  if (!edge) return undefined;
  return nodes.find(item => item.id === edge.from);
}
