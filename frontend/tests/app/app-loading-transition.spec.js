import { expect, test } from '@playwright/test';

const HARNESS_URL = '/tests/app/loading-transition.html';

async function openHarness(page) {
  await page.goto(HARNESS_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('app-loading-screen')).toHaveAttribute('data-loading-phase', 'video');
}

async function rememberDashboard(page) {
  await page.evaluate(() => {
    window.__appLoadingDashboardNode = document.querySelector('[data-testid="dashboard-screen"]');
  });
}

async function expectSameDashboard(page) {
  await expect.poll(() => page.evaluate(() => (
    window.__appLoadingDashboardNode === document.querySelector('[data-testid="dashboard-screen"]')
  ))).toBe(true);
}

async function holdRevealTransition(page) {
  await page.addStyleTag({
    content: '.app-loading-curtain[data-loading-phase="revealing"] { transition-duration: 10s !important; }',
  });
}

async function dispatchTransitionEnd(page, propertyName) {
  await page.getByTestId('app-loading-curtain').evaluate((curtain, property) => {
    const event = new Event('transitionend', { bubbles: true });
    Object.defineProperty(event, 'propertyName', { value: property });
    curtain.dispatchEvent(event);
  }, propertyName);
}

test('inicia con Lua y ended muestra la firma de marca sin desmontar el overlay', async ({ page }) => {
  await openHarness(page);
  await rememberDashboard(page);

  const video = page.getByTestId('lua-loading-video');
  await expect(video).toHaveAttribute('preload', 'auto');
  await expect(video).toHaveAttribute('autoplay', '');
  await expect(video).toHaveAttribute('playsinline', '');
  await expect(page.getByTestId('app-loading-brand-splash')).toBeHidden();
  await expect(page.getByTestId('dashboard-screen')).toBeAttached();

  await video.dispatchEvent('ended');

  await expect(page.getByTestId('app-loading-screen')).toHaveAttribute('data-loading-phase', 'brand');
  await expect(page.getByTestId('app-loading-brand-icon')).toHaveAttribute('src', '/icons/icon-512.png');
  await expect(page.getByTestId('app-loading-brand-logo')).toHaveAttribute('alt', 'Under Flashcards');
  await expect(page.getByTestId('app-loading-screen')).toBeAttached();
  await expectSameDashboard(page);
});

test('la cortina revela el mismo Dashboard y solo entonces libera la interacción', async ({ page }) => {
  await openHarness(page);
  await holdRevealTransition(page);
  await rememberDashboard(page);

  const button = page.getByTestId('dashboard-action');
  const overlayBlocksButton = await button.evaluate((target) => {
    const rect = target.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return Boolean(hit?.closest('[data-testid="app-loading-screen"]'));
  });
  expect(overlayBlocksButton).toBe(true);

  await page.getByTestId('lua-loading-video').dispatchEvent('ended');
  await expect(page.getByTestId('app-loading-screen')).toHaveAttribute('data-loading-phase', 'revealing');
  await expect(page.getByTestId('app-loading-curtain')).toHaveAttribute('data-loading-phase', 'revealing');
  await expect(page.getByTestId('dashboard-screen')).toBeAttached();
  await expectSameDashboard(page);
  const revealStillBlocksButton = await button.evaluate((target) => {
    const rect = target.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return Boolean(hit?.closest('[data-testid="app-loading-screen"]'));
  });
  expect(revealStillBlocksButton).toBe(true);

  await dispatchTransitionEnd(page, 'background-color');
  await expect(page.getByTestId('app-loading-screen')).toBeAttached();

  await dispatchTransitionEnd(page, 'transform');

  await expect(page.getByTestId('app-loading-screen')).toHaveCount(0);
  await expect(page.getByTestId('loading-complete-count')).toHaveText('1');
  await expectSameDashboard(page);
  await button.click();
  await expect(page.getByTestId('dashboard-click-count')).toHaveText('1');
});

test('un error del MP4 continúa por brand y termina en Dashboard', async ({ page }) => {
  await openHarness(page);
  await holdRevealTransition(page);

  await page.getByTestId('lua-loading-video').dispatchEvent('error');

  await expect(page.getByTestId('app-loading-screen')).toHaveAttribute('data-loading-phase', 'brand');
  await expect(page.getByTestId('app-loading-brand-splash')).toBeVisible();
  await expect(page.getByTestId('app-loading-screen')).toHaveAttribute('data-loading-phase', 'revealing');
  await dispatchTransitionEnd(page, 'transform');
  await expect(page.getByTestId('app-loading-screen')).toHaveCount(0);
  await expect(page.getByTestId('dashboard-screen')).toBeVisible();
});

test('el fallback del reveal completa aunque transitionend no llegue', async ({ page }) => {
  await openHarness(page);
  await holdRevealTransition(page);

  await page.getByTestId('lua-loading-video').dispatchEvent('ended');
  await expect(page.getByTestId('app-loading-screen')).toHaveAttribute('data-loading-phase', 'revealing');
  await expect(page.getByTestId('app-loading-screen')).toHaveCount(0);
  await expect(page.getByTestId('loading-complete-count')).toHaveText('1');
  await expect(page.getByTestId('dashboard-screen')).toBeVisible();
});

test('reduced motion conserva la marca y sustituye el desplazamiento por un fade corto', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openHarness(page);
  await holdRevealTransition(page);

  await page.getByTestId('lua-loading-video').dispatchEvent('ended');
  await expect(page.getByTestId('app-loading-screen')).toHaveAttribute('data-loading-phase', 'brand');
  await expect(page.getByTestId('app-loading-brand-splash')).toBeVisible();
  await expect(page.getByTestId('app-loading-screen')).toHaveAttribute('data-loading-phase', 'revealing');

  const revealStyle = await page.getByTestId('app-loading-curtain').evaluate((curtain) => {
    const style = getComputedStyle(curtain);
    return {
      transform: style.transform,
      transitionProperty: style.transitionProperty,
    };
  });
  expect(revealStyle.transform).toBe('none');
  expect(revealStyle.transitionProperty).toBe('opacity');

  await dispatchTransitionEnd(page, 'opacity');
  await expect(page.getByTestId('app-loading-screen')).toHaveCount(0);
  await expect(page.getByTestId('dashboard-screen')).toBeVisible();
});

test('captura la firma y el reveal en móvil y desktop', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'La inspección visual local se captura una vez.');

  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(viewport);
    await openHarness(page);
    await page.getByTestId('lua-loading-video').dispatchEvent('ended');
    await expect(page.getByTestId('app-loading-screen')).toHaveAttribute('data-loading-phase', 'brand');
    await page.waitForTimeout(320);
    await page.screenshot({
      path: testInfo.outputPath(`brand-${viewport.width}x${viewport.height}.png`),
    });

    await expect(page.getByTestId('app-loading-screen')).toHaveAttribute('data-loading-phase', 'revealing');
    await page.waitForTimeout(220);
    await page.screenshot({
      path: testInfo.outputPath(`reveal-${viewport.width}x${viewport.height}.png`),
    });
    await expect(page.getByTestId('app-loading-screen')).toHaveCount(0);
  }
});
