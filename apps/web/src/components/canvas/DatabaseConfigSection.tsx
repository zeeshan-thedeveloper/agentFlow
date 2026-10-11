'use client';

import type { CSSProperties } from 'react';
import { DatabaseConnectionSelector } from './DatabaseConnectionSelector';
import type { FlowNode } from './types';

interface Props {
  node: FlowNode;
  onUpdate: (patch: Partial<FlowNode>) => void;
}

const labelStyle = {
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--text-faint)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
} satisfies CSSProperties;

const inputStyle = {
  width: '100%',
  background: 'var(--surface-bg)',
  border: '1px solid var(--border-strong)',
  borderRadius: 7,
  padding: '8px 10px',
  fontSize: 12,
  color: 'var(--text-primary)',
  outline: 'none',
  fontFamily: 'inherit',
} satisfies CSSProperties;

const ENGINES = {
  postgresql: { prefix: 'database:pg', name: 'PostgreSQL' },
  mongodb: { prefix: 'database:mongo', name: 'MongoDB' },
} satisfies Record<NonNullable<FlowNode['dbType']>, { prefix: string; name: string }>;

/**
 * A Database node only holds a connection. Wired into an Agent, the agent reads
 * the schema and runs read-only SQL itself.
 */
export function DatabaseConfigSection({ node, onUpdate }: Props) {
  const engine = node.dbType ?? 'postgresql';
  const engineConfig = ENGINES[engine];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        fontSize: 11, lineHeight: 1.5, color: 'var(--text-secondary)',
        padding: '9px 11px', borderRadius: 8,
        background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.28)',
      }}>
        Connect this to an <strong>Agent</strong>. The agent sees the tables and columns, writes its own
        SQL and reads the results to answer.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <label style={labelStyle}>Database type</label>
        <select
          value={engine}
          onChange={event => onUpdate({
            dbType: event.target.value as NonNullable<FlowNode['dbType']>,
            integrationId: 'database',
            connectionName: undefined,
            subtitle: 'Select connection',
          })}
          style={inputStyle}
        >
          <option value="postgresql">PostgreSQL</option>
          <option value="mongodb">MongoDB (not usable by agents yet)</option>
        </select>
      </div>

      <DatabaseConnectionSelector
        selectedIntegrationId={node.integrationId}
        filterPrefix={engineConfig.prefix}
        enginePrefix={engineConfig.prefix}
        engine={engine}
        integrationName={engineConfig.name}
        onSelect={id => {
          const name = id ? id.split(':').pop() ?? id : undefined;
          onUpdate({
            dbType: engine,
            integrationId: id || 'database',
            connectionName: name,
            subtitle: name ?? 'Select connection',
          });
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <label style={labelStyle}>Access</label>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', whiteSpace: 'nowrap',
            color: '#10B981', background: 'rgba(16,185,129,0.12)',
            border: '1px solid rgba(16,185,129,0.35)', borderRadius: 5, padding: '2px 7px',
          }}>
            READ-ONLY
          </span>
          <span style={{ fontSize: 11, lineHeight: 1.45, color: 'var(--text-faint)' }}>
            Agents can look data up but never change it. Use ⚙ on a connection to choose which tables they see.
          </span>
        </div>
      </div>
    </div>
  );
}
