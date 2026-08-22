import { defineConfig } from '@playwright/test';

const harnessUrl = 'http://127.0.0.1:4176';

export default defineConfig({
  testDir: './tests/mobile-floating',
  testMatch: 'mobile-floating.spec.js',
  outputDir: './test-results/mobile-floating',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/mobile-floating', open: 'never' }],
  ],
  use: {
    baseURL: harnessUrl,
    headless: true,
    colorScheme: 'light',
    locale: 'es-MX',
    prefersReducedMotion: 'reduce',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  expect: { timeout: 5_000 },
  timeout: 30_000,
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  webServer: {
    command: 'vite --config tests/mobile-floating/vite.harness.config.js --host 127.0.0.1 --port 4176 --strictPort',
    url: `${harnessUrl}/tests/mobile-floating/harness.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 1_000 },
  },
});
