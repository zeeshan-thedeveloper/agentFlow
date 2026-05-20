'use client';

import { useEffect, useState } from 'react';
import {
  fetchSchemaTables,
  fetchSchemaConfig,
  saveSchemaConfig,
  type TablePermissions,
  type SchemaConfig,
} from '@/lib/integrations-api';

interface Props {
  integrationId: string;
  connectionName: string;
  onClose: () => void;
}

const DEFAULT_PERMS: TablePermissions = { read: true, insert: true, update: true, delete: true };

export function SchemaConfigModal({ integrationId, connectionName, onClose }: Props) {
  const [tables, setTables] = useState<string[]>([]);
  const [config, setConfig] = useState<SchemaConfig>({ tables: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetchSchemaTables(integrationId),
      fetchSchemaConfig(integrationId),
    ])
      .then(([liveTables, savedConfig]) => {
        setTables(liveTables);
        if (savedConfig) {
          const merged: SchemaConfig = { tables: { ...savedConfig.tables } };
          for (const t of liveTables) {
            if (!merged.tables[t]) merged.tables[t] = { ...DEFAULT_PERMS };
          }
          setConfig(merged);
        } else {
          const initial: SchemaConfig = { tables: {} };
          for (const t of liveTables) {
            initial.tables[t] = { ...DEFAULT_PERMS };
          }
          setConfig(initial);
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load schema');
      })
      .finally(() => setLoading(false));
  }, [integrationId]);

  function togglePerm(table: string, perm: keyof TablePermissions) {
    setConfig((prev) => ({
      tables: {
        ...prev.tables,
        [table]: {
          ...(prev.tables[table] ?? DEFAULT_PERMS),
          [perm]: !(prev.tables[table]?.[perm] ?? true),
        },
      },
    }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await saveSchemaConfig(integrationId, config);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const filteredTables = tables.filter((t) =>
    t.toLowerCase().includes(search.toLowerCase()),
  );

  const PERMS: { key: keyof TablePermissions; label: string }[] = [
    { key: 'read', label: 'Read' },
    { key: 'insert', label: 'Insert' },
    { key: 'update', label: 'Update' },
    { key: 'delete', label: 'Delete' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex h-[90vh] w-[680px] max-w-[95vw] flex-col rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-base font-semibold">Configure Schema</h2>
            <p className="text-xs text-gray-500">{connectionName}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-hidden px-6 py-4">
          {loading ? (
            <p className="text-sm text-gray-400">Loading tables...</p>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : (
            <>
              <p className="text-xs text-gray-500">
                Toggle which tables and operations this connection is allowed to use.
                If a workflow node tries to access a blocked table or operation, it will fail with a clear error.
              </p>

              <input
                type="text"
                className="w-full rounded border px-3 py-1.5 text-sm"
                placeholder="Filter tables..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <div className="flex-1 overflow-y-auto">
                {filteredTables.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    {tables.length === 0 ? 'No tables found in this database.' : 'No tables match your search.'}
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs font-semibold uppercase text-gray-500">
                        <th className="pb-2 pr-4">Table</th>
                        {PERMS.map((p) => (
                          <th key={p.key} className="pb-2 pr-3 text-center">{p.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTables.map((table) => {
                        const perms = config.tables[table] ?? DEFAULT_PERMS;
                        return (
                          <tr key={table} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="py-2 pr-4 font-mono text-xs">{table}</td>
                            {PERMS.map((p) => (
                              <td key={p.key} className="py-2 pr-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={perms[p.key]}
                                  onChange={() => togglePerm(table, p.key)}
                                  className="h-4 w-4 cursor-pointer accent-emerald-600"
                                />
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t px-6 py-4">
          {error && !loading && (
            <p className="text-xs text-red-600">{error}</p>
          )}
          <div className="ml-auto flex gap-2">
            <button
              onClick={onClose}
              className="rounded border px-4 py-2 text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading || !!error}
              className="rounded bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
