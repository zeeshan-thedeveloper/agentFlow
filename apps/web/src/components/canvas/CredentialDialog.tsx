'use client';

import { useState } from 'react';
import { saveCredential, testDatabaseConnection } from '@/lib/integrations-api';

interface Props {
  integrationId: string;
  integrationName: string;
  credentialName?: string;
  engine?: 'postgresql' | 'mongodb';
  onConnected: (maskedHint: string) => void;
  onClose: () => void;
}

type TestResult = {
  ok: boolean;
  message: string;
};

function summarizeServerVersion(serverVersion: string) {
  return serverVersion.split(' ').slice(0, 2).join(' ');
}

export function CredentialDialog({ integrationId, integrationName, credentialName, engine, onConnected, onClose }: Props) {
  const [connectionString, setConnectionString] = useState('');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trimmedConnectionString = connectionString.trim();
  const busy = testing || saving;
  const actionsDisabled = !trimmedConnectionString || busy;

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    setError(null);

    try {
      const result = await testDatabaseConnection(trimmedConnectionString, engine);
      const server = result.serverVersion ? ` Server: ${summarizeServerVersion(result.serverVersion)}` : '';
      setTestResult({ ok: true, message: `Connected.${server}` });
    } catch (err: unknown) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : 'Connection failed' });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    try {
      const result = await saveCredential(integrationId, trimmedConnectionString, credentialName);
      onConnected(result.maskedHint);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Connect ${integrationName}`}
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
          width: 'min(520px, 100%)',
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
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>
              Connect {integrationName}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 3 }}>
              Encrypted credential storage
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            disabled={busy}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: '1px solid var(--border-strong)',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: busy ? 'default' : 'pointer',
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
              Connection String
            </span>
            <input
              type="password"
              value={connectionString}
              onChange={event => {
                setConnectionString(event.target.value);
                setTestResult(null);
                setError(null);
              }}
              placeholder="postgresql://user:password@host:5432/dbname"
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

          <div style={{ color: 'var(--text-faint)', fontSize: 12, lineHeight: 1.45 }}>
            Add <code style={{ color: 'var(--text-secondary)' }}>?sslmode=require</code> for SSL. The connection string is encrypted before storage.
          </div>

          {testResult && (
            <div style={{ color: testResult.ok ? 'var(--success-text)' : '#ef4444', fontSize: 12, lineHeight: 1.45 }}>
              {testResult.ok ? 'Connected' : 'Connection failed'}: {testResult.message}
            </div>
          )}

          {error && (
            <div style={{ color: '#ef4444', fontSize: 12, lineHeight: 1.45 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleTest}
              disabled={actionsDisabled}
              style={{
                padding: '8px 12px',
                borderRadius: 7,
                border: '1px solid var(--border-strong)',
                background: 'transparent',
                color: actionsDisabled ? 'var(--text-faint)' : 'var(--text-secondary)',
                cursor: actionsDisabled ? 'default' : 'pointer',
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {testing ? 'Testing' : 'Test Connection'}
            </button>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                style={{
                  padding: '8px 12px',
                  borderRadius: 7,
                  border: '1px solid var(--border-strong)',
                  background: 'transparent',
                  color: busy ? 'var(--text-faint)' : 'var(--text-secondary)',
                  cursor: busy ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={actionsDisabled}
                style={{
                  padding: '8px 14px',
                  borderRadius: 7,
                  border: '1px solid var(--brand-text)',
                  background: actionsDisabled ? 'rgba(108,99,255,0.28)' : 'var(--brand)',
                  color: 'var(--text-inverse)',
                  cursor: actionsDisabled ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {saving ? 'Saving' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
