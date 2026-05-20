import type { FlowEdge, FlowNode } from './types';
import { buildSchemaDatabaseEdge, findDatabaseNodeForConnection, isDatabaseNode } from './handle-utils';

export function stripSchemaDbEdges(edges: FlowEdge[], schemaNodeId: string): FlowEdge[] {
  return edges.filter(
    edge => !(edge.to === schemaNodeId && (edge.targetHandle ?? 'data-in') === 'db-in'),
  );
}

export function syncSchemaDatabaseEdge(
  schemaNode: FlowNode,
  nodes: FlowNode[],
  edges: FlowEdge[],
): FlowEdge[] {
  if (schemaNode.type !== 'schema') return edges;

  const next = stripSchemaDbEdges(edges, schemaNode.id);
  const integrationId = schemaNode.integrationId?.trim();
  if (!integrationId) return next;

  const dbNode = findDatabaseNodeForConnection(nodes, integrationId);
  if (!dbNode) return next;

  const link = buildSchemaDatabaseEdge(dbNode.id, schemaNode.id);
  const exists = next.some(
    edge =>
      edge.from === link.from &&
      edge.to === link.to &&
      (edge.sourceHandle ?? 'data-out') === link.sourceHandle &&
      (edge.targetHandle ?? 'data-in') === link.targetHandle,
  );

  return exists ? next : [...next, link];
}

export function syncDatabaseSchemaEdges(
  dbNode: FlowNode,
  nodes: FlowNode[],
  edges: FlowEdge[],
): FlowEdge[] {
  if (!isDatabaseNode(dbNode) || !dbNode.integrationId) return edges;

  let next = edges;
  for (const schemaNode of nodes.filter(node => node.type === 'schema')) {
    if (schemaNode.integrationId === dbNode.integrationId) {
      next = syncSchemaDatabaseEdge(schemaNode, nodes, next);
    } else {
      next = stripSchemaDbEdges(next, schemaNode.id);
    }
  }
  return next;
}
