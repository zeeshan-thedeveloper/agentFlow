import { useState } from 'react';
import type { FlowEdge, FlowNode, RunPhase } from './types';
import { NODE_TYPES } from './constants';
import TypedNodeHandles from './TypedNodeHandles';

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
  scale?: number;
  onMouseDown: (e: React.MouseEvent) => void;
  onClick: () => void;
  onDelete?: (e: React.MouseEvent) => void;
  edges: FlowEdge[];
  onStartConnection: (e: React.MouseEvent, handleId: string) => void;
  onFinishConnection: (e: React.MouseEvent, handleId: string) => void;
  onTargetHandleHover?: (handleId: string | null) => void;
}

function IcoFailed() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <circle cx="6.5" cy="6.5" r="6" fill="#EF4444" />
      <path d="M4.4 4.4l4.2 4.2M8.6 4.4 4.4 8.6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function CanvasNodeCard({
  node,
  selected,
  runPhase,
  scale = 1,
  onMouseDown,
  onClick,
  onDelete,
  edges,
  onStartConnection,
  onFinishConnection,
  onTargetHandleHover,
}: CanvasNodeCardProps) {
  const TOOL_LABELS: Record<string, string> = {
    http_request: 'HTTP',
    web_search: 'Search',
    scrape_page: 'Scrape',
  };
  const [hovered, setHovered] = useState(false);
  const t = NODE_TYPES[node.type as keyof typeof NODE_TYPES] ?? NODE_TYPES.integration;
  const showDelete = selected || hovered;
  const isQueued = runPhase === 'queued';
  const isRunning = runPhase === 'running';
  const isDone    = runPhase === 'done';
  const isFailed  = runPhase === 'failed';
  const isSchemaNode = node.type === 'schema';
  const isQueryRunnerNode = node.type === 'query-runner';
  const isDatabaseNode = node.type === 'integration' && node.integrationId?.startsWith('database');
  const subtitle = isSchemaNode
    ? node.connectionName || 'Select connection'
    : isQueryRunnerNode
    ? node.connectionName || 'Select connection'
    : isDatabaseNode
    ? node.connectionName || node.integrationId?.split(':').pop() || 'Select connection'
    : node.subtitle;

  return (
    <div
      onMouseDown={onMouseDown}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute', left: node.x, top: node.y,
        width: 200, userSelect: 'none', cursor: 'grab',
        zIndex: selected ? 20 : 10,
        pointerEvents: 'auto',
        overflow: 'visible',
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
      }}
    >
      {isRunning && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: -8,
            borderRadius: 16,
            border: `1px solid ${t.color}70`,
            boxShadow: `0 0 0 1px ${t.color}20, 0 0 34px ${t.glowA}`,
            animation: 'nodeActiveHalo 1.1s ease-in-out infinite',
            pointerEvents: 'none',
          }}
        />
      )}

      <TypedNodeHandles
        node={node}
        edges={edges}
        onStartConnection={onStartConnection}
        onFinishConnection={onFinishConnection}
        onTargetHandleHover={onTargetHandleHover}
      />

      {/* Card */}
      <div style={{
        background: 'var(--card-wash), var(--panel-bg-strong)',
        border: `1px solid ${selected ? t.color : isFailed ? '#EF444480' : isRunning ? t.color : isQueued ? t.color + '35' : 'var(--border-strong)'}`,
        borderRadius: 10, padding: '11px 14px',
        display: 'flex', alignItems: 'center', gap: 11,
        position: 'relative', overflow: 'hidden',
        transition: 'border-color 0.2s, box-shadow 0.2s, opacity 0.2s',
        opacity: isQueued ? 0.72 : 1,
        '--glow':  t.glowA,
        '--glow2': t.glowB,
        boxShadow: selected
          ? `0 0 0 2px ${t.color}30, 0 8px 32px var(--shadow-node-strong)`
          : isFailed
          ? '0 0 0 1px rgba(239,68,68,0.25), 0 8px 32px var(--shadow-node)'
          : isRunning
          ? `0 0 0 1px ${t.color}55, 0 8px 32px var(--shadow-node), 0 0 36px ${t.glowA}`
          : isQueued
          ? `0 0 0 1px ${t.color}12, 0 8px 26px var(--shadow-node)`
          : 'inset 0 1px 0 rgba(255,255,255,0.05), 0 10px 30px var(--shadow-node)',
        animation: isRunning ? 'nodeRun 1.4s ease-in-out infinite' : 'none',
      } as React.CSSProperties}>
        {showDelete && onDelete && (
          <button
            type="button"
            title="Delete node"
            aria-label="Delete node"
            onMouseDown={e => e.stopPropagation()}
            onClick={onDelete}
            style={{
              position: 'absolute', top: 7, right: 8,
              width: 22, height: 22, borderRadius: 6,
              border: '1px solid rgba(239,68,68,0.45)',
              background: selected ? 'rgba(239,68,68,0.12)' : 'var(--button-bg)',
              color: '#ef4444',
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
          opacity: isRunning || isFailed ? 1 : selected ? 1 : 0.5,
        }} />

        {/* Icon */}
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: t.glowA, border: `1px solid ${t.color}35`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: t.color, flexShrink: 0, marginLeft: 4, position: 'relative',
        }}>
          {isFailed ? (
            <div style={{ animation: 'checkDone 0.4s ease-out' }}><IcoFailed /></div>
          ) : isDone ? (
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
          {subtitle && (
            <div style={{
              fontSize: 10, color: 'var(--text-faint)', marginTop: 1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {subtitle}
            </div>
          )}
          {node.type === 'agent' && node.tools && node.tools.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 5 }}>
              {node.tools.map(toolName => (
                <span
                  key={toolName}
                  style={{
                    fontSize: 8,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: '#6C63FF',
                    background: 'rgba(108,99,255,0.12)',
                    border: '1px solid rgba(108,99,255,0.25)',
                    borderRadius: 4,
                    padding: '1px 5px',
                    lineHeight: 1.6,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {TOOL_LABELS[toolName] ?? toolName}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Running pulse */}
        {(isQueued || isRunning) && (
          <div style={{
            position: 'absolute', right: 8, bottom: 7,
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '2px 6px', borderRadius: 99,
            background: isRunning ? t.glowA : 'rgba(255,255,255,0.04)',
            border: `1px solid ${isRunning ? t.color + '55' : 'var(--border-subtle)'}`,
            color: isRunning ? t.color : 'var(--text-faint)',
            fontSize: 9, fontWeight: 700, lineHeight: 1,
          }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%',
              background: 'currentColor',
              animation: isRunning ? 'pulseGlow 0.8s infinite' : 'none',
              display: 'inline-block',
            }} />
            {isRunning ? 'Running' : 'Queued'}
          </div>
        )}

        {isRunning && (
          <div style={{
            position: 'absolute', left: 3, right: 0, bottom: 0, height: 2,
            background: `linear-gradient(90deg, transparent, ${t.color}, transparent)`,
            animation: 'nodeProgressSweep 1s linear infinite',
          }} />
        )}
      </div>

    </div>
  );
}
