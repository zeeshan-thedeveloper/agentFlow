'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import { useConnectors } from '@/hooks/useConnectors';
import {
  connectGitHub,
  connectSlack,
  connectTelegram,
  disconnectConnector,
  slackEventsUrl,
  slackManifest,
  startGoogleConnect,
} from '@/lib/connectors-api';
import type { ConnectorProvider } from './types';

const PROVIDER_LABELS: Record<ConnectorProvider, string> = {
  google: 'Google',
  slack: 'Slack',
  telegram: 'Telegram',
  github: 'GitHub',
};

const inputStyle: CSSProperties = {
  width: '100%', background: 'var(--surface-bg)', border: '1px solid var(--border-strong)',
  borderRadius: 7, padding: '7px 9px', fontSize: 11, color: 'var(--text-primary)',
  outline: 'none', fontFamily: "'JetBrains Mono', monospace",
};

const buttonStyle = (color: string, filled = false): CSSProperties => ({
  width: '100%', height: 32, borderRadius: 7, cursor: 'pointer',
  border: `1px solid ${color}66`, background: filled ? `${color}1f` : 'transparent',
  color, fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
});

const hintStyle: CSSProperties = { fontSize: 10, lineHeight: 1.5, color: 'var(--text-faint)', margin: 0 };

function Steps({ children }: { children: ReactNode }) {
  return <ol style={{ ...hintStyle, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>{children}</ol>;
}

function Link({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" style={{ color: 'var(--brand-text)' }}>{children}</a>;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      style={{ ...buttonStyle('var(--text-muted)'), height: 28, fontSize: 11 }}
    >
      {copied ? 'Copied' : label}
    </button>
  );
}

interface ConnectorSetupProps {
  provider: ConnectorProvider;
  /** Saves the workflow before a full-page redirect (Google sign-in) leaves the canvas. */
  onBeforeLeave?: () => Promise<unknown>;
}

/** Shows whether an app is connected, and walks through connecting it. */
export function ConnectorSetup({ provider, onBeforeLeave }: ConnectorSetupProps) {
  const { statuses, error: loadError, refresh } = useConnectors();
  const status = statuses?.[provider];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const label = PROVIDER_LABELS[provider];
  const field = (name: string) => fields[name] ?? '';
  const setField = (name: string, value: string) => setFields(previous => ({ ...previous, [name]: value }));

  async function run(work: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await work();
      setFields({});
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function connectGoogle() {
    setBusy(true);
    try {
      await onBeforeLeave?.();
    } catch {
      // Unsaved changes would be lost on the redirect, so stop here.
      setBusy(false);
      setError('Save the workflow before connecting Google.');
      return;
    }
    startGoogleConnect();
  }

  if (!statuses) {
    return <p style={hintStyle}>{loadError ? `Could not load connections: ${loadError}` : 'Checking connection…'}</p>;
  }

  const errorLine = error && <p style={{ ...hintStyle, color: '#ef4444' }}>{error}</p>;

  if (status?.connected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 7,
          border: '1px solid rgba(34,197,94,0.35)', background: 'rgba(34,197,94,0.06)',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {label} · {status.name}
          </span>
        </div>

        {provider === 'slack' && status.id && (
          <>
            <p style={hintStyle}>
              To start workflows from Slack, turn on Event Subscriptions in your Slack app with this request URL, and
              subscribe to the bot events <code>app_mention</code> and <code>message.im</code>. Or paste the updated
              manifest into the app&apos;s App Manifest page.
            </p>
            <input readOnly value={slackEventsUrl(status.id)} style={inputStyle} onFocus={e => e.target.select()} />
            <div style={{ display: 'flex', gap: 6 }}>
              <CopyButton text={slackEventsUrl(status.id)} label="Copy URL" />
              <CopyButton text={JSON.stringify(slackManifest(slackEventsUrl(status.id)), null, 2)} label="Copy manifest" />
            </div>
          </>
        )}

        {errorLine}
        <button type="button" disabled={busy} onClick={() => run(() => disconnectConnector(provider))} style={buttonStyle('#ef4444')}>
          {busy ? 'Disconnecting…' : `Disconnect ${label}`}
        </button>
        <p style={hintStyle}>Disconnecting affects every workflow that uses {label}.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {provider === 'google' && (
        <>
          <p style={hintStyle}>You&apos;ll be sent to Google to allow AgentFlow to send email for you. Tick &ldquo;Send email on your behalf&rdquo; there. Agents can only send from Gmail nodes where you allow it, and AgentFlow never reads your mailbox.</p>
          {errorLine}
          <button type="button" disabled={busy} onClick={() => connectGoogle()} style={buttonStyle('#1A73E8', true)}>
            {busy ? 'Opening Google…' : 'Connect Google'}
          </button>
        </>
      )}

      {provider === 'slack' && (
        <>
          <Steps>
            <li>
              <Link href="https://api.slack.com/apps?new_app=1">Create a Slack app</Link> &ldquo;From a manifest&rdquo; and paste the manifest below.
            </li>
            <li>Install it to your workspace, then copy the Bot User OAuth Token (OAuth &amp; Permissions) and the Signing Secret (Basic Information).</li>
            <li>Paste both here. Invite the bot to any channel it should read or post in.</li>
          </Steps>
          <CopyButton text={JSON.stringify(slackManifest(), null, 2)} label="Copy app manifest" />
          <input placeholder="xoxb-…" value={field('botToken')} onChange={e => setField('botToken', e.target.value)} style={inputStyle} />
          <input placeholder="Signing secret" value={field('signingSecret')} onChange={e => setField('signingSecret', e.target.value)} style={inputStyle} />
          {errorLine}
          <button
            type="button"
            disabled={busy || !field('botToken') || !field('signingSecret')}
            onClick={() => run(() => connectSlack(field('botToken').trim(), field('signingSecret').trim()))}
            style={buttonStyle('#E01E5A', true)}
          >
            {busy ? 'Connecting…' : 'Connect Slack'}
          </button>
        </>
      )}

      {provider === 'telegram' && (
        <>
          <Steps>
            <li>In Telegram, message <Link href="https://t.me/BotFather">@BotFather</Link> and send <code>/newbot</code>.</li>
            <li>Paste the token it gives you here. Messages to the bot can then start workflows.</li>
          </Steps>
          <input placeholder="123456:ABC-…" value={field('botToken')} onChange={e => setField('botToken', e.target.value)} style={inputStyle} />
          {errorLine}
          <button
            type="button"
            disabled={busy || !field('botToken')}
            onClick={() => run(() => connectTelegram(field('botToken').trim()))}
            style={buttonStyle('#229ED9', true)}
          >
            {busy ? 'Connecting…' : 'Connect Telegram'}
          </button>
        </>
      )}

      {provider === 'github' && (
        <>
          <Steps>
            <li>
              <Link href="https://github.com/settings/personal-access-tokens/new">Create a fine-grained token</Link> and
              under Repository access pick only the repos agents may use.
            </li>
            <li>
              Repository permissions: Contents, Issues, Pull requests and Metadata set to Read. Set Issues to Read and
              write if agents should open issues or comment.
            </li>
            <li>Paste the token here.</li>
          </Steps>
          <input placeholder="github_pat_…" value={field('token')} onChange={e => setField('token', e.target.value)} style={inputStyle} />
          {errorLine}
          <button
            type="button"
            disabled={busy || !field('token')}
            onClick={() => run(() => connectGitHub(field('token').trim()))}
            style={buttonStyle('#8B5CF6', true)}
          >
            {busy ? 'Connecting…' : 'Connect GitHub'}
          </button>
        </>
      )}
    </div>
  );
}
