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

type ConnectionFields = {
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  srv: boolean;
  authSource: string;
};

function summarizeServerVersion(serverVersion: string) {
  return serverVersion.split(' ').slice(0, 2).join(' ');
}

function encodePart(value: string) {
  return encodeURIComponent(value.trim());
}

function buildConnectionString(fields: ConnectionFields, engine: Props['engine']) {
  const host = fields.host.trim();
  const database = fields.database.trim();
  if (!host) throw new Error('Host is required.');
  if (engine === 'postgresql' && !database) throw new Error('Database name is required.');

  const username = fields.username.trim();
  const password = fields.password;
  const auth = username
    ? `${encodePart(username)}${password ? `:${encodePart(password)}` : ''}@`
    : '';

  if (engine === 'mongodb') {
    const scheme = fields.srv ? 'mongodb+srv' : 'mongodb';
    const port = fields.srv || !fields.port.trim() ? '' : `:${fields.port.trim()}`;
    const path = database ? `/${encodePart(database)}` : '';
    const params = new URLSearchParams();
    if (fields.authSource.trim()) params.set('authSource', fields.authSource.trim());
    const query = params.toString();
    return `${scheme}://${auth}${host}${port}${path}${query ? `?${query}` : ''}`;
  }

  const port = fields.port.trim() || '5432';
  const params = new URLSearchParams();
  if (fields.ssl) params.set('sslmode', 'require');
  const query = params.toString();
  return `postgresql://${auth}${host}:${port}/${encodePart(database)}${query ? `?${query}` : ''}`;
}

export function CredentialDialog({ integrationId, integrationName, credentialName, engine, onConnected, onClose }: Props) {
  const [connectionString, setConnectionString] = useState('');
  const [fields, setFields] = useState<ConnectionFields>({
    host: '',
    port: engine === 'mongodb' ? '27017' : '5432',
    database: '',
    username: '',
    password: '',
    ssl: engine !== 'mongodb',
    srv: false,
    authSource: '',
  });
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trimmedConnectionString = connectionString.trim();
  const busy = testing || saving;
  const canBuildFromFields = fields.host.trim() && (engine !== 'postgresql' || fields.database.trim());
  const actionsDisabled = (!trimmedConnectionString && !canBuildFromFields) || busy;

  function updateField(name: keyof ConnectionFields, value: string | boolean) {
    setFields(previous => ({ ...previous, [name]: value }));
    setTestResult(null);
    setError(null);
  }

  function resolveConnectionString() {
    return trimmedConnectionString || buildConnectionString(fields, engine);
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    setError(null);

    try {
      const result = await testDatabaseConnection(resolveConnectionString(), engine);
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
      const result = await saveCredential(integrationId, resolveConnectionString(), credentialName);
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
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 96px', gap: 10 }}>
            <label style={{ display: 'grid', gap: 7 }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Host
              </span>
              <input
                type="text"
                value={fields.host}
                onChange={event => updateField('host', event.target.value)}
                placeholder={engine === 'mongodb' ? 'cluster.example.net' : 'db.example.com'}
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
                  outline: 'none',
                  padding: '10px 11px',
                }}
              />
            </label>

            <label style={{ display: 'grid', gap: 7 }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Port
              </span>
              <input
                type="text"
                value={fields.port}
                onChange={event => updateField('port', event.target.value)}
                disabled={engine === 'mongodb' && fields.srv}
                placeholder={engine === 'mongodb' ? '27017' : '5432'}
                inputMode="numeric"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: 'var(--surface-bg)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 7,
                  color: fields.srv ? 'var(--text-faint)' : 'var(--text-primary)',
                  fontSize: 13,
                  outline: 'none',
                  padding: '10px 11px',
                }}
              />
            </label>
          </div>

          <label style={{ display: 'grid', gap: 7 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Database
            </span>
            <input
              type="text"
              value={fields.database}
              onChange={event => updateField('database', event.target.value)}
              placeholder={engine === 'mongodb' ? 'app' : 'postgres'}
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
                outline: 'none',
                padding: '10px 11px',
              }}
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10 }}>
            <label style={{ display: 'grid', gap: 7 }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Username
              </span>
              <input
                type="text"
                value={fields.username}
                onChange={event => updateField('username', event.target.value)}
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
                  outline: 'none',
                  padding: '10px 11px',
                }}
              />
            </label>

            <label style={{ display: 'grid', gap: 7 }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Password
              </span>
              <input
                type="password"
                value={fields.password}
                onChange={event => updateField('password', event.target.value)}
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
                  outline: 'none',
                  padding: '10px 11px',
                }}
              />
            </label>
          </div>

          {engine === 'mongodb' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: 10, alignItems: 'end' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700, minHeight: 38 }}>
                <input
                  type="checkbox"
                  checked={fields.srv}
                  onChange={event => updateField('srv', event.target.checked)}
                  style={{ accentColor: 'var(--brand)', margin: 0 }}
                />
                SRV
              </label>
              <label style={{ display: 'grid', gap: 7 }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Auth Source
                </span>
                <input
                  type="text"
                  value={fields.authSource}
                  onChange={event => updateField('authSource', event.target.value)}
                  placeholder="admin"
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
                    outline: 'none',
                    padding: '10px 11px',
                  }}
                />
              </label>
            </div>
          ) : (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={fields.ssl}
                onChange={event => updateField('ssl', event.target.checked)}
                style={{ accentColor: 'var(--brand)', margin: 0 }}
              />
              Require SSL
            </label>
          )}

          <label style={{ display: 'grid', gap: 7 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Connection String (Optional)
            </span>
            <input
              type="password"
              value={connectionString}
              onChange={event => {
                setConnectionString(event.target.value);
                setTestResult(null);
                setError(null);
              }}
              placeholder={engine === 'mongodb'
                ? 'mongodb://user:password@host:27017/dbname'
                : 'postgresql://user:password@host:5432/dbname'}
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
