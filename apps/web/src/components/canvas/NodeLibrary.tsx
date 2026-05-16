import { useState } from 'react';
import type { LibraryNodeType } from './types';
import { NODE_TYPES } from './constants';

const ACTIVE_NODE_TYPES: LibraryNodeType[] = ['trigger', 'agent', 'database', 'output'];

interface NodeLibraryProps {
  onAddNode: (type: LibraryNodeType) => void;
}

export default function NodeLibrary({ onAddNode }: NodeLibraryProps) {
  return (
    <div style={{
      width: 220, background: 'var(--panel-wash), var(--panel-bg)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      boxShadow: 'inset -1px 0 0 var(--border-strong)',
    }}>
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{
          fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          Node Library
        </div>
      </div>

      <div style={{
        flex: 1, overflowY: 'auto', padding: 10,
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        {ACTIVE_NODE_TYPES.map(type => (
          <LibNode key={type} type={type} onAdd={() => onAddNode(type)} />
        ))}
      </div>
    </div>
  );
}

function LibNode({ type, onAdd }: { type: LibraryNodeType; onAdd: () => void }) {
  const [hover, setHover] = useState(false);
  const cfg = NODE_TYPES[type];

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        borderRadius: 8,
        border: `1px solid ${hover ? cfg.color + '70' : 'var(--border-subtle)'}`,
        background: hover ? cfg.glowB : 'rgba(255,255,255,0.015)',
        padding: '10px 12px', cursor: 'grab',
        boxShadow: hover ? `0 0 0 1px ${cfg.color}20, 0 10px 24px var(--shadow-node)` : 'inset 0 1px 0 rgba(255,255,255,0.035)',
        transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 10,
      }}
    >
      <div style={{
        width: 30, height: 30, borderRadius: 8,
        background: cfg.glowA, border: `1px solid ${cfg.color}40`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: cfg.color, flexShrink: 0,
      }}>
        {cfg.icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{cfg.label}</div>
        <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>{cfg.lib.desc}</div>
      </div>

      <button
        onClick={onAdd}
        style={{
          width: 22, height: 22, borderRadius: 5, border: '1px solid var(--border-strong)',
          background: 'transparent', color: 'var(--text-faint)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: hover ? 1 : 0, transition: 'opacity 0.15s', flexShrink: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = cfg.color; e.currentTarget.style.color = cfg.color; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-faint)'; }}
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
