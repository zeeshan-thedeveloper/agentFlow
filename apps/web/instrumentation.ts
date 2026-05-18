import { validateEnv } from './src/config/env.validator';

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    validateEnv();

    const dsn = process.env.SENTRY_DSN;
    if (dsn) {
      const Sentry = await import('@sentry/nextjs');
      Sentry.init({
        dsn,
        environment: process.env.NODE_ENV ?? 'development',
        tracesSampleRate: 0.1,
      });
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge' && process.env.SENTRY_DSN) {
    const Sentry = await import('@sentry/nextjs');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV ?? 'development',
      tracesSampleRate: 0.1,
    });
  }
}
