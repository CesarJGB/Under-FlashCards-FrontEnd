import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import {
  classifyDiagnostics,
  installBrowserDiagnostics,
} from './browserDiagnostics.js';

async function readAppState(page) {
  try {
    return await page.evaluate(() => {
      const root = document.querySelector('#root');
      return {
        childCount: root?.children.length || 0,
        mounted: Boolean(root?.children.length),
      };
    });
  } catch {
    return { childCount: 0, mounted: false };
  }
}

test('sirve y monta la aplicacion React real', async ({ page }, testInfo) => {
  const diagnostics = installBrowserDiagnostics(page);
  let rootResponseStatus = null;
  let appState = { childCount: 0, mounted: false };

  try {
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    rootResponseStatus = response?.status() ?? null;

    expect(response, 'Vite debe responder a GET /.').not.toBeNull();
    expect(rootResponseStatus, 'GET / debe devolver una respuesta exitosa.').toBe(200);

    await page.waitForFunction(
      () => Boolean(document.querySelector('#root')?.children.length),
      undefined,
      { timeout: 10_000 },
    );

    appState = await readAppState(page);
    expect(
      appState.mounted,
      'La aplicacion React no monto; comprueba la configuracion frontend requerida.',
    ).toBe(true);
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();

    await page.waitForTimeout(250);
    const startupDiagnostics = diagnostics.snapshot({
      project: testInfo.project.name,
      browser: testInfo.project.use.browserName,
    });
    expect(startupDiagnostics.pageErrors, 'No debe haber pageerror durante el arranque.').toHaveLength(0);
    const startupClassification = classifyDiagnostics(startupDiagnostics, {
      appMounted: appState.mounted,
      rootResponseStatus,
    });
    expect(
      startupClassification.unexpectedFailureCount,
      'No debe haber fallos inesperados de recursos locales durante el arranque.',
    ).toBe(0);
  } finally {
    appState = await readAppState(page);
    const snapshot = diagnostics.snapshot({
      project: testInfo.project.name,
      browser: testInfo.project.use.browserName,
    });
    const classification = classifyDiagnostics(snapshot, {
      appMounted: appState.mounted,
      rootResponseStatus,
    });
    const evidence = {
      ...snapshot,
      rootResponseStatus,
      rootChildCount: appState.childCount,
      appMounted: appState.mounted,
      ...classification,
    };
    const evidencePath = testInfo.outputPath('app-diagnostics.json');

    await writeFile(evidencePath, JSON.stringify(evidence, null, 2));
    await testInfo.attach('app-diagnostics', {
      path: evidencePath,
      contentType: 'application/json',
    });
    console.log(`APP_DIAGNOSTICS ${JSON.stringify(evidence)}`);
    diagnostics.stop();
  }
});
