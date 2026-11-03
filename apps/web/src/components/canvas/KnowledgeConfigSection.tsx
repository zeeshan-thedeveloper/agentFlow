'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import {
  addKnowledgeDocument,
  deleteKnowledgeDocument,
  listKnowledgeDocuments,
  type KnowledgeDocument,
} from '@/lib/knowledge-api';
import { DatabaseConnectionSelector } from './DatabaseConnectionSelector';
import type { FlowNode } from './types';

interface Props {
  node: FlowNode;
  onUpdate: (patch: Partial<FlowNode>) => void;
  wiredToAgent: boolean;
}

const COLOR = '#EC4899';
const MAX_FILE_BYTES = 500_000;

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

const hintStyle = { margin: 0, fontSize: 10, lineHeight: 1.5, color: 'var(--text-faint)' } satisfies CSSProperties;

const buttonStyle = (color: string, filled = false): CSSProperties => ({
  width: '100%', height: 32, borderRadius: 7, cursor: 'pointer',
  border: `1px solid ${color}66`, background: filled ? `${color}1f` : 'transparent',
  color, fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
});

/**
 * A Knowledge node points at a knowledge base stored in a PostgreSQL database
 * with pgvector (a free Neon database works). Documents added here are split
 * into chunks and embedded; wired into an Agent, it searches them by meaning.
 */
export function KnowledgeConfigSection({ node, onUpdate, wiredToAgent }: Props) {
  const integrationId = node.integrationId && node.integrationId !== 'database' ? node.integrationId : '';
  const knowledgeBase = node.knowledgeBase ?? '';
  const target = { integrationId, knowledgeBase: knowledgeBase.trim() };

  const [documents, setDocuments] = useState<KnowledgeDocument[] | null>(null);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!target.integrationId || !target.knowledgeBase) {
      setDocuments(null);
      return;
    }
    try {
      setDocuments(await listKnowledgeDocuments(target));
      setError(null);
    } catch (err) {
      setDocuments([]);
      setError(err instanceof Error ? err.message : 'Could not load documents');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.integrationId, target.knowledgeBase]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(work: () => Promise<string | void>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const message = await work();
      if (message) setNotice(message);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function loadFile(file: File) {
    if (file.size > MAX_FILE_BYTES) {
      setError('That file is too large; split it into parts under 500 KB.');
      return;
    }
    setText(await file.text());
    if (!title.trim()) setTitle(file.name);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        fontSize: 11, lineHeight: 1.5, color: 'var(--text-secondary)',
        padding: '9px 11px', borderRadius: 8,
        background: 'rgba(236,72,153,0.08)', border: '1px solid rgba(236,72,153,0.28)',
      }}>
        Connect this to an <strong>Agent</strong>. It searches these documents by meaning and answers from what it
        finds. Documents are stored in your own PostgreSQL database with pgvector; a free{' '}
        <a href="https://neon.tech" target="_blank" rel="noreferrer" style={{ color: COLOR }}>Neon</a> database works.
      </div>

      <DatabaseConnectionSelector
        selectedIntegrationId={integrationId || undefined}
        filterPrefix="database:pg"
        enginePrefix="database:pg"
        engine="postgresql"
        integrationName="PostgreSQL"
        onSelect={id => {
          const name = id ? id.split(':').pop() ?? id : undefined;
          onUpdate({
            integrationId: id || 'database',
            connectionName: name,
            subtitle: name ?? 'Select connection',
          });
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <label style={labelStyle}>Knowledge base</label>
        <input
          value={knowledgeBase}
          onChange={e => onUpdate({ knowledgeBase: e.target.value })}
          placeholder="docs"
          style={inputStyle}
        />
        <p style={hintStyle}>One database can hold several knowledge bases; this name picks which one the agent searches.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <label style={labelStyle}>What the agent can do</label>
        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: 9, padding: '8px 10px', borderRadius: 7, cursor: 'pointer',
          border: `1px solid ${node.allowWrite ? `${COLOR}55` : 'var(--border-subtle)'}`,
        }}>
          <input
            type="checkbox"
            checked={node.allowWrite === true}
            onChange={e => onUpdate({ allowWrite: e.target.checked })}
            style={{ accentColor: COLOR, margin: '2px 0 0', flexShrink: 0 }}
          />
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>Allow the agent to add documents</span>
            <span style={{ fontSize: 10, color: 'var(--text-faint)', lineHeight: 1.45 }}>
              The agent can always search. With this on it can also save notes, answers or summaries here with
              add_to_knowledge, replacing a document of the same name. Off by default: text it reads could try to
              get it to save misleading content.
            </span>
          </span>
        </label>
      </div>

      {target.integrationId && target.knowledgeBase && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <label style={labelStyle}>Documents</label>
            {documents === null ? (
              <p style={hintStyle}>Loading…</p>
            ) : documents.length === 0 ? (
              <p style={hintStyle}>No documents yet. Add one below.</p>
            ) : (
              documents.map(doc => (
                <div key={doc.document} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 7,
                  border: '1px solid var(--border-subtle)', background: 'var(--surface-bg)',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.document}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>
                      {doc.chunks} chunk{doc.chunks === 1 ? '' : 's'} · {doc.characters.toLocaleString()} characters
                    </div>
                  </div>
                  <button
                    type="button"
                    title={`Remove ${doc.document}`}
                    disabled={busy}
                    onClick={() => run(() => deleteKnowledgeDocument(target, doc.document).then(() => `Removed ${doc.document}.`))}
                    style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}
                  >
                    x
                  </button>
                </div>
              ))
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <label style={labelStyle}>Add a document</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Document name, e.g. Refund policy" style={inputStyle} />
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={6}
              placeholder="Paste text, or load a .txt / .md file below…"
              style={{ ...inputStyle, fontSize: 11, resize: 'vertical', lineHeight: 1.55 }}
            />
            <input
              type="file"
              accept=".txt,.md,.markdown,.csv,.json,.html,text/*"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) void loadFile(file);
                e.target.value = '';
              }}
              style={{ fontSize: 11, color: 'var(--text-muted)' }}
            />
            <button
              type="button"
              disabled={busy || !title.trim() || !text.trim()}
              onClick={() => run(async () => {
                const result = await addKnowledgeDocument(target, title.trim(), text);
                setTitle('');
                setText('');
                return `Added ${result.document} (${result.chunks} chunk${result.chunks === 1 ? '' : 's'}).`;
              })}
              style={buttonStyle(COLOR, true)}
            >
              {busy ? 'Embedding…' : 'Add to knowledge base'}
            </button>
            <p style={hintStyle}>
              Text is split into chunks and embedded with your OpenAI key (text-embedding-3-small). Adding a document
              with an existing name replaces it.
            </p>
          </div>
        </>
      )}

      {notice && <p style={{ ...hintStyle, color: '#22c55e' }}>{notice}</p>}
      {error && <p style={{ ...hintStyle, color: '#ef4444' }}>{error}</p>}
      {!wiredToAgent && (
        <p style={{ ...hintStyle, color: '#F59E0B' }}>Connect this node into an Agent to let it search these documents.</p>
      )}
    </div>
  );
}
