import { expect, test } from '@playwright/test';

const MOBILE_VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 393, height: 852 },
  { width: 430, height: 932 },
];

async function readGeometry(page) {
  return page.evaluate(() => {
    const fab = document.querySelector('[data-testid="floating-control"]').getBoundingClientRect();
    const nav = document.querySelector('[data-testid="dashboard-mobile-nav"]').getBoundingClientRect();
    return {
      fab: { top: fab.top, bottom: fab.bottom, height: fab.height },
      nav: { top: nav.top, bottom: nav.bottom, height: nav.height },
      viewportHeight: window.innerHeight,
    };
  });
}

async function waitForNavAnimation(page) {
  await page.getByTestId('dashboard-mobile-nav').evaluate((nav) => (
    Promise.all(nav.getAnimations().map((animation) => animation.finished))
  ));
}

function expectMobileContract(geometry, expectedBottom = 12) {
  expect(geometry.fab.height).toBe(56);
  expect(geometry.nav.height).toBeGreaterThan(0);
  expect(Math.abs((geometry.nav.top - geometry.fab.bottom) - 16)).toBeLessThanOrEqual(0.5);
  expect(Math.abs((geometry.viewportHeight - geometry.nav.bottom) - expectedBottom)).toBeLessThanOrEqual(0.5);
  expect(geometry.fab.top).toBeGreaterThanOrEqual(0);
  expect(geometry.fab.bottom).toBeLessThanOrEqual(geometry.nav.top);
}

test('el FAB permanece separado del navbar en viewports iPhone y tras resize', async ({ page }) => {
  await page.goto('/tests/mobile-floating/harness.html');
  await waitForNavAnimation(page);

  for (const viewport of MOBILE_VIEWPORTS) {
    await page.setViewportSize(viewport);
    await expect(page.getByTestId('floating-control')).toBeVisible();
    await waitForNavAnimation(page);
    expectMobileContract(await readGeometry(page));
  }
});

test('el navbar real sigue siendo la fuente al cambiar su altura y el inset inferior resuelto', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORTS[0]);
  await page.goto('/tests/mobile-floating/harness.html');
  await expect(page.getByTestId('floating-control')).toBeVisible();
  await waitForNavAnimation(page);

  const baseline = await readGeometry(page);
  expectMobileContract(baseline);

  await page.getByTestId('dashboard-mobile-nav').evaluate((nav) => {
    nav.style.height = '84px';
  });
  const resizedNav = await readGeometry(page);
  expectMobileContract(resizedNav);
  expect(resizedNav.fab.top).toBeCloseTo(baseline.fab.top - 16, 4);

  await page.getByTestId('dashboard-bottom-dock').evaluate((dock) => {
    dock.style.bottom = '46px';
  });
  expectMobileContract(await readGeometry(page), 46);
});

test('desktop conserva el host a seis rem del borde y oculta el navbar móvil', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/tests/mobile-floating/harness.html');

  await expect(page.getByTestId('dashboard-mobile-nav')).toBeHidden();
  const fab = await page.getByTestId('floating-control').boundingBox();
  expect(fab).not.toBeNull();
  expect(768 - (fab.y + fab.height)).toBeCloseTo(96, 4);
});
