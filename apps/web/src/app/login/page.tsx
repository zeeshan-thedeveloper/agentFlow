export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { AgentFlowLogo } from '@/components/login/AgentFlowLogo';
import { LoginDecoration } from '@/components/login/LoginDecoration';
import { LandingThemeToggle } from '@/components/landing/LandingThemeToggle';
import GoogleSignInButton from './GoogleSignInButton';
import '../landing.css';

function hasGoogleOAuth() {
  return Boolean(process.env.GOOGLE_CLIENT_ID) &&
    Boolean(process.env.GOOGLE_CLIENT_SECRET) &&
    process.env.GOOGLE_CLIENT_ID !== 'replace-with-google-oauth-client-id' &&
    process.env.GOOGLE_CLIENT_SECRET !== 'replace-with-google-oauth-client-secret';
}

const highlights = [
  'Visual canvas editor',
  'Multi-agent routing',
  'Built-in observability',
];

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  const useGoogle = hasGoogleOAuth();

  if (session?.user) {
    redirect('/canvas');
  }

  return (
    <main className="landing-body relative min-h-screen overflow-x-hidden font-sans selection:bg-violet-500/30">
      <div className="pointer-events-none fixed inset-0 grid-bg opacity-60" />
      <div className="pointer-events-none absolute -left-32 top-20 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />

      <header className="relative z-10 border-b border-white/[0.06] bg-ink-900/65 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
          <Link href="/" className="transition hover:opacity-90">
            <AgentFlowLogo />
          </Link>
          <div className="flex items-center gap-3">
            <LandingThemeToggle />
            <Link
              href="/"
              className="hidden rounded-lg px-4 py-2 text-sm font-semibold text-white/60 transition hover:text-white sm:block"
            >
              Back to home
            </Link>
          </div>
        </nav>
      </header>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl items-center px-5 py-12 sm:px-6 lg:px-8">
        <div className="grid w-full items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div className="hidden lg:block">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-white/70">
              <span className="pulse-dot" />
              Visual AI orchestration
            </div>
            <h1 className="mt-6 text-4xl font-black leading-[1.02] tracking-tight text-white xl:text-5xl">
              Sign in to build agents on a{' '}
              <span className="gradient-text">visual canvas</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-white/[0.62]">
              Design, test, and deploy multi-agent workflows with model routing, tools, memory, and observability in one workspace.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {highlights.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-white/55"
                >
                  {item}
                </span>
              ))}
            </div>
            <LoginDecoration />
          </div>

          <div className="relative mx-auto w-full max-w-md lg:mx-0 lg:justify-self-end">
            <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[28px] bg-violet-600/15 blur-3xl" />
            <section className="glass relative rounded-2xl p-8 shadow-glow sm:p-9">
              <div className="mb-8 lg:hidden">
                <AgentFlowLogo compact />
              </div>

              <p className="text-sm font-bold uppercase tracking-[0.22em] text-cyan-300">Welcome back</p>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
                Sign in to your workspace
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/[0.58]">
                {useGoogle
                  ? 'Continue with Google to access your canvas, workflows, and team settings.'
                  : 'Development mode — sign in without OAuth to explore the app shell.'}
              </p>

              <div className="mt-8 space-y-4">
                <GoogleSignInButton
                  providerId={useGoogle ? 'google' : 'demo'}
                  label={useGoogle ? 'Continue with Google' : 'Continue in dev mode'}
                />

                <p className="text-center text-xs leading-5 text-white/40">
                  Free to start · No credit card required
                </p>
              </div>

              <div className="mt-8 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-violet-400/25 bg-violet-500/10">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path
                        d="M8 2.5L13 5.5V10.5L8 13.5L3 10.5V5.5L8 2.5Z"
                        stroke="#a78bfa"
                        strokeWidth="1.3"
                        strokeLinejoin="round"
                      />
                      <path d="M8 7v3.5" stroke="#a78bfa" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white/85">Ship agent workflows faster</p>
                    <p className="mt-1 text-xs leading-5 text-white/45">
                      Compose triggers, agents, tools, and approval gates on a production-ready canvas.
                    </p>
                  </div>
                </div>
              </div>

              <p className="mt-6 text-center text-sm text-white/45">
                New to AgentFlow?{' '}
                <Link href="/" className="font-semibold text-violet-300 transition hover:text-violet-200">
                  Explore the product
                </Link>
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
