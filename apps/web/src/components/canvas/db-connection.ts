import { isDatabaseNode } from './connections';
import type { FlowEdge, FlowNode } from './types';

export function findDbInSourceNode(
  nodeId: string,
  nodes: FlowNode[],
  edges: FlowEdge[],
): FlowNode | undefined {
  for (const edge of edges) {
    if (edge.to !== nodeId) continue;
    const source = nodes.find(item => item.id === edge.from);
    if (source && isDatabaseNode(source)) return source;
  }
  return undefined;
}
