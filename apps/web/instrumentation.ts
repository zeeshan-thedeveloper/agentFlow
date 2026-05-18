import { validateEnv } from './src/config/env.validator';

export async function register(): Promise<void> {
  validateEnv();
}
