'use client';

import { useState } from 'react';
import type { ToolCallRecord } from './types';

const TOOL_NAMES: Record<string, string> = {
  run_sql: 'SQL',
  web_search: 'Search',
  scrape_page: 'Scrape',
  http_request: 'HTTP',
};

/** What the call was asked to do, in one line or a SQL block. */
function describeArgs(call: ToolCallRecord): string {
  if (typeof call.args.sql === 'string') return call.args.sql.trim();
  for (const key of ['query', 'url']) {
    if (typeof call.args[key] === 'string') return call.args[key] as string;
  }
  return JSON.stringify(call.args);
}

/** Short outcome: row count for SQL, otherwise success or the error. */
function describeResult(call: ToolCallRecord): string {
  if (!call.ok) return call.result.replace(/^Error running tool "[^"]+": /, '');
  if (call.tool === 'run_sql') {
    const match = call.result.match(/"rowCount":("[^"]*"|\d+)/);
    const count = match ? match[1].replace(/"/g, '') : '?';
    return `${count} row${count === '1' ? '' : 's'}`;
  }
  return 'done';
}

interface RunToolCallsProps {
  calls: ToolCallRecord[];
  scale: number;
}

/** Collapsible list of the tools an agent used during its last run. */
export default function RunToolCalls({ calls, scale }: RunToolCallsProps) {
  const [open, setOpen] = useState(false);
  const sqlCount = calls.filter(call => call.tool === 'run_sql').length;
  const summary =
    sqlCount === calls.length
      ? `${sqlCount} SQL ${sqlCount === 1 ? 'query' : 'queries'}`
      : `${calls.length} tool call${calls.length === 1 ? '' : 's'}`;
  const failed = calls.filter(call => !call.ok).length;

  return (
    <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 5,
          padding: `${5 * scale}px ${10 * scale}px`, background: 'transparent', border: 'none',
          cursor: 'pointer', fontFamily: 'inherit', fontSize: 10 * scale, fontWeight: 600,
          color: 'var(--text-muted)', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 9 * scale }}>{open ? '▾' : '▸'}</span>
        {summary}
        {failed > 0 && <span style={{ color: '#EF4444' }}>· {failed} failed</span>}
      </button>

      {open && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 6 * scale,
          padding: `0 ${10 * scale}px ${8 * scale}px`, maxHeight: 180 * scale, overflowY: 'auto',
        }}>
          {calls.map((call, index) => (
            <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: 3 * scale }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 9 * scale, fontWeight: 700 }}>
                <span style={{ color: 'var(--text-faint)', letterSpacing: '0.05em' }}>
                  {TOOL_NAMES[call.tool] ?? call.tool}
                  {typeof call.args.database === 'string' ? ` · ${call.args.database}` : ''}
                </span>
                <span
                  title={call.ok ? undefined : call.result}
                  style={{
                    color: call.ok ? '#22C55E' : '#EF4444',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%',
                  }}
                >
                  {call.ok ? '✓' : '✗'} {describeResult(call)}
                </span>
              </div>
              <pre style={{
                margin: 0, padding: `${5 * scale}px ${7 * scale}px`, borderRadius: 5,
                background: 'var(--surface-bg)', border: '1px solid var(--border-subtle)',
                fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5 * scale, lineHeight: 1.45,
                color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {describeArgs(call)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
