import { defineConfig } from '@playwright/test';

const harnessUrl = 'http://127.0.0.1:4174/tests/manual-editor/harness.html';

export default defineConfig({
  testDir: './tests/manual-editor',
  testMatch: 'manual-editor-current.spec.js',
  outputDir: './test-results/manual-editor',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/manual-editor', open: 'never' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4174',
    colorScheme: 'light',
    locale: 'es-MX',
    prefersReducedMotion: 'reduce',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  expect: {
    timeout: 5_000,
  },
  timeout: 30_000,
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        hasTouch: true,
      },
    },
    {
      name: 'webkit',
      use: {
        browserName: 'webkit',
        viewport: { width: 393, height: 852 },
        hasTouch: true,
      },
    },
    {
      name: 'firefox',
      use: { browserName: 'firefox', viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command: 'npm run test:manual-editor:harness',
    url: harnessUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
