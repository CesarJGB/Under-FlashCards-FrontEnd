import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
import appConfig from './playwright.app.config.js';

const frontendUrl = appConfig.use.baseURL;
const backendUrl = 'http://127.0.0.1:8101';

const backendRoot = fileURLToPath(new URL('../backend', import.meta.url));
const frontendRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  ...appConfig,
  testMatch: 'fullstack-smoke.spec.js',
  outputDir: './test-results/app-fullstack',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/app-fullstack', open: 'never' }],
  ],
  webServer: [
    {
      name: 'Frontend app',
      command: 'npm run test:app:harness',
      cwd: frontendRoot,
      url: `${frontendUrl}/`,
      env: {
        UNDER_FLASH_APP_FULLSTACK: '1',
        UNDER_FLASH_APP_BACKEND_URL: backendUrl,
        VITE_BACKEND_URL: '',
      },
      reuseExistingServer: false,
      timeout: 120_000,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 1_000 },
    },
    {
      name: 'Backend API',
      command: 'npm start',
      cwd: backendRoot,
      url: `${backendUrl}/api/health`,
      env: {
        PORT: '8101',
      },
      reuseExistingServer: false,
      timeout: 120_000,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 1_000 },
    },
  ],
});
