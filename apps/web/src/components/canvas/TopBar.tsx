'use client';

import { useEffect, useRef, useState } from 'react';
import { signOut } from 'next-auth/react';
import ThemeToggle from '@/components/ThemeToggle';
import type { RunState } from './types';

interface TopBarProps {
  name: string;
  setName: (name: string) => void;
  runState: RunState;
  onRun: () => void;
  saved: boolean;
  onSave: () => void;
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export default function TopBar({ name, setName, runState, onRun, saved, onSave, user }: TopBarProps) {
  const [editingName, setEditingName] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const displayName = user.name ?? user.email ?? 'Signed in';
  const initials = displayName
    .split(/\s+/)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    if (editingName) inputRef.current?.select();
  }, [editingName]);

  const statusStyle =
    runState === 'running'
      ? { borderColor: 'rgba(108,99,255,0.4)', background: 'rgba(108,99,255,0.1)', color: 'var(--brand-text)' }
      : runState === 'success'
      ? { borderColor: 'rgba(34,197,94,0.4)', background: 'rgba(34,197,94,0.1)', color: 'var(--success-text)' }
      : { borderColor: 'var(--border-strong)', background: 'transparent', color: 'var(--text-muted)' };

  return (
    <div style={{
      height: 52, background: 'var(--panel-wash), var(--panel-bg)', borderBottom: '1px solid var(--border-subtle)',
      display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12,
      flexShrink: 0, zIndex: 100, boxShadow: 'inset 0 -1px 0 var(--border-strong)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginRight: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'var(--brand-soft)', border: '1px solid rgba(108,99,255,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1.5C4 1.5 1.5 4 1.5 7S4 12.5 7 12.5 12.5 10 12.5 7 10 1.5 7 1.5z"
              stroke="var(--brand-text)" strokeWidth="1.2" />
            <path d="M4.5 7h2m0 0V4.5m0 2.5L9 4.5"
              stroke="var(--brand-text)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: 0 }}>
          AgentFlow
        </span>
      </div>

      <div style={{ width: 1, height: 20, background: 'var(--border-subtle)' }} />

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
              fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
              textAlign: 'center', minWidth: 180, fontFamily: 'inherit',
            }}
          />
        ) : (
          <button
            onClick={() => setEditingName(true)}
            style={{
              background: 'none', border: 'none', cursor: 'text',
              fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
              padding: '3px 8px', borderRadius: 5, fontFamily: 'inherit',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
          >
            {name}
          </button>
        )}

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

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          style={{
            padding: '6px 13px', borderRadius: 7, background: 'transparent',
            border: '1px solid var(--border-strong)', color: 'var(--text-muted)',
            fontSize: 12, fontWeight: 500, cursor: 'pointer',
            fontFamily: 'inherit', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          Share
        </button>

        <button
          onClick={onSave}
          style={{
            padding: '6px 13px', borderRadius: 7, background: 'transparent',
            border: '1px solid var(--border-strong)', color: saved ? 'var(--success-text)' : 'var(--text-muted)',
            fontSize: 12, fontWeight: 500, cursor: 'pointer',
            fontFamily: 'inherit', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
        >
          {saved ? 'Saved' : 'Save'}
        </button>

        <button
          onClick={onRun}
          disabled={runState === 'running'}
          style={{
            padding: '6px 16px', borderRadius: 7,
            background: runState === 'running' ? 'rgba(108,99,255,0.3)' : 'var(--brand)',
            border: '1px solid',
            borderColor: runState === 'running' ? 'rgba(108,99,255,0.5)' : 'var(--brand-text)',
            color: 'var(--text-inverse)', fontSize: 12, fontWeight: 600,
            cursor: runState === 'running' ? 'default' : 'pointer',
            fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 7,
            transition: 'all 0.15s',
            boxShadow: runState === 'running' ? 'none' : '0 2px 12px rgba(108,99,255,0.35)',
          }}
          onMouseEnter={e => { if (runState !== 'running') e.currentTarget.style.background = 'var(--brand-hover)'; }}
          onMouseLeave={e => { if (runState !== 'running') e.currentTarget.style.background = 'var(--brand)'; }}
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

        <ThemeToggle compact />

        <div style={{ width: 1, height: 24, background: 'var(--border-subtle)', margin: '0 2px' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          {user.image ? (
            <img
              src={user.image}
              alt=""
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: '1px solid var(--border-strong)',
                objectFit: 'cover',
              }}
            />
          ) : (
            <div
              aria-hidden="true"
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: '1px solid var(--border-strong)',
                background: 'var(--surface-muted)',
                color: 'var(--text-secondary)',
                display: 'grid',
                placeItems: 'center',
                fontSize: 10,
                fontWeight: 800,
              }}
            >
              {initials}
            </div>
          )}

          <div style={{ display: 'grid', gap: 1, maxWidth: 170, minWidth: 0 }}>
            <span style={{
              color: 'var(--text-primary)',
              fontSize: 12,
              fontWeight: 700,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {displayName}
            </span>
            {user.email && (
              <span style={{
                color: 'var(--text-faint)',
                fontSize: 10,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {user.email}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          style={{
            padding: '6px 13px',
            borderRadius: 7,
            background: 'transparent',
            border: '1px solid var(--border-strong)',
            color: 'var(--text-muted)',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          Log out
        </button>
      </div>
    </div>
  );
}
