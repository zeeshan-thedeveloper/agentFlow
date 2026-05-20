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

function handleSide(position: string): 'left' | 'right' {
  return position.includes('right') ? 'right' : 'left';
}

const HANDLE_Y_FRACTION: Record<string, number> = {
  'left-top': 0.28,
  'right-top': 0.28,
  'left-middle': 0.5,
  left: 0.5,
  right: 0.5,
  'left-bottom': 0.72,
  'right-bottom': 0.72,
};

/** Map legacy saved handle ids to current node definitions. */
export function resolveHandleId(node: FlowNode, handleId: string | undefined): string | undefined {
  if (!handleId) return undefined;
  if (getHandleDefById(node, handleId)) return handleId;
  if (node.type === 'agent') {
    if (handleId === 'data-out') return 'text-out';
    if (handleId === 'data-in' || handleId === 'schema-in') return 'text-in';
  }
  return handleId;
}

function handleYFraction(def: HandleDef, sideHandles: HandleDef[]): number {
  if (HANDLE_Y_FRACTION[def.position] !== undefined) {
    return HANDLE_Y_FRACTION[def.position];
  }
  const index = Math.max(0, sideHandles.findIndex(h => h.id === def.id));
  return (index + 1) / (sideHandles.length + 1);
}

/** Canvas-space anchor for a handle; shared by edge routing and handle dots. */
export function getHandlePosition(
  node: FlowNode,
  handleId: string,
  nodeWidth = NW,
  nodeHeight = NH,
): { x: number; y: number } {
  const resolvedId = resolveHandleId(node, handleId) ?? handleId;
  const def = getHandleDefById(node, resolvedId);
  if (!def) {
    return { x: node.x, y: node.y + nodeHeight / 2 };
  }

  const side = handleSide(def.position);
  const sideHandles = getNodeHandles(node).filter(h => handleSide(h.position) === side);
  const y = node.y + nodeHeight * handleYFraction(def, sideHandles);
  const x = side === 'right' ? node.x + nodeWidth : node.x;

  return { x, y };
}

export function getHandleAnchor(
  node: FlowNode,
  handleId: string,
  nodeHeight = NH,
  yOffset = 0,
): { x: number; y: number } {
  const anchor = getHandlePosition(node, handleId, NW, nodeHeight);
  return { x: anchor.x, y: anchor.y + yOffset };
}

/** Spread multiple edges that share the same handle so wires do not fully overlap. */
export function getFanOutYOffset(index: number, count: number, spacing = 12): number {
  if (count <= 1) return 0;
  return (index - (count - 1) / 2) * spacing;
}

export function listEdgesOnHandle(
  edges: { from: string; to: string; sourceHandle?: string; targetHandle?: string }[],
  node: FlowNode,
  handleId: string,
  role: 'source' | 'target',
): { from: string; to: string; sourceHandle?: string; targetHandle?: string }[] {
  const resolved = resolveHandleId(node, handleId) ?? handleId;
  return edges.filter(edge => {
    if (role === 'source') {
      return (
        edge.from === node.id &&
        (resolveHandleId(node, edge.sourceHandle) ?? edge.sourceHandle) === resolved
      );
    }
    return (
      edge.to === node.id &&
      (resolveHandleId(node, edge.targetHandle) ?? edge.targetHandle) === resolved
    );
  });
}
