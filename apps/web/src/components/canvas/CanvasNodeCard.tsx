import type { FlowNode, RunPhase } from './types';
import { NODE_TYPES } from './constants';

function IcoCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <circle cx="6.5" cy="6.5" r="6" fill="#22C55E" />
      <path d="M4 6.5l2 2 3-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface CanvasNodeCardProps {
  node: FlowNode & { x: number; y: number };
  selected: boolean;
  runPhase: RunPhase | undefined;
  onMouseDown: (e: React.MouseEvent) => void;
  onClick: () => void;
}

export default function CanvasNodeCard({
  node, selected, runPhase, onMouseDown, onClick,
}: CanvasNodeCardProps) {
  const t = NODE_TYPES[node.type];
  const isRunning = runPhase === 'running';
  const isDone    = runPhase === 'done';

  return (
    <div
      onMouseDown={onMouseDown}
      onClick={onClick}
      style={{
        position: 'absolute', left: node.x, top: node.y,
        width: 200, userSelect: 'none', cursor: 'grab',
        zIndex: selected ? 20 : 10,
      }}
    >
      {/* Input handle */}
      {node.type !== 'trigger' && (
        <div style={{
          position: 'absolute', left: -5, top: '50%',
          transform: 'translateY(-50%)',
          width: 10, height: 10, borderRadius: '50%',
          background: '#0D0D0F', border: `2px solid ${t.color}`,
          boxShadow: `0 0 6px ${t.color}60`, zIndex: 2,
        }} />
      )}

      {/* Card */}
      <div style={{
        background: '#1A1A22',
        border: `1px solid ${selected ? t.color : isRunning ? t.color + '80' : '#24242E'}`,
        borderRadius: 10, padding: '11px 14px',
        display: 'flex', alignItems: 'center', gap: 11,
        position: 'relative', overflow: 'hidden',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        '--glow':  t.glowA,
        '--glow2': t.glowB,
        boxShadow: selected
          ? `0 0 0 2px ${t.color}30, 0 8px 32px rgba(0,0,0,0.6)`
          : isRunning
          ? `0 0 0 1px ${t.color}30, 0 8px 32px rgba(0,0,0,0.5)`
          : '0 4px 20px rgba(0,0,0,0.4)',
        animation: isRunning ? 'nodeRun 1.4s ease-in-out infinite' : 'none',
      } as React.CSSProperties}>

        {/* Left colour strip */}
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
          background: t.color, borderRadius: '10px 0 0 10px',
          opacity: isRunning ? 1 : selected ? 1 : 0.5,
        }} />

        {/* Icon */}
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: t.glowA, border: `1px solid ${t.color}35`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: t.color, flexShrink: 0, marginLeft: 4, position: 'relative',
        }}>
          {isDone ? (
            <div style={{ animation: 'checkDone 0.4s ease-out' }}><IcoCheck /></div>
          ) : isRunning ? (
            <span style={{
              width: 14, height: 14,
              border: `2px solid ${t.color}40`, borderTopColor: t.color,
              borderRadius: '50%', animation: 'spin 0.7s linear infinite',
              display: 'inline-block',
            }} />
          ) : (
            t.icon
          )}
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 9, fontWeight: 700, color: t.color,
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3,
          }}>
            {t.label}
          </div>
          <div style={{
            fontSize: 12, fontWeight: 600, color: '#F0F0F5',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {node.label}
          </div>
          {node.subtitle && (
            <div style={{
              fontSize: 10, color: '#555566', marginTop: 1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {node.subtitle}
            </div>
          )}
        </div>

        {/* Running pulse */}
        {isRunning && (
          <div style={{ position: 'absolute', top: 7, right: 9 }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%',
              background: t.color, animation: 'pulseGlow 0.8s infinite',
              display: 'inline-block',
            }} />
          </div>
        )}
      </div>

      {/* Output handle */}
      {node.type !== 'output' && (
        <div style={{
          position: 'absolute', right: -5, top: '50%',
          transform: 'translateY(-50%)',
          width: 10, height: 10, borderRadius: '50%',
          background: '#0D0D0F', border: `2px solid ${t.color}`,
          boxShadow: `0 0 6px ${t.color}60`, zIndex: 2,
        }} />
      )}
    </div>
  );
}
