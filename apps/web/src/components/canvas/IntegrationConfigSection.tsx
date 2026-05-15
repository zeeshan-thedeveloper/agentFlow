'use client';

import { useState, type CSSProperties } from 'react';
import { useCredentialStatus, useIntegrations } from '@/hooks/useIntegrations';
import { deleteCredential } from '@/lib/integrations-api';
import { CredentialDialog } from './CredentialDialog';
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

function getActionParam(node: FlowNode, name: string) {
  return node.actionParams?.[name];
}

export function IntegrationConfigSection({ node, onUpdate }: Props) {
  const { integrations, loading } = useIntegrations();
  const { status, refresh } = useCredentialStatus(node.integrationId);
  const [showDialog, setShowDialog] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const selectedIntegration = integrations.find(integration => integration.id === node.integrationId);
  const selectedAction = selectedIntegration?.actions.find(action => action.id === node.actionId);

  function updateParam(name: string, value: unknown) {
    onUpdate({
      actionParams: {
        ...node.actionParams,
        [name]: value,
      },
    });
  }

  async function handleDisconnect() {
    if (!node.integrationId || disconnecting) return;

    setDisconnecting(true);
    try {
      await deleteCredential(node.integrationId);
      refresh();
    } catch (error) {
      console.error(error);
    } finally {
      setDisconnecting(false);
    }
  }

  if (loading) {
    return <div style={{ color: 'var(--text-faint)', fontSize: 12 }}>Loading integrations...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Integration
        </label>
        <select
          value={node.integrationId ?? ''}
          onChange={event => onUpdate({ integrationId: event.target.value || undefined, actionId: undefined, actionParams: {} })}
          style={inputStyle}
        >
          <option value="">Select integration...</option>
          {integrations.map(integration => (
            <option key={integration.id} value={integration.id}>
              {integration.name}
            </option>
          ))}
        </select>
      </div>

      {node.integrationId && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <span
            aria-hidden="true"
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: status?.connected ? '#22c55e' : '#ef4444',
              flexShrink: 0,
            }}
          />
          <span style={{ color: 'var(--text-secondary)', flex: 1, minWidth: 0, wordBreak: 'break-word' }}>
            {status?.connected ? status.maskedHint ?? 'Connected' : 'Not connected'}
          </span>
          {status?.connected ? (
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnecting}
              style={{
                border: 0,
                background: 'transparent',
                color: disconnecting ? 'var(--text-faint)' : '#ef4444',
                cursor: disconnecting ? 'default' : 'pointer',
                fontFamily: 'inherit',
                fontSize: 11,
                fontWeight: 700,
                padding: 0,
              }}
            >
              {disconnecting ? 'Disconnecting' : 'Disconnect'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowDialog(true)}
              style={{
                border: 0,
                background: 'transparent',
                color: 'var(--brand-text)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 11,
                fontWeight: 700,
                padding: 0,
              }}
            >
              Connect
            </button>
          )}
        </div>
      )}

      {selectedIntegration && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Action
          </label>
          <select
            value={node.actionId ?? ''}
            onChange={event => onUpdate({ actionId: event.target.value || undefined, actionParams: {} })}
            style={inputStyle}
          >
            <option value="">Select action...</option>
            {selectedIntegration.actions.map(action => (
              <option key={action.id} value={action.id}>
                {action.name}
              </option>
            ))}
          </select>
        </div>
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

      {showDialog && node.integrationId && selectedIntegration && (
        <CredentialDialog
          integrationId={node.integrationId}
          integrationName={selectedIntegration.name}
          onConnected={() => {
            refresh();
            setShowDialog(false);
          }}
          onClose={() => setShowDialog(false)}
        />
      )}
    </div>
  );
}
