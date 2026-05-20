import { useCallback, useEffect, useRef, useState } from 'react';
import type { FlowNode, FlowEdge, RunPhasesMap } from './types';
import { NODE_TYPES, NW, NH } from './constants';
import type { LibraryNodeType } from './types';
import CanvasNodeCard from './CanvasNodeCard';
import {
  bezierMidpoint,
  buildEdgePath,
  edgeColor,
  edgeHandleLabel,
} from './edge-utils';
import { getHandleAnchor, isValidConnection } from './handle-utils';

interface CanvasBoardProps {
  nodes: FlowNode[];
  setNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  edges: FlowEdge[];
  setEdges: React.Dispatch<React.SetStateAction<FlowEdge[]>>;
  selected: string | null;
  setSelected: (id: string | null) => void;
  runPhases: RunPhasesMap;
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
  sourceHandle: string;
  x: number;
  y: number;
  valid: boolean;
}

const MIN_ZOOM = 0.55;
const MAX_ZOOM = 1.8;

export default function CanvasBoard({
  nodes, setNodes, edges, setEdges, selected, setSelected, runPhases, onRemoveNode,
}: CanvasBoardProps) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [panning, setPanning] = useState<PanState | null>(null);
  const [connecting, setConnecting] = useState<ConnectState | null>(null);
  const [hoverTarget, setHoverTarget] = useState<{ nodeId: string; handleId: string } | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

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
        setEdges(prev => prev.filter(edge => {
          const key = `${edge.from}:${edge.sourceHandle ?? 'data-out'}->${edge.to}:${edge.targetHandle ?? 'data-in'}`;
          return key !== selectedEdge;
        }));
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
      const valid = hoverTarget
        ? isValidConnection(
            connecting.from,
            connecting.sourceHandle,
            hoverTarget.nodeId,
            hoverTarget.handleId,
            nodes,
          )
        : true;
      setConnecting(current => (current ? { ...current, ...point, valid } : null));
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
  }

  function startConnection(e: React.MouseEvent, from: string, sourceHandle: string) {
    e.preventDefault();
    e.stopPropagation();
    const point = getCanvasPoint(e);
    setSelected(null);
    setSelectedEdge(null);
    setDragging(null);
    setPanning(null);
    setConnecting({ from, sourceHandle, ...point, valid: true });
  }

  function finishConnection(e: React.MouseEvent, to: string, targetHandle: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!connecting || connecting.from === to) return;

    if (!isValidConnection(connecting.from, connecting.sourceHandle, to, targetHandle, nodes)) {
      setConnecting(null);
      setHoverTarget(null);
      return;
    }

    setEdges(prev => {
      const exists = prev.some(
        edge =>
          edge.from === connecting.from &&
          edge.to === to &&
          (edge.sourceHandle ?? 'data-out') === connecting.sourceHandle &&
          (edge.targetHandle ?? 'data-in') === targetHandle,
      );
      if (exists) return prev;
      return [
        ...prev,
        {
          from: connecting.from,
          to,
          sourceHandle: connecting.sourceHandle,
          targetHandle,
        },
      ];
    });
    setConnecting(null);
    setHoverTarget(null);
  }

  function removeEdge(edge: FlowEdge) {
    setEdges(prev =>
      prev.filter(
        item =>
          !(
            item.from === edge.from &&
            item.to === edge.to &&
            (item.sourceHandle ?? 'data-out') === (edge.sourceHandle ?? 'data-out') &&
            (item.targetHandle ?? 'data-in') === (edge.targetHandle ?? 'data-in')
          ),
      ),
    );
    setSelectedEdge(null);
  }

  function edgeEndpoints(a: FlowNode, b: FlowNode, edge: FlowEdge) {
    const sourceHandle = edge.sourceHandle ?? 'data-out';
    const targetHandle = edge.targetHandle ?? 'data-in';
    const start = getHandleAnchor(a, sourceHandle);
    const end = getHandleAnchor(b, targetHandle);
    return {
      x1: screenX(start.x),
      y1: screenY(start.y),
      x2: screenX(end.x),
      y2: screenY(end.y),
    };
  }

  const nodeMap = Object.fromEntries(nodes.map(node => [node.id, node]));
  const connectingNode = connecting ? nodeMap[connecting.from] : null;

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
          {(Object.keys(NODE_TYPES) as Array<keyof typeof NODE_TYPES>).map(type => (
            <filter key={type} id={`glow-${type}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          ))}
        </defs>

        {edges.map(edge => {
          const a = nodeMap[edge.from];
          const b = nodeMap[edge.to];
          if (!a || !b) return null;

          const { x1, y1, x2, y2 } = edgeEndpoints(a, b, edge);
          const path = buildEdgePath(x1, y1, x2, y2);
          const color = edgeColor(edge.sourceHandle, edge.targetHandle);
          const label = edgeHandleLabel(edge.sourceHandle, edge.targetHandle);
          const mid = bezierMidpoint(x1, y1, x2, y2);
          const edgeKey = `${edge.from}:${edge.sourceHandle ?? 'data-out'}->${edge.to}:${edge.targetHandle ?? 'data-in'}`;
          const isSelected = selectedEdge === edgeKey;
          const isHovered = hoveredEdge === edgeKey;
          const isIncomingActive = runPhases[edge.to] === 'running';
          const emphasized = isSelected || isHovered;

          return (
            <g key={edgeKey}>
              <path
                d={path}
                fill="none"
                stroke={color}
                strokeWidth={emphasized ? 2 : 1.5}
                strokeOpacity={emphasized ? 1 : 0.7}
                className={isIncomingActive ? 'edgeActive' : undefined}
                style={{ pointerEvents: 'none' }}
              />
              <text
                x={mid.x}
                y={mid.y - 6}
                fontSize={8}
                fill={color}
                textAnchor="middle"
                style={{
                  pointerEvents: 'none',
                  opacity: 0.8,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  userSelect: 'none',
                }}
              >
                {label}
              </text>
              <path
                d={path}
                fill="none"
                stroke="transparent"
                strokeWidth={18}
                style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                onMouseEnter={() => setHoveredEdge(edgeKey)}
                onMouseLeave={() => setHoveredEdge(current => (current === edgeKey ? null : current))}
                onMouseDown={e => {
                  e.stopPropagation();
                  setSelected(null);
                  setSelectedEdge(edgeKey);
                }}
                onDoubleClick={e => {
                  e.stopPropagation();
                  removeEdge(edge);
                }}
              />
              {isSelected && (
                <g
                  transform={`translate(${mid.x} ${mid.y})`}
                  style={{ cursor: 'pointer' }}
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => {
                    e.stopPropagation();
                    removeEdge(edge);
                  }}
                >
                  <circle r="10" fill="var(--panel-bg)" stroke={color} strokeWidth="1.5" />
                  <path d="M-3.5 -3.5L3.5 3.5M3.5 -3.5L-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </g>
              )}
            </g>
          );
        })}

        {connecting && connectingNode && (() => {
          const start = getHandleAnchor(connectingNode, connecting.sourceHandle);
          const x1 = screenX(start.x);
          const y1 = screenY(start.y);
          const stroke = connecting.valid
            ? edgeColor(connecting.sourceHandle)
            : '#ef4444';
          return (
            <path
              d={buildEdgePath(x1, y1, connecting.x, connecting.y)}
              fill="none"
              stroke={stroke}
              strokeWidth={2 * zoom}
              strokeDasharray="8 6"
              strokeOpacity={0.85}
            />
          );
        })()}
      </svg>

      <div style={{ position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none' }}>
        {nodes.map(node => (
          <CanvasNodeCard
            key={node.id}
            node={{ ...node, x: screenX(node.x), y: screenY(node.y) }}
            scale={zoom}
            selected={selected === node.id}
            runPhase={runPhases[node.id]}
            onMouseDown={e => startNodeDrag(e, node.id)}
            onClick={() => {
              setSelectedEdge(null);
              setSelected(selected === node.id ? null : node.id);
            }}
            onDelete={e => {
              e.stopPropagation();
              removeNode(node.id);
            }}
            edges={edges}
            onStartConnection={(e, handleId) => startConnection(e, node.id, handleId)}
            onTargetHandleHover={handleId => {
              setHoverTarget(handleId ? { nodeId: node.id, handleId } : null);
            }}
            onFinishConnection={(e, handleId) => finishConnection(e, node.id, handleId)}
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
