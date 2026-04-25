import { useState, useRef } from 'react';
import type { FlowNode, FlowEdge, RunPhasesMap } from './types';
import { NODE_TYPES, NW, NH } from './constants';
import CanvasNodeCard from './CanvasNodeCard';

interface CanvasBoardProps {
  nodes: FlowNode[];
  setNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  edges: FlowEdge[];
  selected: string | null;
  setSelected: (id: string | null) => void;
  runPhases: RunPhasesMap;
}

interface DragState {
  id: string;
  sx: number; sy: number;
  ox: number; oy: number;
}

interface PanState {
  sx: number; sy: number;
}

export default function CanvasBoard({
  nodes, setNodes, edges, selected, setSelected, runPhases,
}: CanvasBoardProps) {
  const [pan, setPan]         = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [panning, setPanning]   = useState<PanState | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  function startNodeDrag(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    const n = nodes.find(n => n.id === id);
    if (!n) return;
    setDragging({ id, sx: e.clientX, sy: e.clientY, ox: n.x, oy: n.y });
  }

  function onBgDown(e: React.MouseEvent) {
    const tag = (e.target as HTMLElement).tagName.toLowerCase();
    if (e.target === ref.current || ['svg', 'path', 'circle', 'rect', 'g'].includes(tag)) {
      setSelected(null);
      setPanning({ sx: e.clientX - pan.x, sy: e.clientY - pan.y });
    }
  }

  function onMouseMove(e: React.MouseEvent) {
    if (dragging) {
      const dx = e.clientX - dragging.sx, dy = e.clientY - dragging.sy;
      setNodes(p => p.map(n =>
        n.id === dragging.id ? { ...n, x: dragging.ox + dx, y: dragging.oy + dy } : n,
      ));
    }
    if (panning) setPan({ x: e.clientX - panning.sx, y: e.clientY - panning.sy });
  }

  function onMouseUp() { setDragging(null); setPanning(null); }

  function edgePath(a: FlowNode, b: FlowNode): string {
    const x1 = a.x + NW + pan.x, y1 = a.y + NH / 2 + pan.y;
    const x2 = b.x + pan.x,      y2 = b.y + NH / 2 + pan.y;
    const cx = Math.max(60, (x2 - x1) * 0.45);
    return `M ${x1} ${y1} C ${x1 + cx} ${y1} ${x2 - cx} ${y2} ${x2} ${y2}`;
  }

  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

  return (
    <div
      ref={ref}
      onMouseDown={onBgDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      style={{
        flex: 1, position: 'relative', overflow: 'hidden',
        cursor: panning ? 'grabbing' : 'default',
        backgroundImage: 'radial-gradient(circle, #22222E 1px, transparent 1px)',
        backgroundSize: '26px 26px',
        backgroundPosition: `${pan.x % 26}px ${pan.y % 26}px`,
      }}
    >
      {/* Vignette */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
        background: 'radial-gradient(ellipse at center, transparent 60%, rgba(13,13,15,0.5) 100%)',
      }} />

      {/* SVG edges */}
      <svg style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 3,
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
          const a = nodeMap[edge.from], b = nodeMap[edge.to];
          if (!a || !b) return null;
          const t = NODE_TYPES[a.type];
          const path = edgePath(a, b);
          const isActive =
            runPhases[edge.from] === 'running' || runPhases[edge.from] === 'done';

          return (
            <g key={`${edge.from}-${edge.to}`}>
              {/* Glow layer */}
              <path d={path} fill="none" stroke={t.color}
                strokeWidth={isActive ? 6 : 3}
                strokeOpacity={isActive ? 0.18 : 0.07}
                filter={`url(#glow-${a.type})`} />
              {/* Base line */}
              <path d={path} fill="none" stroke={t.color}
                strokeWidth={1.5} strokeOpacity={isActive ? 0.7 : 0.3} />
              {/* Animated dash */}
              <path d={path} fill="none" stroke={t.color}
                strokeWidth={1.5} strokeOpacity={isActive ? 1 : 0.4}
                strokeDasharray="12 8"
                style={{ animation: `flowEdge ${isActive ? 0.9 : 1.8}s linear infinite` }} />
              {/* Arrow dot at target */}
              <circle
                cx={b.x + pan.x}
                cy={b.y + NH / 2 + pan.y}
                r={3} fill={t.color} opacity={isActive ? 0.9 : 0.4} />
            </g>
          );
        })}
      </svg>

      {/* Nodes */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 5 }}>
        {nodes.map(n => (
          <CanvasNodeCard
            key={n.id}
            node={{ ...n, x: n.x + pan.x, y: n.y + pan.y }}
            selected={selected === n.id}
            runPhase={runPhases[n.id]}
            onMouseDown={e => startNodeDrag(e, n.id)}
            onClick={() => setSelected(selected === n.id ? null : n.id)}
          />
        ))}
      </div>

      {/* Mini controls (bottom-right) */}
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
              border: '1px solid #2A2A35', background: 'rgba(18,18,26,0.9)',
              color: '#888899', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#3A3A48'; e.currentTarget.style.color = '#C0C0CF'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#2A2A35'; e.currentTarget.style.color = '#888899'; }}
          >
            {btn.icon}
          </button>
        ))}
      </div>

      {/* Node / edge count */}
      <div style={{ position: 'absolute', bottom: 20, left: 20, fontSize: 11, color: '#555566', zIndex: 20 }}>
        {nodes.length} nodes · {edges.length} edges
      </div>
    </div>
  );
}
