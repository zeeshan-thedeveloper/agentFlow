export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { authOptions, hasGitHubOAuth, hasGoogleOAuth } from '@/lib/auth';
import { AgentFlowLogo } from '@/components/login/AgentFlowLogo';
import { LoginDecoration } from '@/components/login/LoginDecoration';
import { LandingThemeToggle } from '@/components/landing/LandingThemeToggle';
import GoogleSignInButton from './GoogleSignInButton';
import GitHubSignInButton from './GitHubSignInButton';
import '../landing.css';

const highlights = [
  'Visual canvas editor',
  'Multi-agent routing',
  'Built-in observability',
];

const authErrors: Record<string, string> = {
  OAuthAccountNotLinked:
    'This email is already linked to another sign-in method. Use the provider you signed up with, or contact support.',
  OAuthSignin: 'Could not start sign-in. Please try again.',
  OAuthCallback: 'Sign-in failed during authorization. Please try again.',
  Default: 'Sign-in failed. Please try again.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const session = await getServerSession(authOptions);
  const useGoogle = hasGoogleOAuth();
  const useGitHub = hasGitHubOAuth();
  const useOAuth = useGoogle || useGitHub;
  const authError = searchParams?.error
    ? authErrors[searchParams.error] ?? authErrors.Default
    : null;

  if (session?.user) {
    redirect('/canvas');
  }

  return (
    <main className="landing-body relative min-h-screen overflow-x-hidden font-sans selection:bg-violet-500/30">
      <div className="pointer-events-none fixed inset-0 grid-bg opacity-60" />
      <div className="l-glow-violet pointer-events-none absolute -left-32 top-20 h-96 w-96 rounded-full blur-3xl" />
      <div className="l-glow-cyan pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full blur-3xl" />

      <header className="landing-header relative z-10 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
          <Link href="/" className="transition hover:opacity-90">
            <AgentFlowLogo />
          </Link>
          <div className="flex items-center gap-3">
            <LandingThemeToggle />
            <Link href="/" className="landing-nav-link hidden rounded-lg px-4 py-2 text-sm font-semibold sm:block">
              Back to home
            </Link>
          </div>
        </nav>
      </header>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl items-center px-5 py-12 sm:px-6 lg:px-8">
        <div className="grid w-full items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div className="hidden lg:block">
            <div className="l-pill inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm">
              <span className="pulse-dot" />
              Visual AI orchestration
            </div>
            <h1 className="l-text mt-6 text-4xl font-black leading-[1.02] tracking-tight xl:text-5xl">
              Sign in to build agents on a{' '}
              <span className="gradient-text">visual canvas</span>
            </h1>
            <p className="l-text-secondary mt-5 max-w-lg text-base leading-7">
              Design, test, and deploy multi-agent workflows with model routing, tools, memory, and observability in one workspace.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {highlights.map((item) => (
                <span key={item} className="l-pill rounded-full px-3 py-1.5 text-xs font-semibold">
                  {item}
                </span>
              ))}
            </div>
            <LoginDecoration />
          </div>

          <div className="relative mx-auto w-full max-w-md lg:mx-0 lg:justify-self-end">
            <div className="l-glow-violet pointer-events-none absolute -inset-6 -z-10 rounded-[28px] blur-3xl" />
            <section className="glass relative rounded-2xl p-8 shadow-glow sm:p-9">
              <div className="mb-8 lg:hidden">
                <AgentFlowLogo compact />
              </div>

              <p className="l-accent-cyan text-sm font-bold uppercase tracking-[0.22em]">Welcome back</p>
              <h2 className="l-text mt-3 text-2xl font-black tracking-tight sm:text-3xl">
                Sign in to your workspace
              </h2>
              <p className="l-text-muted mt-3 text-sm leading-6">
                {useOAuth
                  ? 'Continue with your account to access your canvas, workflows, and team settings.'
                  : 'Development mode — sign in without OAuth to explore the app shell.'}
              </p>

              {authError && (
                <p className="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {authError}
                </p>
              )}

              <div className="mt-8 space-y-4">
                {useGoogle && (
                  <GoogleSignInButton providerId="google" label="Continue with Google" />
                )}
                {useGitHub && <GitHubSignInButton />}
                {!useOAuth && (
                  <GoogleSignInButton providerId="demo" label="Continue in dev mode" />
                )}

                <p className="l-text-faint text-center text-xs leading-5">
                  Free to start · No credit card required
                </p>
              </div>

              <div className="l-surface mt-8 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-violet-400/25 bg-violet-500/10">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path
                        d="M8 2.5L13 5.5V10.5L8 13.5L3 10.5V5.5L8 2.5Z"
                        stroke="currentColor"
                        className="l-accent-violet"
                        strokeWidth="1.3"
                        strokeLinejoin="round"
                      />
                      <path d="M8 7v3.5" stroke="currentColor" className="l-accent-violet" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div>
                    <p className="l-text text-sm font-semibold">Ship agent workflows faster</p>
                    <p className="l-text-faint mt-1 text-xs leading-5">
                      Compose triggers, agents, tools, and approval gates on a production-ready canvas.
                    </p>
                  </div>
                </div>
              </div>

              <p className="l-text-faint mt-6 text-center text-sm">
                New to AgentFlow?{' '}
                <Link href="/" className="l-link font-semibold transition">
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
