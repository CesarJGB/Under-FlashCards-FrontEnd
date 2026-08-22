import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const HARNESS_URL = '/tests/app/loading-transition.html';

async function openHarness(page) {
  await page.goto(HARNESS_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('app-loading-screen')).toHaveAttribute('data-loading-phase', 'video');
}

async function waitForPhase(page, phase) {
  await expect(page.getByTestId('app-loading-screen')).toHaveAttribute('data-loading-phase', phase);
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

async function expectNoSimultaneousBrandAssets(page) {
  const visibility = await page.evaluate(() => {
    const isVisible = (element) => {
      if (!element) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number.parseFloat(style.opacity) > 0
        && rect.width > 0
        && rect.height > 0;
    };

    return {
      icon: isVisible(document.querySelector('[data-testid="app-loading-brand-icon"]')),
      logo: isVisible(document.querySelector('[data-testid="app-loading-brand-logo"]')),
    };
  });

  expect(
    visibility.icon && visibility.logo,
    'El icono PWA y el logo completo no deben ser visibles simultáneamente.',
  ).toBe(false);
}

async function expectDocumentSurface(page, expectedColor, expectedThemeColor) {
  await expect.poll(() => page.evaluate(() => ({
    html: getComputedStyle(document.documentElement).backgroundColor,
    body: getComputedStyle(document.body).backgroundColor,
    root: getComputedStyle(document.getElementById('root')).backgroundColor,
    themeColor: document.head.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
    themeColorCount: document.head.querySelectorAll('meta[name="theme-color"]').length,
  }))).toEqual({
    html: expectedColor,
    body: expectedColor,
    root: expectedColor,
    themeColor: expectedThemeColor,
    themeColorCount: 1,
  });
}

async function startPhaseRecorder(page) {
  await page.evaluate(() => {
    const screen = document.querySelector('[data-testid="app-loading-screen"]');
    window.__appLoadingPhaseSnapshots = [];
    const record = () => {
      const icon = document.querySelector('[data-testid="app-loading-brand-icon"]');
      const logo = document.querySelector('[data-testid="app-loading-brand-logo"]');
      window.__appLoadingPhaseSnapshots.push({
        phase: screen?.dataset.loadingPhase || null,
        iconCount: icon ? 1 : 0,
        logoCount: logo ? 1 : 0,
        iconAnimationName: icon ? getComputedStyle(icon).animationName : null,
        logoAnimationName: logo ? getComputedStyle(logo).animationName : null,
      });
    };
    record();
    window.__appLoadingPhaseObserver = new MutationObserver(record);
    window.__appLoadingPhaseObserver.observe(screen, {
      attributes: true,
      attributeFilter: ['data-loading-phase'],
    });
  });
}

async function readPhaseSnapshot(page, phase) {
  let snapshot;
  await expect.poll(async () => {
    snapshot = await page.evaluate((expectedPhase) => (
      window.__appLoadingPhaseSnapshots?.find((candidate) => candidate.phase === expectedPhase)
      || null
    ), phase);
    return snapshot;
  }).not.toBeNull();
  return snapshot;
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

test('VIDEO → BRAND_ICON → BRAND_ICON_EXIT → BRAND_LOGO mantiene los recursos exclusivos', async ({ page }) => {
  await openHarness(page);
  await holdRevealTransition(page);
  await rememberDashboard(page);
  await startPhaseRecorder(page);

  const video = page.getByTestId('lua-loading-video');
  await expect(video).toHaveAttribute('preload', 'auto');
  await expect(video).toHaveAttribute('autoplay', '');
  await expect(video).toHaveAttribute('playsinline', '');
  await expect(page.getByTestId('app-loading-brand-splash')).toBeHidden();
  await expect(page.getByTestId('app-loading-brand-icon')).toHaveCount(0);
  await expect(page.getByTestId('app-loading-brand-logo')).toHaveCount(0);
  await expect(page.getByTestId('dashboard-screen')).toBeAttached();
  await expectNoSimultaneousBrandAssets(page);

  await video.dispatchEvent('ended');

  await waitForPhase(page, 'brand-icon');
  await expect(page.getByTestId('app-loading-brand-icon')).toBeVisible();
  await expect(page.getByTestId('app-loading-brand-icon')).toHaveAttribute('src', '/icons/icon-512.png');
  await expect(page.getByTestId('app-loading-brand-logo')).toHaveCount(0);
  await expectNoSimultaneousBrandAssets(page);

  await waitForPhase(page, 'brand-logo');
  await expect(page.getByTestId('app-loading-brand-icon')).toHaveCount(0);
  await expect(page.getByTestId('app-loading-brand-logo')).toBeVisible();
  await expect(page.getByTestId('app-loading-brand-logo')).toHaveAttribute('alt', 'Under Flashcards');
  await expectNoSimultaneousBrandAssets(page);
  const exitSnapshot = await readPhaseSnapshot(page, 'brand-icon-exit');
  expect(exitSnapshot).toMatchObject({
    iconCount: 1,
    logoCount: 0,
    iconAnimationName: 'app-loading-icon-out',
  });
  const phaseSnapshots = await page.evaluate(() => window.__appLoadingPhaseSnapshots);
  expect(phaseSnapshots.every(({ iconCount, logoCount }) => !(iconCount && logoCount))).toBe(true);
  await expect(page.getByTestId('app-loading-screen')).toBeAttached();
  await expectSameDashboard(page);
});

test('la cortina revela hacia arriba el mismo Dashboard y solo entonces libera la interacción', async ({ page }) => {
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
  await waitForPhase(page, 'revealing');
  await expect(page.getByTestId('app-loading-curtain')).toHaveAttribute('data-loading-phase', 'revealing');
  await expect(page.getByTestId('app-loading-brand-icon')).toHaveCount(0);
  await expect(page.getByTestId('app-loading-brand-logo')).toBeVisible();
  await expect(page.getByTestId('dashboard-screen')).toBeAttached();
  await expectSameDashboard(page);

  const revealStyle = await page.getByTestId('app-loading-curtain').evaluate((curtain) => {
    const style = getComputedStyle(curtain);
    return {
      transform: style.transform,
      transitionProperty: style.transitionProperty,
    };
  });
  expect(revealStyle.transform).not.toBe('none');
  expect(revealStyle.transitionProperty).toContain('transform');

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

test('un error del MP4 continúa por toda la secuencia brand y termina en Dashboard', async ({ page }) => {
  await openHarness(page);
  await holdRevealTransition(page);

  await page.getByTestId('lua-loading-video').dispatchEvent('error');

  await waitForPhase(page, 'brand-icon');
  await expect(page.getByTestId('app-loading-brand-icon')).toBeVisible();
  await expect(page.getByTestId('app-loading-brand-logo')).toHaveCount(0);
  await waitForPhase(page, 'brand-logo');
  await expect(page.getByTestId('app-loading-brand-icon')).toHaveCount(0);
  await expect(page.getByTestId('app-loading-brand-logo')).toBeVisible();
  await waitForPhase(page, 'revealing');
  await dispatchTransitionEnd(page, 'transform');
  await expect(page.getByTestId('app-loading-screen')).toHaveCount(0);
  await expect(page.getByTestId('dashboard-screen')).toBeVisible();
});

test('el fallback del reveal completa aunque transitionend no llegue', async ({ page }) => {
  await openHarness(page);
  await holdRevealTransition(page);

  await page.getByTestId('lua-loading-video').dispatchEvent('ended');
  await waitForPhase(page, 'revealing');
  await expect(page.getByTestId('app-loading-screen')).toHaveCount(0);
  await expect(page.getByTestId('loading-complete-count')).toHaveText('1');
  await expect(page.getByTestId('dashboard-screen')).toBeVisible();
});

test('reduced motion conserva la secuencia exclusiva y sustituye el desplazamiento por un fade corto', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openHarness(page);
  await holdRevealTransition(page);
  await startPhaseRecorder(page);

  await page.getByTestId('lua-loading-video').dispatchEvent('ended');
  await waitForPhase(page, 'brand-icon');
  await expect(page.getByTestId('app-loading-brand-icon')).toHaveCSS('animation-name', 'app-loading-reduced-fade-in');
  await expect(page.getByTestId('app-loading-brand-logo')).toHaveCount(0);
  await expectNoSimultaneousBrandAssets(page);

  await waitForPhase(page, 'brand-logo');
  await expect(page.getByTestId('app-loading-brand-icon')).toHaveCount(0);
  await expect(page.getByTestId('app-loading-brand-logo')).toHaveCSS('animation-name', 'app-loading-reduced-fade-in');
  await expectNoSimultaneousBrandAssets(page);
  const reducedExitSnapshot = await readPhaseSnapshot(page, 'brand-icon-exit');
  expect(reducedExitSnapshot).toMatchObject({
    iconCount: 1,
    logoCount: 0,
    iconAnimationName: 'app-loading-reduced-fade-out',
  });
  await waitForPhase(page, 'revealing');

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

test('sincroniza la superficie y theme-color durante el lila y restaura ambos al llegar a Home', async ({ page }) => {
  const indexHtml = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
  const manifest = JSON.parse(await readFile(
    new URL('../../public/manifest.webmanifest', import.meta.url),
    'utf8',
  ));
  expect(indexHtml).toMatch(/name="viewport"[^>]+content="[^"]*viewport-fit=cover[^"]*"/);
  expect(indexHtml).toMatch(/name="apple-mobile-web-app-status-bar-style"\s+content="black-translucent"/);
  expect(indexHtml).toMatch(/name="theme-color"\s+content="#7c3aed"/);
  expect(manifest).toMatchObject({ background_color: '#FBFAFF', theme_color: '#7C3AED' });

  await openHarness(page);
  await holdRevealTransition(page);
  await expectDocumentSurface(page, 'rgb(251, 250, 255)', '#7c3aed');

  await page.getByTestId('lua-loading-video').dispatchEvent('ended');
  await waitForPhase(page, 'brand-icon');
  await expectDocumentSurface(page, 'rgb(237, 233, 254)', '#EDE9FE');
  await waitForPhase(page, 'brand-logo');
  await expectDocumentSurface(page, 'rgb(237, 233, 254)', '#EDE9FE');
  await waitForPhase(page, 'revealing');
  await expectDocumentSurface(page, 'rgb(237, 233, 254)', '#EDE9FE');

  await dispatchTransitionEnd(page, 'transform');
  await expect(page.getByTestId('app-loading-screen')).toHaveCount(0);
  await expectDocumentSurface(page, 'rgb(255, 255, 255)', '#7c3aed');
  await expect.poll(() => page.evaluate(() => ({
    html: document.documentElement.style.backgroundColor,
    body: document.body.style.backgroundColor,
    root: document.getElementById('root').style.backgroundColor,
  }))).toEqual({ html: '', body: '', root: '' });
});

test('restaura la superficie y theme-color original si el loading se desmonta durante el lila', async ({ page }) => {
  await openHarness(page);
  await page.getByTestId('lua-loading-video').dispatchEvent('ended');
  await waitForPhase(page, 'brand-icon');
  await expectDocumentSurface(page, 'rgb(237, 233, 254)', '#EDE9FE');

  await page.getByTestId('unmount-app-loading').evaluate((button) => button.click());

  await expect(page.getByTestId('app-loading-screen')).toHaveCount(0);
  await expect(page.getByTestId('loading-complete-count')).toHaveText('0');
  await expectDocumentSurface(page, 'rgb(255, 255, 255)', '#7c3aed');
  await expect.poll(() => page.evaluate(() => ({
    html: document.documentElement.style.backgroundColor,
    body: document.body.style.backgroundColor,
    root: document.getElementById('root').style.backgroundColor,
  }))).toEqual({ html: '', body: '', root: '' });
});

test('el safety timeout completa una sola vez y también restaura el fondo del documento', async ({ page }) => {
  await page.addInitScript(() => {
    const nativeSetTimeout = window.setTimeout.bind(window);
    window.setTimeout = (callback, delay, ...args) => nativeSetTimeout(
      callback,
      delay === 12000 ? 250 : delay,
      ...args,
    );
  });
  await openHarness(page);

  await expect(page.getByTestId('app-loading-screen')).toHaveCount(0);
  await expect(page.getByTestId('loading-complete-count')).toHaveText('1');
  await expect(page.getByTestId('dashboard-screen')).toBeVisible();
  await expectDocumentSurface(page, 'rgb(255, 255, 255)', '#7c3aed');
  await expect.poll(() => page.evaluate(() => ({
    html: document.documentElement.style.backgroundColor,
    body: document.body.style.backgroundColor,
    root: document.getElementById('root').style.backgroundColor,
  }))).toEqual({ html: '', body: '', root: '' });
});

test('captura icono, logo exclusivo, reveal y Home en móvil y desktop', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'La inspección visual local se captura una vez.');

  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(viewport);
    await openHarness(page);
    await page.getByTestId('lua-loading-video').dispatchEvent('ended');

    await waitForPhase(page, 'brand-icon');
    await page.waitForTimeout(320);
    await page.screenshot({
      path: testInfo.outputPath(`brand-icon-${viewport.width}x${viewport.height}.png`),
    });

    await waitForPhase(page, 'brand-logo');
    await expect(page.getByTestId('app-loading-brand-icon')).toHaveCount(0);
    await page.waitForTimeout(320);
    await page.screenshot({
      path: testInfo.outputPath(`brand-logo-${viewport.width}x${viewport.height}.png`),
    });

    await waitForPhase(page, 'revealing');
    await page.getByTestId('app-loading-curtain').evaluate((curtain) => {
      const transformTransition = curtain.getAnimations().find(
        (animation) => animation.transitionProperty === 'transform',
      );
      if (transformTransition) {
        transformTransition.pause();
        transformTransition.currentTime = 310;
      }
    });
    await page.screenshot({
      path: testInfo.outputPath(`reveal-${viewport.width}x${viewport.height}.png`),
    });

    await dispatchTransitionEnd(page, 'transform');
    await expect(page.getByTestId('app-loading-screen')).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath(`home-${viewport.width}x${viewport.height}.png`),
    });
  }
});
