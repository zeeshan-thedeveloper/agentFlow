import { useCallback, useEffect, useRef, useState } from 'react';
import type { FlowNode, FlowEdge, RunPhasesMap, ToolCallRecord } from './types';
import { nodeTypeConfig } from './constants';
import CanvasNodeCard from './CanvasNodeCard';
import {
  edgeKey,
  edgeMidpoint,
  edgePath,
  isDatabaseNode,
  isToolNode,
  isWaitEdge,
  layoutEdges,
  nodeSideAnchor,
  resolveConnection,
  type Side,
} from './connections';

interface CanvasBoardProps {
  nodes: FlowNode[];
  setNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  edges: FlowEdge[];
  setEdges: React.Dispatch<React.SetStateAction<FlowEdge[]>>;
  selected: string | null;
  setSelected: (id: string | null) => void;
  runPhases: RunPhasesMap;
  runOutputs?: Record<string, string>;
  runToolCalls?: Record<string, ToolCallRecord[]>;
  onRemoveNode: (id: string) => void;
}

interface DragState {
  id: string;
  sx: number;
  sy: number;
  ox: number;
  oy: number;
}

interface PanState {
  sx: number;
  sy: number;
}

interface ConnectState {
  from: string;
  side: Side;
  /** Cursor position in screen (canvas-element) pixels. */
  x: number;
  y: number;
}

function arrowId(color: string): string {
  return `edgeArrow-${color.replace('#', '')}`;
}

function nodeColor(node: FlowNode): string {
  return nodeTypeConfig(node).color;
}

// Wait wires carry no data, so they are drawn neutral instead of in the source's color.
const WAIT_EDGE_COLOR = '#94A3B8';

const MIN_ZOOM = 0.55;
const MAX_ZOOM = 1.8;

export default function CanvasBoard({
  nodes, setNodes, edges, setEdges, selected, setSelected, runPhases, runOutputs, runToolCalls, onRemoveNode,
}: CanvasBoardProps) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [panning, setPanning] = useState<PanState | null>(null);
  const [connecting, setConnecting] = useState<ConnectState | null>(null);
  const [hoverTargetId, setHoverTargetId] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const [nodeLayoutHeights, setNodeLayoutHeights] = useState<Record<string, number>>({});
  const ref = useRef<HTMLDivElement>(null);

  const reportLayoutHeight = useCallback((nodeId: string, height: number) => {
    setNodeLayoutHeights(prev => (prev[nodeId] === height ? prev : { ...prev, [nodeId]: height }));
  }, []);

  function getCanvasPoint(e: Pick<React.MouseEvent | WheelEvent, 'clientX' | 'clientY'>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return { x: e.clientX, y: e.clientY };

    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function screenX(x: number) {
    return x * zoom + pan.x;
  }

  function screenY(y: number) {
    return y * zoom + pan.y;
  }

  function worldPoint(point: { x: number; y: number }) {
    return { x: (point.x - pan.x) / zoom, y: (point.y - pan.y) / zoom };
  }

  function clampZoom(value: number) {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
  }

  function setZoomAroundPoint(nextZoom: number, point: { x: number; y: number }) {
    setZoom(currentZoom => {
      const clampedZoom = clampZoom(nextZoom);
      const worldPoint = {
        x: (point.x - pan.x) / currentZoom,
        y: (point.y - pan.y) / currentZoom,
      };

      setPan({
        x: point.x - worldPoint.x * clampedZoom,
        y: point.y - worldPoint.y * clampedZoom,
      });

      return clampedZoom;
    });
  }

  const removeNode = useCallback((id: string) => {
    onRemoveNode(id);
    setSelected(null);
    setSelectedEdge(null);
    setDragging(current => current?.id === id ? null : current);
    setConnecting(current => current?.from === id ? null : current);
  }, [onRemoveNode, setSelected]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isEditing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      if (isEditing || (e.key !== 'Delete' && e.key !== 'Backspace')) return;
      if (!selectedEdge && !selected) return;

      e.preventDefault();

      if (selectedEdge) {
        setEdges(prev => prev.filter(edge => edgeKey(edge) !== selectedEdge));
        setSelectedEdge(null);
        return;
      }

      if (selected) removeNode(selected);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [removeNode, selected, selectedEdge, setEdges]);

  function startNodeDrag(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setSelectedEdge(null);
    const n = nodes.find(node => node.id === id);
    if (!n) return;
    setDragging({ id, sx: e.clientX, sy: e.clientY, ox: n.x, oy: n.y });
  }

  function onBgDown(e: React.MouseEvent) {
    const tag = (e.target as HTMLElement).tagName.toLowerCase();
    if (e.target === ref.current || ['svg', 'path', 'circle', 'rect', 'g'].includes(tag)) {
      setSelected(null);
      setSelectedEdge(null);
      setPanning({ sx: e.clientX - pan.x, sy: e.clientY - pan.y });
    }
  }

  function onMouseMove(e: React.MouseEvent) {
    if (connecting) {
      const point = getCanvasPoint(e);
      setConnecting(current => (current ? { ...current, ...point } : null));
      return;
    }

    if (dragging) {
      const dx = e.clientX - dragging.sx;
      const dy = e.clientY - dragging.sy;
      setNodes(prev => prev.map(node =>
        node.id === dragging.id ? { ...node, x: dragging.ox + dx / zoom, y: dragging.oy + dy / zoom } : node,
      ));
    }

    if (panning) setPan({ x: e.clientX - panning.sx, y: e.clientY - panning.sy });
  }

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const point = getCanvasPoint(e);
      const zoomDelta = Math.exp(-e.deltaY * 0.01);
      setZoomAroundPoint(zoom * zoomDelta, point);
    }

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [pan.x, pan.y, zoom]);


  function onMouseUp() {
    setDragging(null);
    setPanning(null);
    setConnecting(null);
    setHoverTargetId(null);
  }

  function startConnection(e: React.MouseEvent, from: string, side: Side) {
    e.preventDefault();
    e.stopPropagation();
    const point = getCanvasPoint(e);
    setSelected(null);
    setSelectedEdge(null);
    setDragging(null);
    setPanning(null);
    setConnecting({ from, side, ...point });
  }

  function finishConnection(e: React.MouseEvent, targetId: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!connecting) return;

    const check = resolveConnection(connecting.from, targetId, nodes, edges);
    if (check.ok) {
      setEdges(prev => [...prev, { from: check.from, to: check.to }]);
    }
    setConnecting(null);
    setHoverTargetId(null);
  }

  function removeEdge(edge: FlowEdge) {
    setEdges(prev => prev.filter(item => edgeKey(item) !== edgeKey(edge)));
    setSelectedEdge(null);
  }

  function toggleEdgeKind(edge: FlowEdge) {
    setEdges(prev => prev.map(item => {
      if (edgeKey(item) !== edgeKey(edge)) return item;
      return isWaitEdge(item) ? { from: item.from, to: item.to } : { ...item, kind: 'wait' };
    }));
  }

  const nodeMap = Object.fromEntries(nodes.map(node => [node.id, node]));
  const connectingNode = connecting ? nodeMap[connecting.from] : null;
  const geometry = layoutEdges(nodes, edges, nodeLayoutHeights);
  const arrowColors = [...new Set([...nodes.map(nodeColor), WAIT_EDGE_COLOR])];
  const selectedEdgeItem = edges.find(edge => edgeKey(edge) === selectedEdge);
  const selectedEdgeShape = selectedEdge ? geometry.get(selectedEdge) : undefined;
  // A database or app wire hands the agent a tool, so making it wait-only would make no sense.
  const canToggleSelectedEdge =
    Boolean(selectedEdgeItem) && !(nodeMap[selectedEdgeItem!.from] && isToolNode(nodeMap[selectedEdgeItem!.from]));
  const hoverCheck =
    connecting && hoverTargetId && hoverTargetId !== connecting.from
      ? resolveConnection(connecting.from, hoverTargetId, nodes, edges)
      : null;

  return (
    <div
      ref={ref}
      onMouseDown={onBgDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      style={{
        flex: 1, position: 'relative', overflow: 'hidden',
        cursor: connecting ? 'crosshair' : panning ? 'grabbing' : 'default',
        backgroundColor: 'var(--app-bg)',
        backgroundImage: 'var(--canvas-wash), radial-gradient(circle, var(--grid-dot) 1px, transparent 1px)',
        backgroundSize: `auto, ${26 * zoom}px ${26 * zoom}px`,
        backgroundPosition: `center, ${pan.x % (26 * zoom)}px ${pan.y % (26 * zoom)}px`,
      }}
    >
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
        background: 'radial-gradient(ellipse at center, transparent 60%, var(--vignette) 100%)',
      }} />

      <svg style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        pointerEvents: 'auto', zIndex: 3,
      }}>
        <defs>
          {arrowColors.map(color => (
            <marker
              key={color}
              id={arrowId(color)}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
            </marker>
          ))}
        </defs>

        {/* Wires are laid out in canvas coordinates; one transform applies pan and zoom. */}
        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          {edges.map(edge => {
            const key = edgeKey(edge);
            const shape = geometry.get(key);
            const source = nodeMap[edge.from];
            if (!shape || !source) return null;

            const path = edgePath(shape.start, shape.startSide, shape.end, shape.endSide);
            const mid = edgeMidpoint(shape.start, shape.startSide, shape.end, shape.endSide);
            const isWait = isWaitEdge(edge);
            const color = isWait ? WAIT_EDGE_COLOR : nodeColor(source);
            const isSelected = selectedEdge === key;
            const isHovered = hoveredEdge === key;
            const isIncomingActive = runPhases[edge.to] === 'running';
            const emphasized = isSelected || isHovered;

            return (
              <g key={key}>
                <path
                  d={path}
                  fill="none"
                  stroke={color}
                  strokeWidth={emphasized ? 2.25 : 1.75}
                  strokeOpacity={emphasized ? 1 : 0.75}
                  strokeDasharray={
                    isIncomingActive ? undefined : isWait ? '2 5' : isToolNode(source) ? '5 4' : undefined
                  }
                  strokeLinecap={isWait ? 'round' : undefined}
                  markerEnd={`url(#${arrowId(color)})`}
                  vectorEffect="non-scaling-stroke"
                  className={isIncomingActive ? 'edgeActive' : undefined}
                  style={{ pointerEvents: 'none' }}
                />
                <path
                  d={path}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={16}
                  vectorEffect="non-scaling-stroke"
                  style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredEdge(key)}
                  onMouseLeave={() => setHoveredEdge(current => (current === key ? null : current))}
                  onMouseDown={e => {
                    e.stopPropagation();
                    setSelected(null);
                    setSelectedEdge(key);
                  }}
                  onDoubleClick={e => {
                    e.stopPropagation();
                    removeEdge(edge);
                  }}
                />
                {isSelected && (
                  <g
                    transform={`translate(${mid.x} ${mid.y}) scale(${1 / zoom})`}
                    style={{ cursor: 'pointer' }}
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => {
                      e.stopPropagation();
                      removeEdge(edge);
                    }}
                  >
                    <title>Remove connection</title>
                    <circle r="10" fill="var(--panel-bg)" stroke={color} strokeWidth="1.5" />
                    <path d="M-3.5 -3.5L3.5 3.5M3.5 -3.5L-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </g>
                )}
              </g>
            );
          })}

          {connecting && connectingNode && (() => {
            const start = nodeSideAnchor(connectingNode, connecting.side, nodeLayoutHeights);
            const end = worldPoint(connecting);
            const stroke = hoverCheck && !hoverCheck.ok ? '#EF4444' : nodeColor(connectingNode);
            return (
              <path
                d={edgePath(start, connecting.side, end, null)}
                fill="none"
                stroke={stroke}
                strokeWidth={2}
                strokeDasharray="7 5"
                strokeOpacity={0.9}
                vectorEffect="non-scaling-stroke"
                style={{ pointerEvents: 'none' }}
              />
            );
          })()}
        </g>
      </svg>

      {selectedEdgeItem && selectedEdgeShape && canToggleSelectedEdge && (() => {
        const mid = edgeMidpoint(
          selectedEdgeShape.start, selectedEdgeShape.startSide, selectedEdgeShape.end, selectedEdgeShape.endSide,
        );
        const isWait = isWaitEdge(selectedEdgeItem);
        return (
          <button
            type="button"
            title={
              isWait
                ? 'Runs after the source but receives none of its output. Click to pass the output along.'
                : 'Runs after the source and receives its output. Click to only wait for it.'
            }
            onMouseDown={e => e.stopPropagation()}
            onClick={e => {
              e.stopPropagation();
              toggleEdgeKind(selectedEdgeItem);
            }}
            style={{
              position: 'absolute', left: screenX(mid.x), top: screenY(mid.y) + 18, zIndex: 30,
              transform: 'translateX(-50%)', whiteSpace: 'nowrap',
              padding: '3px 9px', borderRadius: 99, fontSize: 10, fontWeight: 600, fontFamily: 'inherit',
              border: '1px solid var(--border-strong)', background: 'var(--panel-bg)',
              color: 'var(--text-secondary)', cursor: 'pointer',
              boxShadow: '0 4px 14px var(--shadow-soft)',
            }}
          >
            {isWait ? 'Wait only · switch to pass data' : 'Passes data · switch to wait only'}
          </button>
        );
      })()}

      {connecting && hoverCheck && !hoverCheck.ok && (
        <div style={{
          position: 'absolute', left: connecting.x + 14, top: connecting.y + 14, zIndex: 30,
          pointerEvents: 'none', fontSize: 11, fontWeight: 600, color: '#fff',
          background: '#EF4444', borderRadius: 6, padding: '4px 8px', whiteSpace: 'nowrap',
          boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
        }}>
          {hoverCheck.reason}
        </div>
      )}

      <div style={{ position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none' }}>
        {nodes.map(node => (
          <CanvasNodeCard
            key={node.id}
            worldNode={node}
            screenX={screenX(node.x)}
            screenY={screenY(node.y)}
            scale={zoom}
            selected={selected === node.id}
            runPhase={runPhases[node.id]}
            runOutput={runOutputs?.[node.id]}
            runToolCalls={runToolCalls?.[node.id]}
            onMouseDown={e => startNodeDrag(e, node.id)}
            onClick={() => {
              setSelectedEdge(null);
              setSelected(selected === node.id ? null : node.id);
            }}
            onDelete={e => {
              e.stopPropagation();
              removeNode(node.id);
            }}
            connecting={Boolean(connecting)}
            connectTarget={
              hoverCheck && hoverTargetId === node.id ? (hoverCheck.ok ? 'valid' : 'invalid') : null
            }
            onStartConnection={(e, side) => startConnection(e, node.id, side)}
            onConnectHover={hovered => {
              setHoverTargetId(current => (hovered ? node.id : current === node.id ? null : current));
            }}
            onFinishConnection={e => finishConnection(e, node.id)}
            onLayoutHeight={reportLayoutHeight}
            databaseNames={
              node.type === 'agent'
                ? edges
                    .filter(edge => edge.to === node.id && nodeMap[edge.from] && isDatabaseNode(nodeMap[edge.from]))
                    .map(edge => {
                      const db = nodeMap[edge.from];
                      return db.connectionName || db.integrationId?.split(':').pop() || db.label;
                    })
                : undefined
            }
            connectorKinds={
              node.type === 'agent'
                ? edges.flatMap(edge => {
                    const source = edge.to === node.id ? nodeMap[edge.from] : undefined;
                    return source?.type === 'connector' && source.connector ? [source.connector] : [];
                  })
                : undefined
            }
          />
        ))}
      </div>

      <div style={{ position: 'absolute', bottom: 20, right: 20, display: 'flex', gap: 6, zIndex: 20 }}>
        {[
          {
            label: 'Zoom in',
            icon: <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>,
            action: () => setZoomAroundPoint(zoom * 1.15, { x: ref.current?.clientWidth ? ref.current.clientWidth / 2 : 0, y: ref.current?.clientHeight ? ref.current.clientHeight / 2 : 0 }),
          },
          {
            label: 'Zoom out',
            icon: <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>,
            action: () => setZoomAroundPoint(zoom / 1.15, { x: ref.current?.clientWidth ? ref.current.clientWidth / 2 : 0, y: ref.current?.clientHeight ? ref.current.clientHeight / 2 : 0 }),
          },
          {
            label: 'Fit',
            icon: <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M3 1H1v2M7 1h2v2M1 7v2h2M9 7v2H7"
                stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>,
            action: () => { setPan({ x: 0, y: 0 }); setZoom(1); },
          },
        ].map(btn => (
          <button
            key={btn.label}
            title={btn.label}
            onClick={btn.action}
            style={{
              width: 28, height: 28, borderRadius: 7,
              border: '1px solid var(--border-strong)', background: 'var(--button-bg)',
              color: 'var(--text-muted)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            {btn.icon}
          </button>
        ))}
      </div>

      <div style={{ position: 'absolute', bottom: 20, left: 20, fontSize: 11, color: 'var(--text-faint)', zIndex: 20 }}>
        {nodes.length} nodes - {edges.length} edges - {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}
