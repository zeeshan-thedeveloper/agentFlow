const REQUIRED = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'API_KEY_ENCRYPTION_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
] as const;

const MIN_SECRET_LENGTH: Record<string, number> = {
  NEXTAUTH_SECRET: 32,
  API_KEY_ENCRYPTION_SECRET: 32,
};

export function validateEnv(): void {
  const missing: string[] = [];
  const tooShort: string[] = [];

  for (const key of REQUIRED) {
    const value = process.env[key];
    if (!value) {
      missing.push(key);
      continue;
    }
    const min = MIN_SECRET_LENGTH[key];
    if (min && value.length < min) {
      tooShort.push(`${key} (got ${value.length}, need ${min})`);
    }
  }

  if (missing.length || tooShort.length) {
    throw new Error(
      `Environment validation failed: missing=[${missing.join(', ')}] tooShort=[${tooShort.join(', ')}]`,
    );
  }
}
