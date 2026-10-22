'use client';

import { useState } from 'react';
import type { WorkflowRun } from '@/hooks/useWorkflowRuns';
import { NODE_TYPES } from './constants';
import type { FlowNode } from './types';

interface RunHistoryPanelProps {
  runs: WorkflowRun[] | null;
  nodes: FlowNode[];
  onClose: () => void;
  /** Lights up the canvas with this run's node results and outputs. */
  onShowRun: (run: WorkflowRun) => void;
}

const SOURCES = {
  slack: { label: 'Slack', color: NODE_TYPES.slack.color },
  telegram: { label: 'Telegram', color: NODE_TYPES.telegram.color },
  manual: { label: 'Run button', color: '#8b95a7' },
} as const;

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString();
}

function duration(run: WorkflowRun): string | null {
  if (!run.completedAt) return null;
  const ms = new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime();
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function StatusPill({ status }: { status: WorkflowRun['status'] }) {
  const running = status === 'RUNNING' || status === 'PENDING';
  const color = running ? 'var(--brand-text)' : status === 'COMPLETED' ? '#22c55e' : '#ef4444';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
      fontSize: 10, fontWeight: 600, color, padding: '2px 7px', borderRadius: 99,
      border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%', background: 'currentColor',
        animation: running ? 'pulseGlow 1s infinite' : 'none',
      }} />
      {running ? 'Running' : status === 'COMPLETED' ? 'Done' : 'Failed'}
    </span>
  );
}

/** Recent runs of the workflow: what started each one and what every node produced. */
export default function RunHistoryPanel({ runs, nodes, onClose, onShowRun }: RunHistoryPanelProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const labelOf = (id: string) => nodes.find(node => node.id === id)?.label ?? 'Removed node';

  return (
    <div style={{
      width: 300, background: 'var(--panel-wash), var(--panel-bg)', borderLeft: '1px solid var(--border-subtle)',
      display: 'flex', flexDirection: 'column', boxShadow: 'inset 1px 0 0 var(--border-strong)',
      animation: 'fadeSlide 0.2s ease-out',
    }}>
      <div style={{
        padding: '13px 16px', borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Run history</div>
          <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>Last 20 runs · updates live</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Close"
          style={{
            width: 22, height: 22, borderRadius: 5, border: '1px solid var(--border-strong)',
            background: 'transparent', color: 'var(--text-faint)', cursor: 'pointer', fontSize: 13,
          }}
        >
          x
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {runs === null && <p style={{ fontSize: 11, color: 'var(--text-faint)', margin: 6 }}>Loading runs…</p>}
        {runs?.length === 0 && (
          <p style={{ fontSize: 11, color: 'var(--text-faint)', margin: 6, lineHeight: 1.5 }}>
            No runs yet. Click Run, or message your Slack or Telegram bot if a trigger listens for it.
          </p>
        )}

        {runs?.map(run => {
          const source = SOURCES[run.trigger?.source ?? 'manual'];
          const open = openId === run.id;
          const results = (run.results ?? []).filter(result => result.status !== 'SKIPPED');
          const from =
            run.trigger?.source === 'slack' ? `<@${run.trigger.from}> in ${run.trigger.channel}`
            : run.trigger?.source === 'telegram' ? run.trigger.from
            : null;

          return (
            <div key={run.id} style={{
              borderRadius: 8, border: `1px solid ${open ? 'var(--border-hover)' : 'var(--border-subtle)'}`,
              background: 'var(--button-bg)',
            }}>
              <button
                type="button"
                onClick={() => setOpenId(open ? null : run.id)}
                style={{
                  width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
                  padding: '9px 10px', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: 5,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: source.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{source.label}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-faint)', flex: 1 }}>{timeAgo(run.startedAt)}</span>
                  <StatusPill status={run.status} />
                </span>
                {run.trigger?.text && (
                  <span style={{
                    fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.45,
                    display: '-webkit-box', WebkitLineClamp: open ? 'unset' : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    &ldquo;{run.trigger.text}&rdquo;
                  </span>
                )}
                {from && <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>from {from}</span>}
              </button>

              {open && (
                <div style={{ padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {run.summary && <p style={{ margin: 0, fontSize: 10, color: '#ef4444', lineHeight: 1.45 }}>{run.summary}</p>}
                  {results.length === 0 && !run.summary && (
                    <p style={{ margin: 0, fontSize: 10, color: 'var(--text-faint)' }}>
                      {run.livePhases ? 'Still running…' : 'No node results were saved for this run.'}
                    </p>
                  )}
                  {results.map(result => (
                    <div key={result.nodeId} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 10 }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{labelOf(result.nodeId)}</span>
                        <span style={{ color: result.status === 'FAILED' ? '#ef4444' : 'var(--text-faint)' }}>
                          {result.status === 'FAILED' ? 'failed' : result.toolCalls?.length ? `${result.toolCalls.length} tool call${result.toolCalls.length === 1 ? '' : 's'}` : 'done'}
                        </span>
                      </span>
                      {result.output && result.output !== '{}' && result.output !== 'null' && (
                        <pre style={{
                          margin: 0, maxHeight: 120, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                          fontSize: 10, lineHeight: 1.5, padding: '6px 8px', borderRadius: 6,
                          background: 'var(--surface-bg)', color: 'var(--text-secondary)',
                          fontFamily: "'JetBrains Mono', monospace",
                        }}>
                          {result.output}
                        </pre>
                      )}
                    </div>
                  ))}
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{duration(run) ?? ''}</span>
                    {results.length > 0 && (
                      <button
                        type="button"
                        onClick={() => onShowRun(run)}
                        style={{
                          fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                          padding: '4px 9px', borderRadius: 6, border: '1px solid var(--border-strong)',
                          background: 'transparent', color: 'var(--brand-text)',
                        }}
                      >
                        Show on canvas
                      </button>
                    )}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
