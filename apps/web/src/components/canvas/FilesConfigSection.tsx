'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useConnectors } from '@/hooks/useConnectors';
import { deleteFile, fileDownloadUrl, listFiles, uploadFile, type StoredFile } from '@/lib/files-api';
import { ConnectorSetup } from './ConnectorSetup';
import { StorageSelector } from './StorageSelector';
import type { FlowNode } from './types';

interface Props {
  node: FlowNode;
  onUpdate: (patch: Partial<FlowNode>) => void;
  wiredToAgent: boolean;
}

const COLOR = '#F97316';
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

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

const formatSize = (bytes: number) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`);

/** Turns a notification on or off; on, it asks where to send it and checks the app is connected. */
function NotifyOption({
  provider,
  label,
  value,
  placeholder,
  hint,
  onChange,
}: {
  provider: 'slack' | 'telegram';
  label: string;
  value: string | undefined;
  placeholder: string;
  hint: string;
  onChange: (value: string | undefined) => void;
}) {
  const { statuses } = useConnectors();
  const enabled = value !== undefined;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 7, padding: '8px 10px', borderRadius: 7,
      border: `1px solid ${enabled ? `${COLOR}55` : 'var(--border-subtle)'}`,
    }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={e => onChange(e.target.checked ? '' : undefined)}
          style={{ accentColor: COLOR, margin: 0 }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{label}</span>
      </label>
      {enabled && (
        <>
          <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
          <p style={hintStyle}>{hint}</p>
          {statuses && !statuses[provider]?.connected && <ConnectorSetup provider={provider} />}
        </>
      )}
    </div>
  );
}

/**
 * A Files node is a folder in the user's S3-compatible storage. Wired into an
 * Agent, the agent can create PDFs there; new files can be announced (with the
 * file attached) on Slack or Telegram.
 */
export function FilesConfigSection({ node, onUpdate, wiredToAgent }: Props) {
  const integrationId = node.integrationId?.startsWith('storage:') ? node.integrationId : '';
  const folder = (node.folder ?? '').trim();

  const [files, setFiles] = useState<StoredFile[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!integrationId || !folder) {
      setFiles(null);
      return;
    }
    try {
      setFiles(await listFiles({ integrationId, folder }));
      setError(null);
    } catch (err) {
      setFiles([]);
      setError(err instanceof Error ? err.message : 'Could not load files');
    }
  }, [integrationId, folder]);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        fontSize: 11, lineHeight: 1.5, color: 'var(--text-secondary)',
        padding: '9px 11px', borderRadius: 8,
        background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.28)',
      }}>
        Connect this to an <strong>Agent</strong> to let it create PDF documents (reports, summaries, invoices…) and
        read the files here: PDFs, images and text. Photos and documents sent to your Telegram bot are saved here
        too. Files live in your own S3-compatible storage, such as Neon storage, Cloudflare R2 or AWS S3.
      </div>

      <StorageSelector
        selectedIntegrationId={integrationId || undefined}
        onSelect={connection => onUpdate({
          integrationId: connection?.integrationId ?? '',
          connectionName: connection?.name,
          subtitle: connection?.name ?? 'Select storage',
        })}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <label style={labelStyle}>Folder</label>
        <input value={node.folder ?? ''} onChange={e => onUpdate({ folder: e.target.value })} placeholder="reports" style={inputStyle} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <label style={labelStyle}>Notify me when a file is added</label>
        <NotifyOption
          provider="slack"
          label="Slack"
          value={node.notifySlackChannel}
          placeholder="Channel id, e.g. C0123ABCD"
          hint="Invite the bot to the channel. The PDF is attached when the Slack app has the files:write scope."
          onChange={value => onUpdate({ notifySlackChannel: value })}
        />
        <NotifyOption
          provider="telegram"
          label="Telegram"
          value={node.notifyTelegramChatId}
          placeholder="Chat id, e.g. 123456789"
          hint="Message your bot first. Your chat id is shown by @userinfobot. The PDF is sent as a document."
          onChange={value => onUpdate({ notifyTelegramChatId: value })}
        />
      </div>

      {integrationId && folder && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <label style={labelStyle}>Files</label>
          {files === null ? (
            <p style={hintStyle}>Loading…</p>
          ) : files.length === 0 ? (
            <p style={hintStyle}>No files yet. Agents add PDFs here when they run, or upload one below.</p>
          ) : (
            files.map(file => (
              <div key={file.id} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 7,
                border: '1px solid var(--border-subtle)', background: 'var(--surface-bg)',
              }}>
                <a
                  href={fileDownloadUrl(integrationId, file.id)}
                  style={{ flex: 1, minWidth: 0, textDecoration: 'none' }}
                  title={`Download ${file.name}`}
                >
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.name}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>
                    {formatSize(file.size)} · {new Date(file.createdAt).toLocaleString()}
                  </div>
                </a>
                <button
                  type="button"
                  title={`Delete ${file.name}`}
                  disabled={busy}
                  onClick={() => run(() => deleteFile(integrationId, file.id).then(() => `Deleted ${file.name}.`))}
                  style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}
                >
                  x
                </button>
              </div>
            ))
          )}
          <input
            type="file"
            disabled={busy}
            onChange={e => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              if (file.size > MAX_UPLOAD_BYTES) {
                setError('Files can be at most 5 MB.');
                return;
              }
              void run(async () => {
                const result = await uploadFile(
                  { integrationId, folder, notifySlackChannel: node.notifySlackChannel, notifyTelegramChatId: node.notifyTelegramChatId },
                  file,
                );
                return [`Added ${result.file.name}.`, ...result.notifications].join(' ');
              });
            }}
            style={{ fontSize: 11, color: 'var(--text-muted)' }}
          />
        </div>
      )}

      {notice && <p style={{ ...hintStyle, color: '#22c55e' }}>{notice}</p>}
      {error && <p style={{ ...hintStyle, color: '#ef4444' }}>{error}</p>}
      {!wiredToAgent && (
        <p style={{ ...hintStyle, color: '#F59E0B' }}>Connect this node into an Agent to let it create PDFs here.</p>
      )}
    </div>
  );
}
