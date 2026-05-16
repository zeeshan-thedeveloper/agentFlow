'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  deleteNamedCredential,
  listDatabaseConnections,
  saveCredential,
  testDatabaseConnection,
  type NamedConnection,
} from '@/lib/integrations-api';

interface Props {
  selectedIntegrationId: string | undefined;
  filterPrefix?: string;
  enginePrefix?: string;
  engine?: 'postgresql' | 'mongodb';
  integrationName?: string;
  onSelect: (integrationId: string) => void;
}

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

type TestResult = {
  ok: boolean;
  message: string;
};

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  background: 'var(--surface-bg)',
  border: '1px solid var(--border-strong)',
  borderRadius: 7,
  color: 'var(--text-primary)',
  fontSize: 12,
  outline: 'none',
  padding: '8px 10px',
  fontFamily: 'inherit',
} satisfies CSSProperties;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
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

function summarizeServerVersion(serverVersion: string) {
  return serverVersion.split(' ').slice(0, 2).join(' ');
}

function matchesPrefix(integrationId: string, filterPrefix: string | undefined) {
  if (!filterPrefix) return true;
  if (filterPrefix === 'database:pg') {
    return integrationId === 'database' || integrationId.startsWith('database:pg');
  }
  return integrationId.startsWith(filterPrefix);
}

export function DatabaseConnectionSelector({
  selectedIntegrationId,
  filterPrefix,
  enginePrefix = 'database',
  engine,
  integrationName = 'Database',
  onSelect,
}: Props) {
  const [connections, setConnections] = useState<NamedConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
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
  const [formError, setFormError] = useState<string | null>(null);

  async function loadConnections() {
    setLoading(true);
    setError(null);

    try {
      setConnections(await listDatabaseConnections());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to list database connections');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadConnections();
  }, []);

  async function handleDelete(integrationId: string) {
    setDeletingId(integrationId);
    setError(null);

    try {
      await deleteNamedCredential(integrationId);
      if (selectedIntegrationId === integrationId) onSelect('');
      await loadConnections();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete connection');
    } finally {
      setDeletingId(null);
    }
  }

  const trimmedName = newName.trim();
  const filteredConnections = useMemo(
    () => connections.filter(connection => matchesPrefix(connection.integrationId, filterPrefix)),
    [connections, filterPrefix],
  );

  const newIntegrationId = useMemo(() => {
    const slug = slugify(trimmedName);
    return slug ? `${enginePrefix}:${slug}` : enginePrefix;
  }, [enginePrefix, trimmedName]);
  const trimmedConnectionString = connectionString.trim();
  const canBuildFromFields = fields.host.trim() && (engine !== 'postgresql' || fields.database.trim());
  const formBusy = testing || saving;
  const actionsDisabled = (!trimmedConnectionString && !canBuildFromFields) || formBusy;

  function updateField(name: keyof ConnectionFields, value: string | boolean) {
    setFields(previous => ({ ...previous, [name]: value }));
    setTestResult(null);
    setFormError(null);
  }

  function resolveConnectionString() {
    return trimmedConnectionString || buildConnectionString(fields, engine);
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    setFormError(null);

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
    setFormError(null);

    try {
      await saveCredential(newIntegrationId, resolveConnectionString(), trimmedName || undefined);
      await loadConnections();
      onSelect(newIntegrationId);
      setNewName('');
      setConnectionString('');
      setFields({
        host: '',
        port: engine === 'mongodb' ? '27017' : '5432',
        database: '',
        username: '',
        password: '',
        ssl: engine !== 'mongodb',
        srv: false,
        authSource: '',
      });
      setTestResult(null);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save connection');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {loading ? (
        <div style={{ color: 'var(--text-faint)', fontSize: 12 }}>Loading connections...</div>
      ) : filteredConnections.length === 0 ? (
        <p style={{ color: 'var(--text-faint)', fontSize: 12, lineHeight: 1.45, margin: 0 }}>
          No connections saved yet.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {filteredConnections.map(connection => {
            const selected = selectedIntegrationId === connection.integrationId;
            const deleting = deletingId === connection.integrationId;

            return (
              <div
                key={connection.integrationId}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(connection.integrationId)}
                onKeyDown={event => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  onSelect(connection.integrationId);
                }}
                style={{
                  width: '100%',
                  minHeight: 38,
                  boxSizing: 'border-box',
                  borderRadius: 7,
                  border: `1px solid ${selected ? '#10B981' : 'var(--border-strong)'}`,
                  background: selected ? 'rgba(16,185,129,0.12)' : 'var(--surface-bg)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto auto',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 8px 7px 10px',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: 12,
                    fontWeight: 700,
                  }}>
                    {connection.name}
                  </span>
                  <span style={{
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: 'var(--text-faint)',
                    fontSize: 10,
                    marginTop: 2,
                  }}>
                    {connection.integrationId}
                  </span>
                </span>
                <span style={{
                  maxWidth: 82,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: 'var(--text-faint)',
                  fontSize: 10,
                }}>
                  {connection.maskedHint ?? ''}
                </span>
                <button
                  type="button"
                  aria-label={`Delete ${connection.name}`}
                  title="Remove connection"
                  onClick={event => {
                    event.stopPropagation();
                    if (!deleting) void handleDelete(connection.integrationId);
                  }}
                  onKeyDown={event => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    event.stopPropagation();
                    if (!deleting) void handleDelete(connection.integrationId);
                  }}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    border: '1px solid var(--border-strong)',
                    background: 'transparent',
                    color: deleting ? 'var(--text-faint)' : '#ef4444',
                    cursor: deleting ? 'default' : 'pointer',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 13,
                    lineHeight: 1,
                  }}
                >
                  x
                </button>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div style={{ color: '#ef4444', fontSize: 12, lineHeight: 1.45 }}>
          {error}
        </div>
      )}

      <div style={{
        display: 'grid',
        gap: 8,
        paddingTop: 10,
        borderTop: '1px solid var(--border-subtle)',
      }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700 }}>
            Add connection
          </span>
          <input
            type="text"
            value={newName}
            onChange={event => setNewName(event.target.value)}
            placeholder="Production DB"
            style={inputStyle}
          />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 82px', gap: 8 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700 }}>Host</span>
            <input
              type="text"
              value={fields.host}
              onChange={event => updateField('host', event.target.value)}
              placeholder={engine === 'mongodb' ? 'cluster.example.net' : 'db.example.com'}
              autoComplete="off"
              spellCheck={false}
              style={inputStyle}
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700 }}>Port</span>
            <input
              type="text"
              value={fields.port}
              onChange={event => updateField('port', event.target.value)}
              disabled={engine === 'mongodb' && fields.srv}
              placeholder={engine === 'mongodb' ? '27017' : '5432'}
              inputMode="numeric"
              style={{ ...inputStyle, color: engine === 'mongodb' && fields.srv ? 'var(--text-faint)' : 'var(--text-primary)' }}
            />
          </label>
        </div>

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700 }}>Database name</span>
          <input
            type="text"
            value={fields.database}
            onChange={event => updateField('database', event.target.value)}
            placeholder={engine === 'mongodb' ? 'app' : 'postgres'}
            autoComplete="off"
            spellCheck={false}
            style={inputStyle}
          />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700 }}>Username</span>
            <input
              type="text"
              value={fields.username}
              onChange={event => updateField('username', event.target.value)}
              autoComplete="off"
              spellCheck={false}
              style={inputStyle}
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700 }}>Password</span>
            <input
              type="password"
              value={fields.password}
              onChange={event => updateField('password', event.target.value)}
              autoComplete="off"
              spellCheck={false}
              style={inputStyle}
            />
          </label>
        </div>

        {engine === 'mongodb' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: 8, alignItems: 'end' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700, minHeight: 34 }}>
              <input
                type="checkbox"
                checked={fields.srv}
                onChange={event => updateField('srv', event.target.checked)}
                style={{ accentColor: 'var(--brand)', margin: 0 }}
              />
              SRV
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700 }}>Auth source</span>
              <input
                type="text"
                value={fields.authSource}
                onChange={event => updateField('authSource', event.target.value)}
                placeholder="admin"
                autoComplete="off"
                spellCheck={false}
                style={inputStyle}
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

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700 }}>
            Connection string optional
          </span>
          <input
            type="password"
            value={connectionString}
            onChange={event => {
              setConnectionString(event.target.value);
              setTestResult(null);
              setFormError(null);
            }}
            placeholder={engine === 'mongodb'
              ? 'mongodb://user:password@host:27017/dbname'
              : 'postgresql://user:password@host:5432/dbname'}
            autoComplete="off"
            spellCheck={false}
            style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }}
          />
        </label>

        {testResult && (
          <div style={{ color: testResult.ok ? 'var(--success-text)' : '#ef4444', fontSize: 12, lineHeight: 1.45 }}>
            {testResult.ok ? 'Connected' : 'Connection failed'}: {testResult.message}
          </div>
        )}

        {formError && (
          <div style={{ color: '#ef4444', fontSize: 12, lineHeight: 1.45 }}>
            {formError}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8 }}>
          <button
            type="button"
            onClick={handleTest}
            disabled={actionsDisabled}
            style={{
              height: 32,
              borderRadius: 7,
              border: '1px solid var(--border-strong)',
              background: 'transparent',
              color: actionsDisabled ? 'var(--text-faint)' : 'var(--text-secondary)',
              cursor: actionsDisabled ? 'default' : 'pointer',
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            {testing ? 'Testing' : 'Test'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={actionsDisabled}
            style={{
              height: 32,
              borderRadius: 7,
              border: '1px solid #10B981',
              background: actionsDisabled ? 'rgba(16,185,129,0.35)' : '#10B981',
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
  );
}
