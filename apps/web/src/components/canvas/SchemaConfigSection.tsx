'use client';

import { useState } from 'react';
import { useDatabaseConnections } from '@/hooks/useIntegrations';
import { SchemaConfigModal } from './SchemaConfigModal';

interface Props {
  integrationId: string;
  connectionName: string;
  onChange: (integrationId: string, connectionName: string) => void;
}

export function SchemaConfigSection({ integrationId, connectionName, onChange }: Props) {
  const { connections, loading } = useDatabaseConnections();
  const [schemaModalOpen, setSchemaModalOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3 p-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">
          Database Connection
        </label>
        {loading ? (
          <p className="text-xs text-gray-400">Loading connections...</p>
        ) : (
          <select
            className="w-full rounded border px-2 py-1.5 text-sm"
            value={integrationId}
            onChange={(e) => {
              const selected = connections.find((c) => c.integrationId === e.target.value);
              onChange(e.target.value, selected?.name ?? '');
            }}
          >
            <option value="">Select a connection...</option>
            {connections.map((c) => (
              <option key={c.integrationId} value={c.integrationId}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {integrationId && (
        <div className="flex items-center justify-between rounded border bg-gray-50 px-3 py-2">
          <span className="text-xs text-gray-500">
            Schema permissions configured via ⚙ on the connection.
          </span>
          <button
            type="button"
            onClick={() => setSchemaModalOpen(true)}
            className="text-xs text-violet-600 hover:underline"
          >
            Configure ⚙
          </button>
        </div>
      )}

      {schemaModalOpen && integrationId && (
        <SchemaConfigModal
          integrationId={integrationId}
          connectionName={connectionName}
          onClose={() => setSchemaModalOpen(false)}
        />
      )}
    </div>
  );
}
