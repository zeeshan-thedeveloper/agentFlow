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
  onDelete?: (e: React.MouseEvent) => void;
  onInputHandleMouseUp?: (e: React.MouseEvent) => void;
  onOutputHandleMouseDown?: (e: React.MouseEvent) => void;
}

export default function CanvasNodeCard({
  node, selected, runPhase, onMouseDown, onClick, onDelete, onInputHandleMouseUp, onOutputHandleMouseDown,
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
        <div
          onMouseDown={e => e.stopPropagation()}
          onMouseUp={onInputHandleMouseUp}
          title="Connect here"
          style={{
            position: 'absolute', left: -7, top: '50%',
            transform: 'translateY(-50%)',
            width: 14, height: 14, borderRadius: '50%',
            background: 'var(--app-bg)', border: `2px solid ${t.color}`,
            boxShadow: `0 0 6px ${t.color}60`, zIndex: 3,
            cursor: 'crosshair',
          }}
        />
      )}

      {/* Card */}
      <div style={{
        background: 'var(--card-wash), var(--panel-bg-strong)',
        border: `1px solid ${selected ? t.color : isRunning ? t.color + '80' : 'var(--border-strong)'}`,
        borderRadius: 10, padding: '11px 14px',
        display: 'flex', alignItems: 'center', gap: 11,
        position: 'relative', overflow: 'hidden',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        '--glow':  t.glowA,
        '--glow2': t.glowB,
        boxShadow: selected
          ? `0 0 0 2px ${t.color}30, 0 8px 32px var(--shadow-node-strong)`
          : isRunning
          ? `0 0 0 1px ${t.color}30, 0 8px 32px var(--shadow-node)`
          : 'inset 0 1px 0 rgba(255,255,255,0.05), 0 10px 30px var(--shadow-node)',
        animation: isRunning ? 'nodeRun 1.4s ease-in-out infinite' : 'none',
      } as React.CSSProperties}>
        {selected && (
          <button
            type="button"
            title="Delete node"
            onMouseDown={e => e.stopPropagation()}
            onClick={onDelete}
            style={{
              position: 'absolute', top: 7, right: 8,
              width: 22, height: 22, borderRadius: 6,
              border: '1px solid var(--border-strong)',
              background: 'var(--button-bg)', color: 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', zIndex: 4,
            }}
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M2.5 2.5l6 6M8.5 2.5l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        )}

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
            fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {node.label}
          </div>
          {node.subtitle && (
            <div style={{
              fontSize: 10, color: 'var(--text-faint)', marginTop: 1,
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
        <div
          onMouseDown={onOutputHandleMouseDown}
          title="Drag to connect"
          style={{
            position: 'absolute', right: -7, top: '50%',
            transform: 'translateY(-50%)',
            width: 14, height: 14, borderRadius: '50%',
            background: 'var(--app-bg)', border: `2px solid ${t.color}`,
            boxShadow: `0 0 6px ${t.color}60`, zIndex: 3,
            cursor: 'crosshair',
          }}
        />
      )}
    </div>
  );
}
