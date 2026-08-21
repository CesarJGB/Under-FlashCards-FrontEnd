import appConfig from './playwright.app.config.js';

export default {
  ...appConfig,
  testMatch: 'loading-video-geometry.spec.js',
  outputDir: './test-results/lua-video',
  use: {
    ...appConfig.use,
    trace: 'on',
    video: 'on',
  },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/lua-video', open: 'never' }],
  ],
};
