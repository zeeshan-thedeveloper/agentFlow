'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';
import ThemeToggle from '@/components/ThemeToggle';

type AccountProfile = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  createdAt: string;
};

type RequestState = 'idle' | 'loading' | 'saving' | 'deleting' | 'saved' | 'error';

interface SettingsViewProps {
  initialUser: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export default function SettingsView({ initialUser }: SettingsViewProps) {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [name, setName] = useState(initialUser.name ?? '');
  const [state, setState] = useState<RequestState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setState('loading');
      setError(null);

      try {
        const response = await fetch('/api/settings/account', { cache: 'no-store' });
        if (!response.ok) throw new Error('Unable to load account settings.');

        const data = (await response.json()) as AccountProfile;
        if (!cancelled) {
          setProfile(data);
          setName(data.name ?? '');
          setState('idle');
        }
      } catch (err) {
        if (!cancelled) {
          setState('error');
          setError(err instanceof Error ? err.message : 'Unable to load account settings.');
        }
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  async function saveProfile() {
    setState('saving');
    setError(null);

    try {
      const response = await fetch('/api/settings/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      const data = (await response.json().catch(() => null)) as (AccountProfile & { error?: string }) | null;
      if (!response.ok) throw new Error(data?.error ?? 'Unable to save account details.');

      setProfile(data);
      setName(data?.name ?? '');
      setState('saved');
      setTimeout(() => setState('idle'), 1800);
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Unable to save account details.');
    }
  }

  async function deleteAccount() {
    setState('deleting');
    setError(null);

    try {
      const response = await fetch('/api/settings/account', { method: 'DELETE' });
      if (!response.ok) throw new Error('Unable to delete account.');

      await signOut({ callbackUrl: '/login' });
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Unable to delete account.');
    }
  }

  const busy = state === 'loading' || state === 'saving' || state === 'deleting';
  const email = profile?.email ?? initialUser.email ?? '';
  const deleteReady = deleteConfirm === email && email.length > 0;

  const displayName = profile?.name ?? initialUser.name ?? email ?? 'Account';
  const initials = displayName
    .split(/\s+/)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <Link href="/canvas" style={brandLinkStyle}>
          <div style={logoBoxStyle}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 1.5C4 1.5 1.5 4 1.5 7S4 12.5 7 12.5 12.5 10 12.5 7 10 1.5 7 1.5z"
                stroke="var(--brand-text)" strokeWidth="1.2" />
              <path d="M4.5 7h2m0 0V4.5m0 2.5L9 4.5"
                stroke="var(--brand-text)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>AgentFlow</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ThemeToggle compact />
          <Link href="/canvas" style={secondaryButtonStyle}>
            Back to canvas
          </Link>
        </div>
      </header>

      <main style={mainStyle}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>Settings</h1>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-faint)', lineHeight: 1.5 }}>
            Manage your account details and workspace preferences.
          </p>
        </div>

        <section style={cardStyle}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Account details
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 16 }}>
            {(profile?.image ?? initialUser.image) ? (
              <img
                src={profile?.image ?? initialUser.image ?? ''}
                alt=""
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  border: '1px solid var(--border-strong)',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                border: '1px solid var(--border-strong)',
                background: 'var(--surface-muted)',
                color: 'var(--text-secondary)',
                display: 'grid',
                placeItems: 'center',
                fontSize: 14,
                fontWeight: 800,
              }}>
                {initials}
              </div>
            )}

            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{displayName}</div>
              {email && (
                <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>{email}</div>
              )}
              {profile?.createdAt && (
                <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>
                  Member since {new Date(profile.createdAt).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>

          <label style={{ display: 'grid', gap: 7, marginTop: 20 }}>
            <span style={labelStyle}>Display name</span>
            <input
              type="text"
              value={name}
              onChange={event => setName(event.target.value)}
              disabled={busy}
              placeholder="Your name"
              style={inputStyle}
            />
          </label>

          <label style={{ display: 'grid', gap: 7, marginTop: 14 }}>
            <span style={labelStyle}>Email</span>
            <input
              type="email"
              value={email}
              readOnly
              style={{ ...inputStyle, color: 'var(--text-muted)', cursor: 'not-allowed' }}
            />
            <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
              Email is managed by your sign-in provider and cannot be changed here.
            </span>
          </label>

          {error && (
            <div style={{ color: '#ef4444', fontSize: 12, marginTop: 12, lineHeight: 1.45 }}>{error}</div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button
              type="button"
              onClick={saveProfile}
              disabled={!name.trim() || busy}
              style={{
                padding: '8px 14px',
                borderRadius: 7,
                border: '1px solid var(--brand-text)',
                background: !name.trim() || busy ? 'rgba(108,99,255,0.28)' : 'var(--brand)',
                color: 'var(--text-inverse)',
                cursor: !name.trim() || busy ? 'default' : 'pointer',
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : 'Save changes'}
            </button>
          </div>
        </section>

        <section style={{ ...cardStyle, borderColor: 'rgba(239,68,68,0.25)' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Danger zone
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Permanently delete your account, workflows, API keys, and integration credentials. This cannot be undone.
          </p>

          {!showDelete ? (
            <button
              type="button"
              onClick={() => setShowDelete(true)}
              disabled={busy}
              style={{
                marginTop: 14,
                padding: '8px 14px',
                borderRadius: 7,
                border: '1px solid rgba(239,68,68,0.45)',
                background: 'rgba(239,68,68,0.08)',
                color: '#ef4444',
                cursor: busy ? 'default' : 'pointer',
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              Delete account
            </button>
          ) : (
            <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
              <label style={{ display: 'grid', gap: 7 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Type <strong style={{ color: 'var(--text-primary)' }}>{email}</strong> to confirm
                </span>
                <input
                  type="text"
                  value={deleteConfirm}
                  onChange={event => setDeleteConfirm(event.target.value)}
                  placeholder={email}
                  disabled={busy}
                  style={inputStyle}
                />
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => { setShowDelete(false); setDeleteConfirm(''); }}
                  disabled={busy}
                  style={secondaryButtonStyle}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={deleteAccount}
                  disabled={!deleteReady || busy}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 7,
                    border: '1px solid rgba(239,68,68,0.55)',
                    background: deleteReady && !busy ? 'rgba(239,68,68,0.15)' : 'transparent',
                    color: deleteReady && !busy ? '#ef4444' : 'var(--text-faint)',
                    cursor: deleteReady && !busy ? 'pointer' : 'default',
                    fontFamily: 'inherit',
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  {state === 'deleting' ? 'Deleting…' : 'Permanently delete account'}
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: 'var(--page-bg, #07080f)',
  color: 'var(--text-primary)',
  fontFamily: 'inherit',
};

const headerStyle: React.CSSProperties = {
  height: 52,
  borderBottom: '1px solid var(--border-subtle)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 16px',
  background: 'var(--panel-wash), var(--panel-bg)',
  boxShadow: 'inset 0 -1px 0 var(--border-strong)',
};

const brandLinkStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 9,
  textDecoration: 'none',
};

const logoBoxStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 8,
  background: 'var(--brand-soft)',
  border: '1px solid rgba(108,99,255,0.35)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: '6px 13px',
  borderRadius: 7,
  background: 'transparent',
  border: '1px solid var(--border-strong)',
  color: 'var(--text-muted)',
  fontSize: 12,
  fontWeight: 500,
  textDecoration: 'none',
  fontFamily: 'inherit',
  cursor: 'pointer',
};

const mainStyle: React.CSSProperties = {
  maxWidth: 560,
  margin: '0 auto',
  padding: '32px 16px 48px',
  display: 'grid',
  gap: 20,
};

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--border-subtle)',
  borderRadius: 10,
  padding: 18,
  background: 'var(--panel-wash), var(--panel-bg)',
};

const labelStyle: React.CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: 'var(--surface-bg)',
  border: '1px solid var(--border-strong)',
  borderRadius: 7,
  color: 'var(--text-primary)',
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
  padding: '10px 11px',
};
