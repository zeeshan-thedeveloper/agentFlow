import { NODE_HANDLES, NW, NH } from './constants';
import type { FlowNode, HandleDef, HandleType, NodeType } from './types';

export const HANDLE_COLORS: Record<HandleType, string> = {
  data: '#F59E0B',
  trigger: '#F59E0B',
  schema: '#8B5CF6',
  query: '#06B6D4',
  connection: '#64748B',
};

export function getHandleColor(handleId: string, handleType: HandleType): string {
  if (handleId === 'read-out') return '#10B981';
  if (handleId === 'write-out') return '#F59E0B';
  return HANDLE_COLORS[handleType];
}

export function getHandlesKey(node: FlowNode): keyof typeof NODE_HANDLES {
  if (node.type === 'query-runner') return 'query-runner';
  if (node.type === 'integration' && node.integrationId?.startsWith('database')) {
    return 'database';
  }
  return node.type as keyof typeof NODE_HANDLES;
}

export function evalConditional(conditional: string | undefined, node: FlowNode): boolean {
  if (!conditional) return true;

  if (conditional.includes("inputType === 'sql'")) {
    return node.inputType === 'sql';
  }

  if (
    conditional.includes("inputType === 'text'") ||
    conditional.includes("triggerInputMode === 'input'")
  ) {
    return node.triggerInputMode === 'input' && (node.inputType ?? 'text') !== 'sql';
  }

  return true;
}

export function getAllNodeHandleDefs(node: FlowNode): HandleDef[] {
  const key = getHandlesKey(node);
  return NODE_HANDLES[key] ?? [];
}

export function getNodeHandles(node: FlowNode): HandleDef[] {
  return getAllNodeHandleDefs(node).filter(def => evalConditional(def.conditional, node));
}

export function getHandleDefById(node: FlowNode, handleId: string | undefined): HandleDef | undefined {
  if (!handleId) return undefined;
  return getAllNodeHandleDefs(node).find(def => def.id === handleId);
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
  return getHandleDefById(node, handleId)?.handleType;
}

export function getTargetHandleType(targetHandle: string | undefined): HandleType {
  if (targetHandle === 'schema-in' || targetHandle === 'db-in') return 'schema';
  if (targetHandle === 'query-in' || targetHandle === 'agent-in') return 'query';
  return 'data';
}

export function isValidConnection(
  sourceId: string,
  sourceHandle: string | undefined,
  targetId: string,
  targetHandle: string | undefined,
  nodes: FlowNode[],
): boolean {
  const sourceNode = nodes.find(item => item.id === sourceId);
  const targetNode = nodes.find(item => item.id === targetId);
  const srcType = getHandleType(sourceId, sourceHandle, nodes);
  const tgtType = getHandleType(targetId, targetHandle, nodes);

  if (
    targetHandle === 'db-in' &&
    targetNode?.type === 'schema' &&
    sourceHandle !== 'read-out'
  ) {
    return false;
  }

  if (!srcType || !tgtType) return true;
  if (srcType === 'connection' && tgtType !== 'connection') return false;
  if (tgtType === 'connection' && srcType !== 'connection') return false;
  if (srcType === 'trigger' && tgtType !== 'trigger') return false;
  if (tgtType === 'trigger' && srcType !== 'trigger') return false;

  const isDataToQuery = srcType === 'data' && tgtType === 'query';
  if (srcType !== tgtType && !isDataToQuery) return false;

  return true;
}

export function getHandleAnchor(
  node: FlowNode,
  handleId: string,
): { x: number; y: number } {
  const def = getHandleDefById(node, handleId);
  const position = def?.position ?? (def?.type === 'target' ? 'left' : 'right');
  switch (position) {
    case 'left-top':
      return { x: node.x, y: node.y + NH * 0.28 };
    case 'left-middle':
      return { x: node.x, y: node.y + NH * 0.5 };
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
