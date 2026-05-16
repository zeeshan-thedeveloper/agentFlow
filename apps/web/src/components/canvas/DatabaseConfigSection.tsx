'use client';

import type { CSSProperties } from 'react';
import { useIntegrations } from '@/hooks/useIntegrations';
import { DatabaseConnectionSelector } from './DatabaseConnectionSelector';
import type { FlowNode } from './types';

interface Props {
  node: FlowNode;
  onUpdate: (patch: Partial<FlowNode>) => void;
}

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

const ENGINE_ACTIONS = {
  postgresql: ['query', 'insert', 'update', 'execute'],
  mongodb: ['find', 'insertOne', 'updateOne', 'deleteOne'],
} satisfies Record<NonNullable<FlowNode['dbType']>, string[]>;

function getActionParam(node: FlowNode, name: string) {
  return node.actionParams?.[name];
}

function getEngineConfig(dbType: FlowNode['dbType']) {
  if (dbType === 'postgresql') {
    return {
      metadataId: 'database',
      filterPrefix: 'database:pg',
      enginePrefix: 'database:pg',
      connectionName: 'PostgreSQL',
    };
  }

  if (dbType === 'mongodb') {
    return {
      metadataId: 'database:mongo',
      filterPrefix: 'database:mongo',
      enginePrefix: 'database:mongo',
      connectionName: 'MongoDB',
    };
  }

  return null;
}

export function DatabaseConfigSection({ node, onUpdate }: Props) {
  const { integrations, loading } = useIntegrations();
  const engineConfig = getEngineConfig(node.dbType);
  const selectedIntegration = engineConfig
    ? integrations.find(integration => integration.id === engineConfig.metadataId)
    : undefined;
  const allowedActions = node.dbType ? ENGINE_ACTIONS[node.dbType] : [];
  const actions = selectedIntegration?.actions.filter(action => allowedActions.includes(action.id)) ?? [];
  const selectedAction = actions.find(action => action.id === node.actionId);

  function updateParam(name: string, value: unknown) {
    onUpdate({
      actionParams: {
        ...node.actionParams,
        [name]: value,
      },
    });
  }

  if (loading) {
    return <div style={{ color: 'var(--text-faint)', fontSize: 12 }}>Loading integrations...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          DB Engine
        </label>
        <select
          value={node.dbType ?? ''}
          onChange={event => onUpdate({
            dbType: (event.target.value || undefined) as FlowNode['dbType'],
            actionId: undefined,
            actionParams: {},
          })}
          style={inputStyle}
        >
          <option value="">Select database type...</option>
          <option value="postgresql">PostgreSQL</option>
          <option value="mongodb">MongoDB</option>
        </select>
      </div>

      {engineConfig && (
        <DatabaseConnectionSelector
          selectedIntegrationId={node.integrationId}
          filterPrefix={engineConfig.filterPrefix}
          enginePrefix={engineConfig.enginePrefix}
          engine={node.dbType}
          integrationName={engineConfig.connectionName}
          onSelect={id => onUpdate({ integrationId: id || 'database', actionId: undefined, actionParams: {} })}
        />
      )}

      {selectedAction && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Parameters
          </label>
          {selectedAction.paramSchema.map(param => (
            <div key={param.name} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700 }}>
                {param.label}
                {param.required && <span style={{ color: '#ef4444', marginLeft: 3 }}>*</span>}
              </label>

              {param.type === 'text' ? (
                <textarea
                  rows={4}
                  placeholder={param.placeholder}
                  value={String(getActionParam(node, param.name) ?? '')}
                  onChange={event => updateParam(param.name, event.target.value)}
                  style={{
                    ...inputStyle,
                    resize: 'vertical',
                    fontSize: 11,
                    lineHeight: 1.6,
                    fontFamily: "'JetBrains Mono', monospace",
                    color: 'var(--text-secondary)',
                  }}
                />
              ) : param.type === 'number' ? (
                <input
                  type="number"
                  placeholder={param.placeholder}
                  value={String(getActionParam(node, param.name) ?? '')}
                  onChange={event => updateParam(param.name, event.target.value)}
                  style={inputStyle}
                />
              ) : param.type === 'boolean' ? (
                <input
                  type="checkbox"
                  checked={Boolean(getActionParam(node, param.name))}
                  onChange={event => updateParam(param.name, event.target.checked)}
                  style={{ accentColor: 'var(--brand)', alignSelf: 'flex-start', margin: 0 }}
                />
              ) : param.type === 'select' && param.options ? (
                <select
                  value={String(getActionParam(node, param.name) ?? '')}
                  onChange={event => updateParam(param.name, event.target.value)}
                  style={inputStyle}
                >
                  <option value="">Select...</option>
                  {param.options.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={param.secret ? 'password' : 'text'}
                  placeholder={param.placeholder}
                  value={String(getActionParam(node, param.name) ?? '')}
                  onChange={event => updateParam(param.name, event.target.value)}
                  style={inputStyle}
                />
              )}

              {param.description && (
                <div style={{ color: 'var(--text-faint)', fontSize: 10, lineHeight: 1.45 }}>
                  {param.description}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
