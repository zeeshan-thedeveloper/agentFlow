import { useState } from 'react';
import type { NodeType } from './types';
import { NODE_TYPES } from './constants';

interface NodeLibraryProps {
  onAddNode: (type: NodeType) => void;
}

export default function NodeLibrary({ onAddNode }: NodeLibraryProps) {
  return (
    <div style={{
      width: 220, background: '#12121A',
      borderRight: '1px solid #1E1E28',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #1E1E28' }}>
        <div style={{
          fontSize: 10, fontWeight: 600, color: '#888899',
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          Node Library
        </div>
      </div>

      <div style={{
        flex: 1, overflowY: 'auto', padding: 10,
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        {(Object.keys(NODE_TYPES) as NodeType[]).map(type => (
          <LibNode key={type} type={type} onAdd={() => onAddNode(type)} />
        ))}

        {/* Templates */}
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #1E1E28' }}>
          <div style={{
            fontSize: 10, fontWeight: 600, color: '#888899',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            marginBottom: 8, paddingLeft: 4,
          }}>
            Templates
          </div>
          {['GitHub Monitor', 'PR Reviewer', 'Issue Triage', 'Deploy Guard'].map(t => (
            <button
              key={t}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                padding: '8px 10px', borderRadius: 7, border: 'none',
                background: 'transparent', color: '#888899', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 12, marginBottom: 2,
                transition: 'all 0.12s', textAlign: 'left',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#C0C0CF'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#888899'; }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="1.5" y="1.5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
                <path d="M3.5 6h5M3.5 4h5M3.5 8h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
              </svg>
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function LibNode({ type, onAdd }: { type: NodeType; onAdd: () => void }) {
  const [hover, setHover] = useState(false);
  const cfg = NODE_TYPES[type];

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        borderRadius: 8,
        border: `1px solid ${hover ? cfg.color + '50' : '#1E1E28'}`,
        background: hover ? cfg.glowB : 'transparent',
        padding: '10px 12px', cursor: 'grab',
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
        <div style={{ fontSize: 12, fontWeight: 600, color: '#E0E0EF', marginBottom: 2 }}>{cfg.label}</div>
        <div style={{ fontSize: 10, color: '#555566' }}>{cfg.lib.desc}</div>
      </div>

      <button
        onClick={onAdd}
        style={{
          width: 22, height: 22, borderRadius: 5, border: '1px solid #2A2A35',
          background: 'transparent', color: '#555566', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: hover ? 1 : 0, transition: 'opacity 0.15s', flexShrink: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = cfg.color; e.currentTarget.style.color = cfg.color; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#2A2A35'; e.currentTarget.style.color = '#555566'; }}
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
