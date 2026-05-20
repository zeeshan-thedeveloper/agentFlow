import type { FlowNode } from './types';
import { IntegrationConfigSection } from './IntegrationConfigSection';
import { QueryRunnerConfigSection } from './QueryRunnerConfigSection';
import { SchemaConfigSection } from './SchemaConfigSection';
import { NODE_TYPES } from './constants';

interface ConfigPanelProps {
  node: FlowNode;
  onUpdate: (patch: Partial<FlowNode>) => void;
  onClose: () => void;
  onDelete: () => void;
  onRun?: () => void;
  runOutput?: unknown;
}

const AVAILABLE_TOOLS: { name: string; label: string; description: string }[] = [
  {
    name: 'http_request',
    label: 'HTTP Request',
    description: 'Fetch data from any URL (GET, POST, …)',
  },
  {
    name: 'web_search',
    label: 'Web Search',
    description: 'Search current web results by query.',
  },
  {
    name: 'scrape_page',
    label: 'Scrape Page',
    description: 'Fetch a URL and extract its readable text content.',
  },
];

const OPENAI_MODELS = [
  { id: 'gpt-4.1', label: 'GPT-4.1' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
  { id: 'gpt-4o', label: 'GPT-4o' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
];

function getModelLabel(modelId: string) {
  return OPENAI_MODELS.find(model => model.id === modelId)?.label ?? modelId;
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 10, fontWeight: 600, color: 'var(--text-faint)',
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 9,
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function getTriggerSubtitle(triggerType: string, inputMode: FlowNode['triggerInputMode']) {
  const mode = inputMode === 'input' ? 'Input' : 'No input';
  return `${triggerType} · ${mode}`;
}

function formatRunOutput(output: unknown) {
  if (output === undefined) return 'No run output yet.';
  if (typeof output === 'string') return output;

  return JSON.stringify(output, null, 2);
}

export default function ConfigPanel({ node, onUpdate, onClose, onDelete, onRun, runOutput }: ConfigPanelProps) {
  const t = NODE_TYPES[node.type as keyof typeof NODE_TYPES] ?? NODE_TYPES.integration;
  const triggerInputMode = node.triggerInputMode ?? 'none';

  return (
    <div style={{
      width: 272, background: 'var(--panel-wash), var(--panel-bg)', borderLeft: '1px solid var(--border-subtle)',
      display: 'flex', flexDirection: 'column',
      boxShadow: 'inset 1px 0 0 var(--border-strong)',
      animation: 'fadeSlide 0.2s ease-out',
    }}>
      <div style={{
        padding: '13px 16px', borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7,
            background: t.glowA, border: `1px solid ${t.color}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.color,
          }}>
            {t.icon}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: t.color, textTransform: 'uppercase', letterSpacing: '0.07em', lineHeight: 1 }}>
              {t.label}
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginTop: 2 }}>
              {node.label}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            width: 22, height: 22, borderRadius: 5, border: '1px solid var(--border-strong)',
            background: 'transparent', color: 'var(--text-faint)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-faint)')}
        >
          x
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        <Section label="Name">
          <input
            value={node.label}
            onChange={e => onUpdate({ label: e.target.value })}
            style={{
              width: '100%', background: 'var(--surface-bg)', border: '1px solid var(--border-strong)',
              borderRadius: 7, padding: '8px 10px', fontSize: 12, color: 'var(--text-primary)',
              outline: 'none', transition: 'border-color 0.15s', fontFamily: 'inherit',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--brand)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border-strong)')}
          />
        </Section>

        {node.type === 'trigger' && (
          <>
            <Section label="Trigger Type">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {NODE_TYPES.trigger.lib.options.map(opt => {
                  const active = (node.triggerType ?? 'Manual') === opt;
                  return (
                    <label key={opt} style={{
                      display: 'flex', alignItems: 'center', gap: 9,
                      padding: '7px 10px', borderRadius: 7, cursor: 'pointer',
                      border: `1px solid ${active ? '#F59E0B50' : 'var(--border-subtle)'}`,
                      background: active ? 'rgba(245,158,11,0.06)' : 'transparent',
                    }}>
                      <input
                        type="radio"
                        checked={active}
                        onChange={() => onUpdate({
                          triggerType: opt,
                          subtitle: getTriggerSubtitle(opt, triggerInputMode),
                        })}
                        style={{ accentColor: '#F59E0B', margin: 0 }}
                      />
                      <span style={{ fontSize: 12, color: active ? 'var(--text-primary)' : 'var(--text-muted)' }}>{opt}</span>
                    </label>
                  );
                })}
              </div>
            </Section>

            <Section label="Input Type">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { value: 'text', label: 'Text' },
                  { value: 'sql', label: 'SQL Query' },
                ].map(option => {
                  const active = (node.inputType ?? 'text') === option.value;
                  return (
                    <label key={option.value} style={{
                      display: 'flex', alignItems: 'center', gap: 9,
                      padding: '7px 10px', borderRadius: 7, cursor: 'pointer',
                      border: `1px solid ${active ? '#F59E0B50' : 'var(--border-subtle)'}`,
                      background: active ? 'rgba(245,158,11,0.06)' : 'transparent',
                    }}>
                      <input
                        type="radio"
                        checked={active}
                        onChange={() => onUpdate({ inputType: option.value as FlowNode['inputType'] })}
                        style={{ accentColor: '#F59E0B', margin: 0 }}
                      />
                      <span style={{ fontSize: 12, color: active ? 'var(--text-primary)' : 'var(--text-muted)' }}>{option.label}</span>
                    </label>
                  );
                })}
              </div>
            </Section>

            <Section label="Input">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { value: 'none', label: 'Without input' },
                  { value: 'input', label: 'With input' },
                ].map(option => {
                  const active = triggerInputMode === option.value;
                  return (
                    <label key={option.value} style={{
                      display: 'flex', alignItems: 'center', gap: 9,
                      padding: '7px 10px', borderRadius: 7, cursor: 'pointer',
                      border: `1px solid ${active ? '#F59E0B50' : 'var(--border-subtle)'}`,
                      background: active ? 'rgba(245,158,11,0.06)' : 'transparent',
                    }}>
                      <input
                        type="radio"
                        checked={active}
                        onChange={() => {
                          const nextMode = option.value as FlowNode['triggerInputMode'];
                          onUpdate({
                            triggerInputMode: nextMode,
                            subtitle: getTriggerSubtitle(node.triggerType ?? 'Manual', nextMode),
                          });
                        }}
                        style={{ accentColor: '#F59E0B', margin: 0 }}
                      />
                      <span style={{ fontSize: 12, color: active ? 'var(--text-primary)' : 'var(--text-muted)' }}>{option.label}</span>
                    </label>
                  );
                })}
              </div>
            </Section>

            {triggerInputMode === 'input' && (
              <Section label="Input Value">
                <textarea
                  value={node.triggerInput ?? ''}
                  onChange={e => onUpdate({ triggerInput: e.target.value })}
                  rows={4}
                  placeholder={
                    node.inputType === 'sql'
                      ? "SELECT * FROM orders WHERE status = 'pending'"
                      : 'Payload or instruction to pass into the agent...'
                  }
                  style={{
                    width: '100%', background: 'var(--surface-bg)', border: '1px solid var(--border-strong)',
                    borderRadius: 7, padding: '8px 10px', fontSize: 11,
                    fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-secondary)',
                    outline: 'none', resize: 'vertical', lineHeight: 1.6,
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => (e.target.style.borderColor = '#F59E0B')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border-strong)')}
                />
              </Section>
            )}

            {(node.triggerType ?? 'Manual') === 'Manual' && (
              <Section label="Manual Trigger">
                <button
                  type="button"
                  onClick={onRun}
                  style={{
                    width: '100%', height: 34, borderRadius: 7,
                    border: '1px solid #F59E0B55',
                    background: 'rgba(245,158,11,0.12)',
                    color: '#F59E0B',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor" aria-hidden="true">
                    <path d="M3 2.1v6.8l5.4-3.4L3 2.1z" />
                  </svg>
                  Run now
                </button>
              </Section>
            )}
          </>
        )}

        {node.type === 'agent' && (
          <>
            <Section label="Model">
              <select
                value={node.model ?? 'gpt-4.1-mini'}
                onChange={e => {
                  const model = e.target.value;
                  onUpdate({
                    provider: 'openai',
                    model,
                    subtitle: `OpenAI - ${getModelLabel(model)}`,
                  });
                }}
                style={{
                  width: '100%', background: 'var(--surface-bg)', border: '1px solid var(--border-strong)',
                  borderRadius: 7, padding: '8px 10px', fontSize: 12, color: 'var(--text-primary)',
                  outline: 'none', fontFamily: 'inherit',
                }}
              >
                {OPENAI_MODELS.map(model => (
                  <option key={model.id} value={model.id}>{model.label}</option>
                ))}
              </select>
            </Section>

            <Section label="Prompt">
              <textarea
                value={node.prompt ?? ''}
                onChange={e => onUpdate({ prompt: e.target.value })}
                rows={8}
                placeholder="Tell this agent what it should do..."
                style={{
                  width: '100%', background: 'var(--surface-bg)', border: '1px solid var(--border-strong)',
                  borderRadius: 7, padding: '8px 10px', fontSize: 11,
                  fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-secondary)',
                  outline: 'none', resize: 'vertical', lineHeight: 1.6,
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--brand)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border-strong)')}
              />
            </Section>

            <Section label="Tools">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {AVAILABLE_TOOLS.map(tool => {
                  const enabled = (node.tools ?? []).includes(tool.name);
                  return (
                    <label
                      key={tool.name}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 9,
                        padding: '8px 10px', borderRadius: 7, cursor: 'pointer',
                        border: `1px solid ${enabled ? 'var(--brand)40' : 'var(--border-subtle)'}`,
                        background: enabled ? 'rgba(99,102,241,0.06)' : 'transparent',
                        transition: 'border-color 0.15s, background 0.15s',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={() => {
                          const current = node.tools ?? [];
                          onUpdate({
                            tools: enabled
                              ? current.filter(t => t !== tool.name)
                              : [...current, tool.name],
                          });
                        }}
                        style={{ accentColor: 'var(--brand)', margin: 0, marginTop: 2, flexShrink: 0 }}
                      />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: enabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {tool.label}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>
                          {tool.description}
                        </div>
                        {tool.name === 'web_search' && enabled && (
                          <div style={{ fontSize: 10, color: '#F59E0B', marginTop: 4 }}>
                            Requires a Tavily API key. Add one via Keys in the toolbar.
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </Section>

            <Section label="Max Iterations">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={node.maxIterations ?? 10}
                  onChange={e => {
                    const val = Math.max(1, Math.min(50, Math.floor(Number(e.target.value))));
                    onUpdate({ maxIterations: Number.isFinite(val) ? val : 10 });
                  }}
                  style={{
                    width: 72,
                    background: 'var(--surface-bg)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 7,
                    padding: '8px 10px',
                    fontSize: 12,
                    color: 'var(--text-primary)',
                    outline: 'none',
                    fontFamily: 'inherit',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => (e.target.style.borderColor = 'var(--brand)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border-strong)')}
                />
                <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                  max 50 · default 10
                </span>
              </div>
            </Section>
          </>
        )}

        {node.type === 'output' && (
          <>
            <Section label="Output">
              <div style={{
                width: '100%',
                border: '1px solid var(--border-strong)',
                background: 'var(--surface-bg)',
                borderRadius: 7,
                padding: '8px 10px',
                color: 'var(--text-secondary)',
                fontSize: 12,
              }}>
                {node.outputMode ?? 'Return output'}
              </div>
            </Section>

            <Section label="Latest Result">
              <pre style={{
                width: '100%',
                maxHeight: 220,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                border: '1px solid var(--border-strong)',
                background: 'var(--surface-bg)',
                borderRadius: 7,
                padding: '9px 10px',
                color: runOutput === undefined ? 'var(--text-faint)' : 'var(--text-secondary)',
                fontSize: 11,
                lineHeight: 1.55,
                fontFamily: "'JetBrains Mono', monospace",
                margin: 0,
              }}>
                {formatRunOutput(runOutput)}
              </pre>
            </Section>
          </>
        )}

        {node.type === 'schema' && (
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
        )}

        {node.type === 'query-runner' && (
          <QueryRunnerConfigSection node={node} onUpdate={onUpdate} />
        )}

        {node.type === 'integration' && (
          <Section label="Integration">
            <IntegrationConfigSection node={node} onUpdate={onUpdate} />
          </Section>
        )}

        <Section label="Node ID">
          <div style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-faint)',
            background: 'var(--surface-bg)', padding: '7px 10px', borderRadius: 6,
          }}>
            {node.id}
          </div>
        </Section>

        <div style={{ marginTop: 8, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
          <button
            type="button"
            onClick={onDelete}
            style={{
              width: '100%',
              height: 34,
              borderRadius: 7,
              border: '1px solid rgba(239,68,68,0.48)',
              background: 'transparent',
              color: '#ef4444',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            Delete node
          </button>
          <p style={{ margin: '8px 0 0', fontSize: 10, color: 'var(--text-faint)', lineHeight: 1.45 }}>
            Or select the node and press Delete / Backspace. Connected edges are removed automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
