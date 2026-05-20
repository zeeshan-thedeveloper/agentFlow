'use client';

import { SchemaConfigSection } from './SchemaConfigSection';
import type { FlowNode } from './types';

interface Props {
  node: FlowNode;
  onUpdate: (patch: Partial<FlowNode>) => void;
}

export function QueryRunnerConfigSection({ node, onUpdate }: Props) {
  const staticSql = String(node.actionParams?.sql ?? '');

  return (
    <div className="flex flex-col gap-4 p-4">
      <SchemaConfigSection
        integrationId={node.integrationId ?? ''}
        connectionName={node.connectionName ?? ''}
        onChange={(integrationId, connectionName) =>
          onUpdate({
            integrationId,
            connectionName,
            subtitle: connectionName || 'Select connection',
          })
        }
      />
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">
          Static SQL (optional)
        </label>
        <textarea
          className="w-full rounded border px-2 py-1.5 font-mono text-xs"
          rows={4}
          placeholder="SELECT * FROM orders LIMIT 10"
          value={staticSql}
          onChange={e =>
            onUpdate({
              actionParams: { ...node.actionParams, sql: e.target.value },
            })
          }
        />
        <p className="mt-1 text-xs text-gray-400">
          Used when no SQL is wired on the query-in handle. Upstream Agent output overrides this.
        </p>
      </div>
    </div>
  );
}
