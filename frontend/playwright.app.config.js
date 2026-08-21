import { defineConfig } from '@playwright/test';

const appUrl = 'http://127.0.0.1:3200';

export default defineConfig({
  testDir: './tests/app',
  testMatch: 'app-smoke.spec.js',
  outputDir: './test-results/app',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/app', open: 'never' }],
  ],
  use: {
    baseURL: appUrl,
    headless: true,
    colorScheme: 'light',
    locale: 'es-MX',
    prefersReducedMotion: 'reduce',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1280, height: 800 },
  },
  expect: {
    timeout: 5_000,
  },
  timeout: 30_000,
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  webServer: {
    command: 'npm run test:app:harness',
    url: `${appUrl}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 1_000 },
  },
});
