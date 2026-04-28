'use client';

import { useEffect, useState } from 'react';

type CredentialState = {
  configured: boolean;
  maskedKey: string | null;
  updatedAt: string | null;
};

type RequestState = 'idle' | 'loading' | 'saving' | 'deleting' | 'saved' | 'error';

interface OpenAISettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

const emptyCredential: CredentialState = {
  configured: false,
  maskedKey: null,
  updatedAt: null,
};

export default function OpenAISettingsDialog({ open, onClose }: OpenAISettingsDialogProps) {
  const [credential, setCredential] = useState<CredentialState>(emptyCredential);
  const [apiKey, setApiKey] = useState('');
  const [state, setState] = useState<RequestState>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadCredential() {
      setState('loading');
      setError(null);

      try {
        const response = await fetch('/api/settings/openai', { cache: 'no-store' });
        if (!response.ok) throw new Error('Unable to load OpenAI settings.');

        const data = (await response.json()) as CredentialState;
        if (!cancelled) {
          setCredential(data);
          setApiKey('');
          setState('idle');
        }
      } catch (err) {
        if (!cancelled) {
          setState('error');
          setError(err instanceof Error ? err.message : 'Unable to load OpenAI settings.');
        }
      }
    }

    loadCredential();

    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  async function saveCredential() {
    setState('saving');
    setError(null);

    try {
      const response = await fetch('/api/settings/openai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });

      const data = (await response.json().catch(() => null)) as (CredentialState & { error?: string }) | null;
      if (!response.ok) throw new Error(data?.error ?? 'Unable to save OpenAI key.');

      setCredential(data ?? emptyCredential);
      setApiKey('');
      setState('saved');
      setTimeout(() => setState('idle'), 1800);
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Unable to save OpenAI key.');
    }
  }

  async function deleteCredential() {
    setState('deleting');
    setError(null);

    try {
      const response = await fetch('/api/settings/openai', { method: 'DELETE' });
      if (!response.ok) throw new Error('Unable to remove OpenAI key.');

      const data = (await response.json()) as CredentialState;
      setCredential(data);
      setApiKey('');
      setState('idle');
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Unable to remove OpenAI key.');
    }
  }

  const busy = state === 'loading' || state === 'saving' || state === 'deleting';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="OpenAI settings"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: 'rgba(4, 5, 10, 0.62)',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
        animation: 'fadeIn 0.16s ease-out',
      }}
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 'min(460px, 100%)',
          border: '1px solid var(--border-strong)',
          borderRadius: 8,
          background: 'var(--panel-wash), var(--panel-bg)',
          boxShadow: '0 24px 80px var(--shadow-node-strong)',
          animation: 'popIn 0.16s ease-out',
        }}
      >
        <div
          style={{
            padding: '15px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>OpenAI</div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 3 }}>
              {credential.configured ? credential.maskedKey : 'No key saved'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: '1px solid var(--border-strong)',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
            }}
          >
            x
          </button>
        </div>

        <div style={{ padding: 16, display: 'grid', gap: 14 }}>
          <label style={{ display: 'grid', gap: 7 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              API Key
            </span>
            <input
              type="password"
              value={apiKey}
              onChange={event => setApiKey(event.target.value)}
              placeholder={credential.configured ? 'Replace saved key' : 'sk-...'}
              autoComplete="off"
              spellCheck={false}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'var(--surface-bg)',
                border: '1px solid var(--border-strong)',
                borderRadius: 7,
                color: 'var(--text-primary)',
                fontSize: 13,
                fontFamily: "'JetBrains Mono', monospace",
                outline: 'none',
                padding: '10px 11px',
              }}
            />
          </label>

          {error && (
            <div style={{ color: '#ef4444', fontSize: 12, lineHeight: 1.45 }}>
              {error}
            </div>
          )}

          {state === 'saved' && (
            <div style={{ color: 'var(--success-text)', fontSize: 12, lineHeight: 1.45 }}>
              Saved
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={deleteCredential}
              disabled={!credential.configured || busy}
              style={{
                padding: '8px 12px',
                borderRadius: 7,
                border: '1px solid var(--border-strong)',
                background: 'transparent',
                color: credential.configured && !busy ? '#ef4444' : 'var(--text-faint)',
                cursor: credential.configured && !busy ? 'pointer' : 'default',
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              Remove
            </button>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '8px 12px',
                  borderRadius: 7,
                  border: '1px solid var(--border-strong)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveCredential}
                disabled={!apiKey.trim() || busy}
                style={{
                  padding: '8px 14px',
                  borderRadius: 7,
                  border: '1px solid var(--brand-text)',
                  background: !apiKey.trim() || busy ? 'rgba(108,99,255,0.28)' : 'var(--brand)',
                  color: 'var(--text-inverse)',
                  cursor: !apiKey.trim() || busy ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {state === 'saving' ? 'Saving' : 'Save key'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
