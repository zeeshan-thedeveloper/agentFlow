import { useState, useRef, useEffect } from 'react';
import type { RunState } from './types';

interface TopBarProps {
  name: string;
  setName: (name: string) => void;
  runState: RunState;
  onRun: () => void;
  saved: boolean;
  onSave: () => void;
}

export default function TopBar({ name, setName, runState, onRun, saved, onSave }: TopBarProps) {
  const [editingName, setEditingName] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingName) inputRef.current?.select();
  }, [editingName]);

  const statusStyle =
    runState === 'running'
      ? { borderColor: 'rgba(108,99,255,0.4)', background: 'rgba(108,99,255,0.1)', color: '#8B87FF' }
      : runState === 'success'
      ? { borderColor: 'rgba(34,197,94,0.4)', background: 'rgba(34,197,94,0.1)', color: '#4ade80' }
      : { borderColor: '#2A2A35', background: 'transparent', color: '#888899' };

  return (
    <div style={{
      height: 52, background: '#12121A', borderBottom: '1px solid #1E1E28',
      display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12,
      flexShrink: 0, zIndex: 100,
    }}>
      {/* ── Logo ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginRight: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'rgba(108,99,255,0.2)', border: '1px solid rgba(108,99,255,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1.5C4 1.5 1.5 4 1.5 7S4 12.5 7 12.5 12.5 10 12.5 7 10 1.5 7 1.5z"
              stroke="#8B87FF" strokeWidth="1.2" />
            <path d="M4.5 7h2m0 0V4.5m0 2.5L9 4.5"
              stroke="#8B87FF" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#F0F0F5', letterSpacing: '-0.02em' }}>
          AgentFlow
        </span>
      </div>

      <div style={{ width: 1, height: 20, background: '#1E1E28' }} />

      {/* ── Workflow name + status pill ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        {editingName ? (
          <input
            ref={inputRef}
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={() => setEditingName(false)}
            onKeyDown={e => { if (e.key === 'Enter') setEditingName(false); }}
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              fontSize: 13, fontWeight: 500, color: '#F0F0F5',
              textAlign: 'center', minWidth: 180, fontFamily: 'inherit',
            }}
          />
        ) : (
          <button
            onClick={() => setEditingName(true)}
            style={{
              background: 'none', border: 'none', cursor: 'text',
              fontSize: 13, fontWeight: 500, color: '#F0F0F5',
              padding: '3px 8px', borderRadius: 5, fontFamily: 'inherit',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
          >
            {name}
          </button>
        )}

        {/* Status pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '3px 9px', borderRadius: 99, border: '1px solid',
          fontSize: 10, fontWeight: 500, ...statusStyle,
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%',
            background: 'currentColor', display: 'inline-block',
            animation: runState === 'running' ? 'pulseGlow 1s infinite' : 'none',
          }} />
          {runState === 'running' ? 'Running' : runState === 'success' ? 'Success' : 'Draft'}
        </div>
      </div>

      {/* ── Actions ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          style={{
            padding: '6px 13px', borderRadius: 7, background: 'transparent',
            border: '1px solid #2A2A35', color: '#888899',
            fontSize: 12, fontWeight: 500, cursor: 'pointer',
            fontFamily: 'inherit', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#3A3A48'; e.currentTarget.style.color = '#C0C0CF'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#2A2A35'; e.currentTarget.style.color = '#888899'; }}
        >
          Share
        </button>

        <button
          onClick={onSave}
          style={{
            padding: '6px 13px', borderRadius: 7, background: 'transparent',
            border: '1px solid #2A2A35', color: saved ? '#4ade80' : '#888899',
            fontSize: 12, fontWeight: 500, cursor: 'pointer',
            fontFamily: 'inherit', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#3A3A48'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#2A2A35'; }}
        >
          {saved ? '✓ Saved' : 'Save'}
        </button>

        <button
          onClick={onRun}
          disabled={runState === 'running'}
          style={{
            padding: '6px 16px', borderRadius: 7,
            background: runState === 'running' ? 'rgba(108,99,255,0.3)' : '#6C63FF',
            border: '1px solid',
            borderColor: runState === 'running' ? 'rgba(108,99,255,0.5)' : '#8B87FF',
            color: '#fff', fontSize: 12, fontWeight: 600,
            cursor: runState === 'running' ? 'default' : 'pointer',
            fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 7,
            transition: 'all 0.15s',
            boxShadow: runState === 'running' ? 'none' : '0 2px 12px rgba(108,99,255,0.35)',
          }}
          onMouseEnter={e => { if (runState !== 'running') e.currentTarget.style.background = '#7C74FF'; }}
          onMouseLeave={e => { if (runState !== 'running') e.currentTarget.style.background = '#6C63FF'; }}
        >
          {runState === 'running' ? (
            <>
              <span style={{
                width: 11, height: 11,
                border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
                borderRadius: '50%', animation: 'spin 0.7s linear infinite',
                display: 'inline-block',
              }} />
              Running
            </>
          ) : (
            <>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <path d="M2 1.5l6 3.5-6 3.5V1.5z" />
              </svg>
              Run
            </>
          )}
        </button>
      </div>
    </div>
  );
}
