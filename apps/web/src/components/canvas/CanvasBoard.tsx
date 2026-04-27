import { useCallback, useEffect, useRef, useState } from 'react';
import type { FlowNode, FlowEdge, RunPhasesMap } from './types';
import { NODE_TYPES, NW, NH } from './constants';
import CanvasNodeCard from './CanvasNodeCard';

interface CanvasBoardProps {
  nodes: FlowNode[];
  setNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  edges: FlowEdge[];
  setEdges: React.Dispatch<React.SetStateAction<FlowEdge[]>>;
  selected: string | null;
  setSelected: (id: string | null) => void;
  runPhases: RunPhasesMap;
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
  x: number;
  y: number;
}

export default function CanvasBoard({
  nodes, setNodes, edges, setEdges, selected, setSelected, runPhases,
}: CanvasBoardProps) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [panning, setPanning] = useState<PanState | null>(null);
  const [connecting, setConnecting] = useState<ConnectState | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  function getCanvasPoint(e: Pick<React.MouseEvent, 'clientX' | 'clientY'>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return { x: e.clientX, y: e.clientY };

    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  const removeNode = useCallback((id: string) => {
    setNodes(prev => prev.filter(node => node.id !== id));
    setEdges(prev => prev.filter(edge => edge.from !== id && edge.to !== id));
    setSelected(null);
    setSelectedEdge(null);
    setDragging(current => current?.id === id ? null : current);
    setConnecting(current => current?.from === id ? null : current);
  }, [setEdges, setNodes, setSelected]);

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
        const [from, to] = selectedEdge.split('->');
        setEdges(prev => prev.filter(edge => edge.from !== from || edge.to !== to));
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
      setConnecting(current => current ? { ...current, ...point } : null);
      return;
    }

    if (dragging) {
      const dx = e.clientX - dragging.sx;
      const dy = e.clientY - dragging.sy;
      setNodes(prev => prev.map(node =>
        node.id === dragging.id ? { ...node, x: dragging.ox + dx, y: dragging.oy + dy } : node,
      ));
    }

    if (panning) setPan({ x: e.clientX - panning.sx, y: e.clientY - panning.sy });
  }

  function onMouseUp() {
    setDragging(null);
    setPanning(null);
    setConnecting(null);
  }

  function startConnection(e: React.MouseEvent, from: string) {
    e.preventDefault();
    e.stopPropagation();
    const point = getCanvasPoint(e);
    setSelected(null);
    setSelectedEdge(null);
    setDragging(null);
    setPanning(null);
    setConnecting({ from, ...point });
  }

  function finishConnection(e: React.MouseEvent, to: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!connecting || connecting.from === to) return;

    setEdges(prev => {
      const exists = prev.some(edge => edge.from === connecting.from && edge.to === to);
      if (exists) return prev;
      return [...prev, { from: connecting.from, to }];
    });
    setConnecting(null);
  }

  function removeEdge(edge: FlowEdge) {
    setEdges(prev => prev.filter(item => item.from !== edge.from || item.to !== edge.to));
    setSelectedEdge(null);
  }

  function edgePath(a: FlowNode, b: FlowNode): string {
    const x1 = a.x + NW + pan.x;
    const y1 = a.y + NH / 2 + pan.y;
    const x2 = b.x + pan.x;
    const y2 = b.y + NH / 2 + pan.y;
    const cx = Math.max(60, (x2 - x1) * 0.45);
    return `M ${x1} ${y1} C ${x1 + cx} ${y1} ${x2 - cx} ${y2} ${x2} ${y2}`;
  }

  function edgeControlPosition(a: FlowNode, b: FlowNode) {
    const x1 = a.x + NW + pan.x;
    const y1 = a.y + NH / 2 + pan.y;
    const x2 = b.x + pan.x;
    const y2 = b.y + NH / 2 + pan.y;
    const cx = Math.max(60, (x2 - x1) * 0.45);
    const c1x = x1 + cx;
    const c2x = x2 - cx;
    const t = 0.5;
    const mt = 1 - t;

    return {
      x: mt ** 3 * x1 + 3 * mt ** 2 * t * c1x + 3 * mt * t ** 2 * c2x + t ** 3 * x2,
      y: mt ** 3 * y1 + 3 * mt ** 2 * t * y1 + 3 * mt * t ** 2 * y2 + t ** 3 * y2,
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
        backgroundSize: 'auto, 26px 26px',
        backgroundPosition: `center, ${pan.x % 26}px ${pan.y % 26}px`,
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

          const t = NODE_TYPES[a.type];
          const path = edgePath(a, b);
          const edgeKey = `${edge.from}->${edge.to}`;
          const isSelected = selectedEdge === edgeKey;
          const isActive = runPhases[edge.from] === 'running' || runPhases[edge.from] === 'done';
          const control = edgeControlPosition(a, b);

          return (
            <g key={edgeKey}>
              <path d={path} fill="none" stroke={t.color}
                strokeWidth={isSelected ? 7 : isActive ? 6 : 3}
                strokeOpacity={isSelected ? 0.28 : isActive ? 0.18 : 0.07}
                filter={`url(#glow-${a.type})`}
                style={{ pointerEvents: 'none' }} />
              <path d={path} fill="none" stroke={t.color}
                strokeWidth={isSelected ? 2.5 : 1.5}
                strokeOpacity={isSelected ? 0.95 : isActive ? 0.7 : 0.3}
                style={{ pointerEvents: 'none' }} />
              <path d={path} fill="none" stroke={t.color}
                strokeWidth={1.5} strokeOpacity={isActive ? 1 : 0.4}
                strokeDasharray="12 8"
                style={{ animation: `flowEdge ${isActive ? 0.9 : 1.8}s linear infinite`, pointerEvents: 'none' }} />
              <circle
                cx={b.x + pan.x}
                cy={b.y + NH / 2 + pan.y}
                r={isSelected ? 4 : 3} fill={t.color} opacity={isActive || isSelected ? 0.9 : 0.4}
                style={{ pointerEvents: 'none' }} />
              <path
                d={path}
                fill="none"
                stroke="transparent"
                strokeWidth={18}
                style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
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
                  transform={`translate(${control.x} ${control.y})`}
                  style={{ cursor: 'pointer' }}
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => {
                    e.stopPropagation();
                    removeEdge(edge);
                  }}
                >
                  <circle r="10" fill="var(--panel-bg)" stroke={t.color} strokeWidth="1.5" />
                  <path d="M-3.5 -3.5L3.5 3.5M3.5 -3.5L-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </g>
              )}
            </g>
          );
        })}

        {connecting && connectingNode && (
          <path
            d={`M ${connectingNode.x + NW + pan.x} ${connectingNode.y + NH / 2 + pan.y} C ${connectingNode.x + NW + pan.x + 80} ${connectingNode.y + NH / 2 + pan.y} ${connecting.x - 80} ${connecting.y} ${connecting.x} ${connecting.y}`}
            fill="none"
            stroke={NODE_TYPES[connectingNode.type].color}
            strokeWidth={2}
            strokeDasharray="8 6"
            strokeOpacity={0.85}
          />
        )}
      </svg>

      <div style={{ position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none' }}>
        {nodes.map(node => (
          <CanvasNodeCard
            key={node.id}
            node={{ ...node, x: node.x + pan.x, y: node.y + pan.y }}
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
            onInputHandleMouseUp={e => finishConnection(e, node.id)}
            onOutputHandleMouseDown={e => startConnection(e, node.id)}
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
            action: undefined,
          },
          {
            label: 'Zoom out',
            icon: <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>,
            action: undefined,
          },
          {
            label: 'Fit',
            icon: <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M3 1H1v2M7 1h2v2M1 7v2h2M9 7v2H7"
                stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>,
            action: () => setPan({ x: 0, y: 0 }),
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
        {nodes.length} nodes - {edges.length} edges
      </div>
    </div>
  );
}
