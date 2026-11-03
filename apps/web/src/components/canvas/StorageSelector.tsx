'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { deleteStorage, listStorages, saveStorage, type StorageConnection, type StorageFields } from '@/lib/files-api';

interface Props {
  selectedIntegrationId: string | undefined;
  onSelect: (connection: StorageConnection | null) => void;
}

const COLOR = '#F97316';

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  background: 'var(--surface-bg)',
  border: '1px solid var(--border-strong)',
  borderRadius: 7,
  padding: '8px 10px',
  fontSize: 12,
  color: 'var(--text-primary)',
  outline: 'none',
  fontFamily: 'inherit',
} satisfies CSSProperties;

const labelStyle = {
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--text-faint)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
} satisfies CSSProperties;

const hintStyle = { margin: 0, fontSize: 10, lineHeight: 1.5, color: 'var(--text-faint)' } satisfies CSSProperties;

const EMPTY: StorageFields = { name: '', endpoint: '', region: '', bucket: '', accessKeyId: '', secretAccessKey: '' };

const FIELDS: { key: keyof StorageFields; label: string; placeholder: string; secret?: boolean; mono?: boolean }[] = [
  { key: 'name', label: 'Name', placeholder: 'Neon storage' },
  { key: 'endpoint', label: 'Endpoint URL (AWS_ENDPOINT_URL_S3)', placeholder: 'https://br-….storage….aws.neon.tech', mono: true },
  { key: 'region', label: 'Region (AWS_REGION)', placeholder: 'us-east-2', mono: true },
  { key: 'bucket', label: 'Bucket', placeholder: 'agentflow-files', mono: true },
  { key: 'accessKeyId', label: 'Access key ID (AWS_ACCESS_KEY_ID)', placeholder: 'nak_live_…', mono: true },
  { key: 'secretAccessKey', label: 'Secret access key (AWS_SECRET_ACCESS_KEY)', placeholder: '••••••••', secret: true, mono: true },
];

/** Picks, adds and removes S3-compatible storage connections for a Files node. */
export function StorageSelector({ selectedIntegrationId, onSelect }: Props) {
  const [storages, setStorages] = useState<StorageConnection[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [fields, setFields] = useState<StorageFields>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await listStorages();
      setStorages(list);
      setAdding(current => current || list.length === 0);
    } catch (err) {
      setStorages([]);
      setError(err instanceof Error ? err.message : 'Could not load storages');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const saved = await saveStorage(fields);
      setFields(EMPTY);
      setAdding(false);
      await refresh();
      onSelect(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the storage');
    } finally {
      setBusy(false);
    }
  }

  async function remove(connection: StorageConnection) {
    setBusy(true);
    setError(null);
    try {
      await deleteStorage(connection.integrationId);
      if (connection.integrationId === selectedIntegrationId) onSelect(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the storage');
    } finally {
      setBusy(false);
    }
  }

  const complete = FIELDS.every(field => fields[field.key].trim());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={labelStyle}>Storage</label>
      {storages === null && <p style={hintStyle}>Loading…</p>}
      {storages?.map(connection => {
        const active = connection.integrationId === selectedIntegrationId;
        return (
          <div key={connection.integrationId} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 7, cursor: 'pointer',
            border: `1px solid ${active ? `${COLOR}66` : 'var(--border-subtle)'}`,
            background: active ? 'rgba(249,115,22,0.06)' : 'transparent',
          }} onClick={() => onSelect(connection)}>
            <input type="radio" readOnly checked={active} style={{ accentColor: COLOR, margin: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{connection.name}</div>
              <div style={{ fontSize: 10, color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {connection.maskedHint}
              </div>
            </div>
            <button
              type="button"
              title={`Remove ${connection.name}`}
              disabled={busy}
              onClick={event => {
                event.stopPropagation();
                void remove(connection);
              }}
              style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}
            >
              x
            </button>
          </div>
        );
      })}

      {adding ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: 10, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
          <p style={hintStyle}>
            Any S3-compatible storage works. In Neon: <strong>Connect → Storage</strong>, generate a credential and copy the
            values from the .env tab, and create a bucket under Object storage.
          </p>
          {FIELDS.map(field => (
            <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{field.label}</span>
              <input
                type={field.secret ? 'password' : 'text'}
                autoComplete="off"
                value={fields[field.key]}
                placeholder={field.placeholder}
                onChange={e => setFields(current => ({ ...current, [field.key]: e.target.value }))}
                style={{ ...inputStyle, ...(field.mono ? { fontFamily: "'JetBrains Mono', monospace", fontSize: 11 } : {}) }}
              />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6 }}>
            {(storages?.length ?? 0) > 0 && (
              <button
                type="button"
                onClick={() => setAdding(false)}
                style={{ flex: 1, height: 32, borderRadius: 7, cursor: 'pointer', border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, fontFamily: 'inherit' }}
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              disabled={busy || !complete}
              onClick={() => void save()}
              style={{ flex: 2, height: 32, borderRadius: 7, cursor: 'pointer', border: `1px solid ${COLOR}66`, background: `${COLOR}1f`, color: COLOR, fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}
            >
              {busy ? 'Testing…' : 'Test & save'}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          style={{ height: 30, borderRadius: 7, cursor: 'pointer', border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, fontFamily: 'inherit' }}
        >
          + Add storage
        </button>
      )}
      {error && <p style={{ ...hintStyle, color: '#ef4444' }}>{error}</p>}
    </div>
  );
}
