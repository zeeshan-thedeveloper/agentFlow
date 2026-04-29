import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import ThemeToggle from '@/components/ThemeToggle';
import GoogleSignInButton from './GoogleSignInButton';

function hasGoogleOAuth() {
  return Boolean(process.env.GOOGLE_CLIENT_ID) &&
    Boolean(process.env.GOOGLE_CLIENT_SECRET) &&
    process.env.GOOGLE_CLIENT_ID !== 'replace-with-google-oauth-client-id' &&
    process.env.GOOGLE_CLIENT_SECRET !== 'replace-with-google-oauth-client-secret';
}

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  const useGoogle = hasGoogleOAuth();

  if (session?.user) {
    redirect('/canvas');
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background:
          'radial-gradient(circle at 50% 0%, rgba(108,99,255,0.20), transparent 34%), var(--app-bg)',
      }}
    >
      <div style={{ position: 'fixed', top: 18, right: 18 }}>
        <ThemeToggle />
      </div>

      <section
        style={{
          width: '100%',
          maxWidth: 392,
          border: '1px solid var(--border-strong)',
          borderRadius: 8,
          background: 'var(--panel-bg)',
          padding: 28,
          boxShadow: '0 24px 80px var(--shadow-soft)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: 'var(--brand-soft)',
              border: '1px solid rgba(108,99,255,0.35)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d="M7 1.5C4 1.5 1.5 4 1.5 7S4 12.5 7 12.5 12.5 10 12.5 7 10 1.5 7 1.5z"
                stroke="var(--brand-text)"
                strokeWidth="1.2"
              />
              <path
                d="M4.5 7h2m0 0V4.5m0 2.5L9 4.5"
                stroke="var(--brand-text)"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>AgentFlow</span>
        </div>

        <h1 style={{ margin: 0, fontSize: 26, lineHeight: 1.15, color: 'var(--text-primary)' }}>
          Sign in to your workspace
        </h1>
        <p style={{ margin: '10px 0 24px', color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
          Use Google to enter the authenticated app shell and start building workflows.
        </p>

        <GoogleSignInButton
          providerId={useGoogle ? 'google' : 'demo'}
          label={useGoogle ? 'Continue with Google' : 'Continue in dev'}
        />
      </section>
    </main>
  );
}
