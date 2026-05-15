'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  deleteNamedCredential,
  listDatabaseConnections,
  type NamedConnection,
} from '@/lib/integrations-api';
import { CredentialDialog } from './CredentialDialog';

interface Props {
  selectedIntegrationId: string | undefined;
  onSelect: (integrationId: string) => void;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function DatabaseConnectionSelector({ selectedIntegrationId, onSelect }: Props) {
  const [connections, setConnections] = useState<NamedConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [newName, setNewName] = useState('');

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
  const newIntegrationId = useMemo(() => {
    const slug = slugify(trimmedName);
    return slug ? `database:${slug}` : 'database';
  }, [trimmedName]);

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {loading ? (
        <div style={{ color: 'var(--text-faint)', fontSize: 12 }}>Loading connections...</div>
      ) : connections.length === 0 ? (
        <p style={{ color: 'var(--text-faint)', fontSize: 12, lineHeight: 1.45, margin: 0 }}>
          No connections saved yet.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {connections.map(connection => {
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
            style={{
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
            }}
          />
        </label>

        <button
          type="button"
          onClick={() => setShowDialog(true)}
          style={{
            width: '100%',
            height: 32,
            borderRadius: 7,
            border: '1px solid #10B981',
            background: '#10B981',
            color: 'var(--text-inverse)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          Connect...
        </button>
      </div>

      {showDialog && (
        <CredentialDialog
          integrationId={newIntegrationId}
          integrationName={trimmedName ? `Database (${trimmedName})` : 'Database'}
          credentialName={trimmedName || undefined}
          onConnected={() => {
            void loadConnections();
            onSelect(newIntegrationId);
            setShowDialog(false);
            setNewName('');
          }}
          onClose={() => setShowDialog(false)}
        />
      )}
    </div>
  );
}
