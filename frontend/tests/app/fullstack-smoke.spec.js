import { expect, test } from '@playwright/test';

async function readHealthThroughFrontendProxy(page) {
  return page.evaluate(async () => {
    const response = await fetch('/api/health', { cache: 'no-store' });
    let body = null;

    try {
      body = await response.json();
    } catch {
      // La asercion del smoke reporta una respuesta no JSON como fallo.
    }

    return {
      url: response.url,
      status: response.status,
      body,
    };
  });
}

test('conecta la app real con el backend y Mongo mediante el proxy', async ({ page }) => {
  const rootResponse = await page.goto('/', { waitUntil: 'domcontentloaded' });

  expect(rootResponse?.status()).toBe(200);
  await page.waitForFunction(() => Boolean(document.querySelector('#root')?.children.length));
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();

  await expect.poll(
    async () => (await readHealthThroughFrontendProxy(page)).body?.db,
    { timeout: 30_000, intervals: [250, 500, 1_000] },
  ).toBe(1);

  const health = await readHealthThroughFrontendProxy(page);
  expect(health.url).toBe(new URL('/api/health', page.url()).toString());
  expect(health.status).toBe(200);
  expect(health.body).toMatchObject({
    status: 'ok',
    service: 'flashcards-backend',
    db: 1,
  });
});
