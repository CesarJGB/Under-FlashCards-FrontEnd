import { expect, test } from '@playwright/test';

const SMOKE_HTML = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Playwright browser smoke</title></head>
  <body><main id="smoke-status">ok</main></body>
</html>`;

test('launches a browser and evaluates a local DOM page', async ({ page }, testInfo) => {
  await page.goto(`data:text/html,${encodeURIComponent(SMOKE_HTML)}`, { waitUntil: 'load' });

  await expect(page).toHaveTitle('Playwright browser smoke');
  await expect(page.locator('#smoke-status')).toHaveText('ok');
  expect(await page.evaluate(() => document.querySelector('#smoke-status')?.textContent))
    .toBe('ok');

  await page.screenshot({ path: testInfo.outputPath('browser-smoke.png') });
});
