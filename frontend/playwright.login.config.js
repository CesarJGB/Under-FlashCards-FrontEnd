// Configuracion Playwright dirigida para la pantalla publica / login.
// Usa la APLICACION REAL servida por Vite (tests/public-home/vite.login.config.js).
// No altera playwright.config.js (manual editor).
import { defineConfig } from '@playwright/test';

const appUrl = 'http://127.0.0.1:3100';

export default defineConfig({
  testDir: './tests/public-home',
  testMatch: 'login-screen.spec.js',
  outputDir: './test-results/login',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/login', open: 'never' }],
  ],
  use: {
    baseURL: appUrl,
    colorScheme: 'light',
    locale: 'es-MX',
    screenshot: 'on',
    trace: 'on',
    video: 'on',
  },
  expect: {
    timeout: 5_000,
  },
  timeout: 60_000,
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
  ],
  webServer: {
    command: 'npm run test:login:harness',
    url: appUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
