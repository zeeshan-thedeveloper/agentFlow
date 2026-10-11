import { NH, NW } from './constants';
import type { FlowEdge, FlowNode } from './types';

// Every wire means the same thing: run the target after the source and pass the
// source's output along. What the output is used for follows from the node types.

export type Side = 'top' | 'right' | 'bottom' | 'left';
export const SIDES: Side[] = ['top', 'right', 'bottom', 'left'];

export interface Point {
  x: number;
  y: number;
}

export type ConnectionCheck =
  | { ok: true; from: string; to: string }
  | { ok: false; reason: string };

// Older nodes that still read a database wire; agents join in once they use databases as tools.
const DATABASE_TARGETS = new Set<FlowNode['type']>(['schema', 'query-runner']);

export function isDatabaseNode(node: FlowNode): boolean {
  return node.type === 'integration' && Boolean(node.integrationId?.startsWith('database'));
}

export function edgeKey(edge: Pick<FlowEdge, 'from' | 'to'>): string {
  return `${edge.from}->${edge.to}`;
}

/** One wire per node pair, without the handle ids older saves carried. */
export function normalizeEdges(edges: FlowEdge[]): FlowEdge[] {
  const seen = new Set<string>();
  const result: FlowEdge[] = [];

  for (const edge of edges) {
    const key = edgeKey(edge);
    if (edge.from === edge.to || seen.has(key)) continue;
    seen.add(key);
    result.push({ from: edge.from, to: edge.to });
  }

  return result;
}

function reaches(fromId: string, toId: string, edges: FlowEdge[]): boolean {
  const stack = [fromId];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === toId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const edge of edges) {
      if (edge.from === current) stack.push(edge.to);
    }
  }

  return false;
}

/** Why the node types alone rule out from→to, if they do. */
function typeRuleViolation(from: FlowNode, to: FlowNode): string | null {
  if (to.type === 'trigger') return 'Start runs first, so nothing connects into it';
  if (from.type === 'output') return 'Output is the end of a flow';
  if (isDatabaseNode(to)) return 'Connect from the database into the node that uses it';
  if (isDatabaseNode(from) && !DATABASE_TARGETS.has(to.type)) {
    return 'A database connects into a Schema or Query Runner node';
  }
  return null;
}

function graphRuleViolation(from: FlowNode, to: FlowNode, edges: FlowEdge[]): string | null {
  if (edges.some(edge => edgeKey(edge) === edgeKey({ from: from.id, to: to.id }))) return 'Already connected';
  if (reaches(to.id, from.id, edges)) return 'That would create a loop';
  return null;
}

/**
 * Wires can be drawn from either end: if a→b is not allowed but b→a is
 * (e.g. dragging from Output back to an Agent), the wire is flipped.
 */
export function resolveConnection(
  aId: string,
  bId: string,
  nodes: FlowNode[],
  edges: FlowEdge[],
): ConnectionCheck {
  if (aId === bId) return { ok: false, reason: "A node can't connect to itself" };
  const a = nodes.find(node => node.id === aId);
  const b = nodes.find(node => node.id === bId);
  if (!a || !b) return { ok: false, reason: 'Unknown node' };

  // Use the direction the node types allow; if neither, explain the dragged direction.
  for (const [from, to] of [[a, b], [b, a]] as const) {
    if (typeRuleViolation(from, to)) continue;
    const reason = graphRuleViolation(from, to, edges);
    return reason ? { ok: false, reason } : { ok: true, from: from.id, to: to.id };
  }
  return { ok: false, reason: typeRuleViolation(a, b)! };
}

// ── Geometry ────────────────────────────────────────────────────────────────

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface EdgeGeometry {
  start: Point;
  startSide: Side;
  end: Point;
  endSide: Side;
}

const NORMALS: Record<Side, Point> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

function nodeRect(node: FlowNode, heights: Record<string, number>): Rect {
  return { x: node.x, y: node.y, w: NW, h: heights[node.id] ?? NH };
}

function center(rect: Rect): Point {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

/** The pair of sides that face each other, judged by the empty space between the nodes. */
function facingSides(a: Rect, b: Rect): [Side, Side] {
  const ca = center(a);
  const cb = center(b);
  const dx = cb.x - ca.x;
  const dy = cb.y - ca.y;
  const gapX = Math.abs(dx) - (a.w + b.w) / 2;
  const gapY = Math.abs(dy) - (a.h + b.h) / 2;

  if (gapX >= gapY) return dx >= 0 ? ['right', 'left'] : ['left', 'right'];
  return dy >= 0 ? ['bottom', 'top'] : ['top', 'bottom'];
}

export function sideAnchor(rect: Rect, side: Side, t = 0.5): Point {
  switch (side) {
    case 'top':
      return { x: rect.x + rect.w * t, y: rect.y };
    case 'bottom':
      return { x: rect.x + rect.w * t, y: rect.y + rect.h };
    case 'left':
      return { x: rect.x, y: rect.y + rect.h * t };
    case 'right':
      return { x: rect.x + rect.w, y: rect.y + rect.h * t };
  }
}

export function nodeSideAnchor(node: FlowNode, side: Side, heights: Record<string, number>): Point {
  return sideAnchor(nodeRect(node, heights), side);
}

/**
 * Anchors every wire to the sides of its two nodes that face each other. Wires
 * sharing a side are spread along it, ordered by where the other node sits, so
 * they don't cross right at the node.
 */
export function layoutEdges(
  nodes: FlowNode[],
  edges: FlowEdge[],
  heights: Record<string, number>,
): Map<string, EdgeGeometry> {
  const nodesById = new Map(nodes.map(node => [node.id, node]));
  const sides = new Map<string, [Side, Side]>();
  const slots = new Map<string, { key: string; end: 'start' | 'end'; order: number }[]>();

  for (const edge of edges) {
    const a = nodesById.get(edge.from);
    const b = nodesById.get(edge.to);
    if (!a || !b) continue;

    const key = edgeKey(edge);
    const ra = nodeRect(a, heights);
    const rb = nodeRect(b, heights);
    const [sa, sb] = facingSides(ra, rb);
    sides.set(key, [sa, sb]);

    const along = (side: Side, other: Rect) => (side === 'top' || side === 'bottom' ? center(other).x : center(other).y);
    const push = (slotKey: string, entry: { key: string; end: 'start' | 'end'; order: number }) => {
      const list = slots.get(slotKey) ?? [];
      list.push(entry);
      slots.set(slotKey, list);
    };
    push(`${a.id}:${sa}`, { key, end: 'start', order: along(sa, rb) });
    push(`${b.id}:${sb}`, { key, end: 'end', order: along(sb, ra) });
  }

  const fractions = new Map<string, number>();
  for (const list of slots.values()) {
    list.sort((p, q) => p.order - q.order);
    list.forEach((entry, index) => {
      fractions.set(`${entry.key}:${entry.end}`, (index + 1) / (list.length + 1));
    });
  }

  const result = new Map<string, EdgeGeometry>();
  for (const edge of edges) {
    const key = edgeKey(edge);
    const pair = sides.get(key);
    const a = nodesById.get(edge.from);
    const b = nodesById.get(edge.to);
    if (!pair || !a || !b) continue;

    result.set(key, {
      start: sideAnchor(nodeRect(a, heights), pair[0], fractions.get(`${key}:start`)),
      startSide: pair[0],
      end: sideAnchor(nodeRect(b, heights), pair[1], fractions.get(`${key}:end`)),
      endSide: pair[1],
    });
  }

  return result;
}

function controlOffset(start: Point, end: Point): number {
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  return Math.min(Math.max(distance * 0.4, 30), 160);
}

function controls(start: Point, startSide: Side, end: Point, endSide: Side | null): [Point, Point] {
  const offset = controlOffset(start, end);
  const n1 = NORMALS[startSide];
  const c1 = { x: start.x + n1.x * offset, y: start.y + n1.y * offset };
  // A wire still being dragged has no target side yet: aim straight at the cursor.
  const c2 = endSide
    ? { x: end.x + NORMALS[endSide].x * offset, y: end.y + NORMALS[endSide].y * offset }
    : end;
  return [c1, c2];
}

export function edgePath(start: Point, startSide: Side, end: Point, endSide: Side | null): string {
  const [c1, c2] = controls(start, startSide, end, endSide);
  return `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`;
}

export function edgeMidpoint(start: Point, startSide: Side, end: Point, endSide: Side | null): Point {
  const [c1, c2] = controls(start, startSide, end, endSide);
  // Cubic bezier at t = 0.5.
  return {
    x: (start.x + 3 * c1.x + 3 * c2.x + end.x) / 8,
    y: (start.y + 3 * c1.y + 3 * c2.y + end.y) / 8,
  };
}
