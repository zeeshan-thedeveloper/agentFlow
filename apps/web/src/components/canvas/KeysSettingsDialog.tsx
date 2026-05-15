'use client';

import { useEffect, useState } from 'react';

type CredentialState = {
  configured: boolean;
  maskedKey: string | null;
  updatedAt: string | null;
};

type RequestState = 'idle' | 'loading' | 'saving' | 'deleting' | 'saved' | 'error';

type CredentialConfig = {
  id: 'openai' | 'tavily';
  title: string;
  endpoint: string;
  placeholder: string;
  loadError: string;
  saveError: string;
  removeError: string;
  helper?: string;
};

interface KeysSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

const emptyCredential: CredentialState = {
  configured: false,
  maskedKey: null,
  updatedAt: null,
};

const credentialConfigs: CredentialConfig[] = [
  {
    id: 'openai',
    title: 'OpenAI',
    endpoint: '/api/settings/openai',
    placeholder: 'sk-...',
    loadError: 'Unable to load OpenAI settings.',
    saveError: 'Unable to save OpenAI key.',
    removeError: 'Unable to remove OpenAI key.',
  },
  {
    id: 'tavily',
    title: 'Tavily Search',
    endpoint: '/api/settings/tavily',
    placeholder: 'tvly-...',
    loadError: 'Unable to load Tavily settings.',
    saveError: 'Unable to save Tavily key.',
    removeError: 'Unable to remove Tavily key.',
    helper: 'Get a free key at tavily.com. Required for the Web Search tool.',
  },
];

function CredentialSection({ config, open }: { config: CredentialConfig; open: boolean }) {
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
        const response = await fetch(config.endpoint, { cache: 'no-store' });
        if (!response.ok) throw new Error(config.loadError);

        const data = (await response.json()) as CredentialState;
        if (!cancelled) {
          setCredential(data);
          setApiKey('');
          setState('idle');
        }
      } catch (err) {
        if (!cancelled) {
          setState('error');
          setError(err instanceof Error ? err.message : config.loadError);
        }
      }
    }

    loadCredential();

    return () => {
      cancelled = true;
    };
  }, [config, open]);

  async function saveCredential() {
    setState('saving');
    setError(null);

    try {
      const response = await fetch(config.endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });

      const data = (await response.json().catch(() => null)) as (CredentialState & { error?: string }) | null;
      if (!response.ok) throw new Error(data?.error ?? config.saveError);

      setCredential(data ?? emptyCredential);
      setApiKey('');
      setState('saved');
      setTimeout(() => setState('idle'), 1800);
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : config.saveError);
    }
  }

  async function deleteCredential() {
    setState('deleting');
    setError(null);

    try {
      const response = await fetch(config.endpoint, { method: 'DELETE' });
      if (!response.ok) throw new Error(config.removeError);

      const data = (await response.json()) as CredentialState;
      setCredential(data);
      setApiKey('');
      setState('idle');
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : config.removeError);
    }
  }

  const busy = state === 'loading' || state === 'saving' || state === 'deleting';

  return (
    <section
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        padding: 14,
        display: 'grid',
        gap: 12,
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{config.title}</div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 3 }}>
            {credential.configured ? credential.maskedKey : 'No key saved'}
          </div>
        </div>
        {state === 'saved' && (
          <div style={{ color: 'var(--success-text)', fontSize: 12, lineHeight: 1.45 }}>Saved</div>
        )}
      </div>

      <label style={{ display: 'grid', gap: 7 }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          API Key
        </span>
        <input
          type="password"
          value={apiKey}
          onChange={event => setApiKey(event.target.value)}
          placeholder={credential.configured ? 'Replace saved key' : config.placeholder}
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
        {config.helper && (
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
            {config.helper}
          </span>
        )}
      </label>

      {error && (
        <div style={{ color: '#ef4444', fontSize: 12, lineHeight: 1.45 }}>
          {error}
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
    </section>
  );
}

export default function KeysSettingsDialog({ open, onClose }: KeysSettingsDialogProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="API keys settings"
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
          width: 'min(540px, 100%)',
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
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>Keys</div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 3 }}>
              Manage provider credentials for agents and tools
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

        <div style={{ padding: 16, display: 'grid', gap: 12 }}>
          {credentialConfigs.map(config => (
            <CredentialSection key={config.id} config={config} open={open} />
          ))}
        </div>
      </div>
    </div>
  );
}
