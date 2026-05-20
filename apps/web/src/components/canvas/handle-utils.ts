import { NODE_HANDLES, NW, NH } from './constants';
import type { FlowNode, HandleDef, HandleType, NodeType } from './types';

export const HANDLE_COLORS: Record<HandleType, string> = {
  data: '#F59E0B',
  trigger: '#F59E0B',
  schema: '#8B5CF6',
  query: '#06B6D4',
};

export function getHandlesKey(node: FlowNode): keyof typeof NODE_HANDLES {
  if (node.type === 'integration' && node.integrationId?.startsWith('database')) {
    return 'database';
  }
  return node.type as keyof typeof NODE_HANDLES;
}

export function getNodeHandles(node: FlowNode): HandleDef[] {
  const key = getHandlesKey(node);
  const defs = NODE_HANDLES[key] ?? [];
  return defs.filter(def => {
    if (def.conditional === "inputType === 'sql'") {
      return node.inputType === 'sql';
    }
    return true;
  });
}

export function getHandleDef(node: FlowNode, handleId: string | undefined): HandleDef | undefined {
  if (!handleId) return undefined;
  return getNodeHandles(node).find(def => def.id === handleId);
}

export function getHandleType(
  nodeId: string,
  handleId: string | undefined,
  nodes: FlowNode[],
): HandleType | undefined {
  const node = nodes.find(item => item.id === nodeId);
  if (!node || !handleId) return undefined;
  return getHandleDef(node, handleId)?.handleType;
}

export function getTargetHandleType(targetHandle: string | undefined): HandleType {
  if (targetHandle === 'schema-in' || targetHandle === 'db-in') return 'schema';
  if (targetHandle === 'query-in' || targetHandle === 'agent-in') return 'query';
  return 'data';
}

export function isDatabaseNode(node: FlowNode): boolean {
  return node.type === 'integration' && Boolean(node.integrationId?.startsWith('database'));
}

export function findDatabaseNodeForConnection(nodes: FlowNode[], integrationId: string): FlowNode | undefined {
  if (!integrationId) return undefined;
  return nodes.find(
    node => isDatabaseNode(node) && node.integrationId === integrationId,
  );
}

export function buildSchemaDatabaseEdge(dbNodeId: string, schemaNodeId: string): {
  from: string;
  to: string;
  sourceHandle: string;
  targetHandle: string;
} {
  return {
    from: dbNodeId,
    to: schemaNodeId,
    sourceHandle: 'schema-out',
    targetHandle: 'db-in',
  };
}

export function isValidConnection(
  sourceId: string,
  sourceHandle: string | undefined,
  targetId: string,
  targetHandle: string | undefined,
  nodes: FlowNode[],
): boolean {
  const srcType = getHandleType(sourceId, sourceHandle, nodes);
  const tgtType = getHandleType(targetId, targetHandle, nodes);
  if (!srcType || !tgtType) return true;
  if (srcType === 'trigger' && tgtType === 'data') return true;
  if (srcType === 'data' && tgtType === 'query') return true;
  return srcType === tgtType;
}

export function getHandleAnchor(
  node: FlowNode,
  handleId: string,
): { x: number; y: number } {
  const def = getHandleDef(node, handleId);
  const position = def?.position ?? (def?.type === 'target' ? 'left' : 'right');
  switch (position) {
    case 'left-top':
      return { x: node.x, y: node.y + NH * 0.28 };
    case 'left-bottom':
      return { x: node.x, y: node.y + NH * 0.72 };
    case 'right-top':
      return { x: node.x + NW, y: node.y + NH * 0.28 };
    case 'right-bottom':
      return { x: node.x + NW, y: node.y + NH * 0.72 };
    case 'left':
      return { x: node.x, y: node.y + NH / 2 };
    case 'right':
    default:
      return { x: node.x + NW, y: node.y + NH / 2 };
  }
}
