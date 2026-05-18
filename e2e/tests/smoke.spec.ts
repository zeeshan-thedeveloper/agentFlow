import { expect, test } from '@playwright/test';

const apiURL = process.env.E2E_API_URL ?? 'https://agentflow-api.zeeshanahmed.app';

test.describe('production smoke', () => {
  test('API health endpoints respond', async ({ request }) => {
    const liveness = await request.get(`${apiURL}/health`);
    expect(liveness.ok()).toBeTruthy();
    const liveBody = await liveness.json();
    expect(liveBody).toMatchObject({ status: 'ok' });

    const readiness = await request.get(`${apiURL}/health/ready`);
    expect(readiness.ok()).toBeTruthy();
    const readyBody = await readiness.json();
    expect(readyBody).toMatchObject({ status: 'ready' });
  });

  test('web app loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/AgentFlow/i);
  });
});
