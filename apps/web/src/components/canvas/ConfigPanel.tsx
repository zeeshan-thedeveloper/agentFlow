import { useState } from 'react';
import type { FlowNode } from './types';
import { NODE_TYPES, MODELS, SKILLS_LIST } from './constants';

interface ConfigPanelProps {
  node: FlowNode;
  onUpdate: (patch: Partial<FlowNode>) => void;
  onClose: () => void;
}

function IcoChevron({ d = 'down', size = 10 }: { d?: 'down' | 'up'; size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 10 10" fill="none"
      style={{ transform: d === 'up' ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}
    >
      <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 10, fontWeight: 600, color: '#555566',
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 9,
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

export default function ConfigPanel({ node, onUpdate, onClose }: ConfigPanelProps) {
  const t = NODE_TYPES[node.type];
  const [model, setModel]             = useState(node.model ?? 'claude');
  const [temp, setTemp]               = useState(node.temp ?? 0.7);
  const [prompt, setPrompt]           = useState(node.prompt ?? '');
  const [showModelPicker, setShowPicker] = useState(false);

  const selModel = MODELS.find(m => m.id === model) ?? MODELS[0];

  return (
    <div style={{
      width: 272, background: '#12121A', borderLeft: '1px solid #1E1E28',
      display: 'flex', flexDirection: 'column',
      animation: 'fadeSlide 0.2s ease-out',
    }}>
      {/* Header */}
      <div style={{
        padding: '13px 16px', borderBottom: '1px solid #1E1E28',
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
            <div style={{ fontSize: 12, fontWeight: 500, color: '#E0E0EF', marginTop: 2 }}>
              {node.label}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            width: 22, height: 22, borderRadius: 5, border: '1px solid #2A2A35',
            background: 'transparent', color: '#555566', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#A0A0B0')}
          onMouseLeave={e => (e.currentTarget.style.color = '#555566')}
        >✕</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

        {/* Name */}
        <Section label="Name">
          <input
            value={node.label}
            onChange={e => onUpdate({ label: e.target.value })}
            style={{
              width: '100%', background: '#0D0D0F', border: '1px solid #2A2A35',
              borderRadius: 7, padding: '8px 10px', fontSize: 12, color: '#E0E0EF',
              outline: 'none', transition: 'border-color 0.15s', fontFamily: 'inherit',
            }}
            onFocus={e => (e.target.style.borderColor = '#6C63FF')}
            onBlur={e => (e.target.style.borderColor = '#2A2A35')}
          />
        </Section>

        {/* Agent: model picker */}
        {node.type === 'agent' && (
          <Section label="Model">
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowPicker(p => !p)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', background: '#0D0D0F',
                  border: `1px solid ${showModelPicker ? '#6C63FF' : '#2A2A35'}`,
                  borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'border-color 0.15s',
                }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: 5,
                  background: 'rgba(108,99,255,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <rect x="1" y="1" width="9" height="9" rx="1.5" stroke="#8B87FF" strokeWidth="1.1" />
                    <path d="M3.5 5.5h4M3.5 3.5h4M3.5 7.5h2.5" stroke="#8B87FF" strokeWidth="1.1" strokeLinecap="round" />
                  </svg>
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#E0E0EF' }}>{selModel.label}</div>
                  <div style={{ fontSize: 10, color: '#555566' }}>{selModel.sub}</div>
                </div>
                <IcoChevron d={showModelPicker ? 'up' : 'down'} />
              </button>

              {showModelPicker && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                  background: '#1A1A22', border: '1px solid #2A2A35',
                  borderRadius: 8, overflow: 'hidden', zIndex: 50,
                  boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
                  animation: 'popIn 0.15s ease-out',
                }}>
                  {MODELS.map(m => (
                    <button
                      key={m.id}
                      onClick={() => { setModel(m.id); setShowPicker(false); onUpdate({ model: m.id }); }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between', padding: '9px 12px',
                        background: model === m.id ? 'rgba(108,99,255,0.12)' : 'transparent',
                        border: 'none', borderBottom: '1px solid #1E1E28',
                        cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { if (model !== m.id) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                      onMouseLeave={e => { if (model !== m.id) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: model === m.id ? '#8B87FF' : '#E0E0EF', textAlign: 'left' }}>
                          {m.label}
                        </div>
                        <div style={{ fontSize: 10, color: '#555566', textAlign: 'left' }}>{m.sub}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {m.badge && (
                          <span style={{
                            fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 99,
                            background: 'rgba(108,99,255,0.2)', color: '#8B87FF',
                            border: '1px solid rgba(108,99,255,0.3)',
                          }}>
                            {m.badge}
                          </span>
                        )}
                        {model === m.id && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2.5 6l2.5 2.5 4.5-5" stroke="#6C63FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Trigger: trigger type */}
        {node.type === 'trigger' && (
          <Section label="Trigger Type">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {['Manual', 'Cron Schedule', 'Webhook'].map(opt => {
                const active = (node.triggerType ?? 'Manual') === opt;
                return (
                  <label key={opt} style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    padding: '7px 10px', borderRadius: 7, cursor: 'pointer',
                    border: `1px solid ${active ? '#F59E0B50' : '#1E1E28'}`,
                    background: active ? 'rgba(245,158,11,0.06)' : 'transparent',
                  }}>
                    <input
                      type="radio"
                      checked={active}
                      onChange={() => onUpdate({ triggerType: opt })}
                      style={{ accentColor: '#F59E0B', margin: 0 }}
                    />
                    <span style={{ fontSize: 12, color: active ? '#F0F0F5' : '#888899' }}>{opt}</span>
                  </label>
                );
              })}
            </div>
          </Section>
        )}

        {/* Skill: skill type */}
        {node.type === 'skill' && (
          <Section label="Skill Type">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SKILLS_LIST.map(s => {
                const active = (node.skillType ?? 'Code Review') === s;
                return (
                  <button
                    key={s}
                    onClick={() => onUpdate({ skillType: s })}
                    style={{
                      padding: '5px 10px', borderRadius: 6, fontFamily: 'inherit',
                      border: `1px solid ${active ? '#22C55E60' : '#1E1E28'}`,
                      background: active ? 'rgba(34,197,94,0.1)' : 'transparent',
                      color: active ? '#4ade80' : '#888899',
                      fontSize: 11, fontWeight: 500, cursor: 'pointer',
                      transition: 'all 0.12s',
                    }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        {/* Output: destination */}
        {node.type === 'output' && (
          <Section label="Destination">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {['Slack', 'Email', 'Dashboard', 'Webhook'].map(d => {
                const active = (node.destination ?? 'Slack') === d;
                return (
                  <button
                    key={d}
                    onClick={() => onUpdate({ destination: d })}
                    style={{
                      padding: 8, borderRadius: 7, fontFamily: 'inherit', textAlign: 'center',
                      border: `1px solid ${active ? '#3B82F660' : '#1E1E28'}`,
                      background: active ? 'rgba(59,130,246,0.1)' : 'transparent',
                      color: active ? '#60a5fa' : '#888899',
                      fontSize: 11, fontWeight: 500, cursor: 'pointer',
                      transition: 'all 0.12s',
                    }}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        {/* Agent: temperature */}
        {node.type === 'agent' && (
          <Section label={`Temperature · ${temp.toFixed(1)}`}>
            <input
              type="range" min="0" max="1" step="0.1" value={temp}
              onChange={e => {
                const v = parseFloat(e.target.value);
                setTemp(v);
                onUpdate({ temp: v });
              }}
              style={{
                background: `linear-gradient(to right, #6C63FF ${temp * 100}%, #2A2A35 ${temp * 100}%)`,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 10, color: '#555566' }}>
              <span>Precise</span><span>Creative</span>
            </div>
          </Section>
        )}

        {/* Agent: system prompt */}
        {node.type === 'agent' && (
          <Section label="System Prompt">
            <textarea
              value={prompt}
              onChange={e => { setPrompt(e.target.value); onUpdate({ prompt: e.target.value }); }}
              rows={4}
              placeholder="You are an expert code reviewer analyzing GitHub issues for priority and impact…"
              style={{
                width: '100%', background: '#0D0D0F', border: '1px solid #2A2A35',
                borderRadius: 7, padding: '8px 10px', fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace", color: '#C0C0CF',
                outline: 'none', resize: 'vertical', lineHeight: 1.6,
                transition: 'border-color 0.15s',
              }}
              onFocus={e => (e.target.style.borderColor = '#6C63FF')}
              onBlur={e => (e.target.style.borderColor = '#2A2A35')}
            />
          </Section>
        )}

        {/* Node ID */}
        <Section label="Node ID">
          <div style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#555566',
            background: '#0D0D0F', padding: '7px 10px', borderRadius: 6,
          }}>
            {node.id}
          </div>
        </Section>
      </div>
    </div>
  );
}
