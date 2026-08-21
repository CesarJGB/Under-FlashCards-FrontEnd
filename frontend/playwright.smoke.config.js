import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/playwright',
  testMatch: 'browser-smoke.spec.js',
  outputDir: './test-results/playwright-smoke',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/playwright-smoke', open: 'never' }],
  ],
  use: {
    headless: true,
    screenshot: 'on',
    trace: 'on',
    video: 'on',
  },
  timeout: 30_000,
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
});
