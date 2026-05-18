import { defineConfig } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'https://agentflow.zeeshanahmed.app';
const apiURL = process.env.E2E_API_URL ?? 'https://agentflow-api.zeeshanahmed.app';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  retries: 1,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  metadata: { apiURL },
});
