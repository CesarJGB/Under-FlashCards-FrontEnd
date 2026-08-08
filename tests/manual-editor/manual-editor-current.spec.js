import { expect, test } from '@playwright/test';

const HARNESS_PATH = '/tests/manual-editor/harness.html';

async function openHarness(page, { touch = false } = {}) {
  if (touch) {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, get: () => 1 });
    });
  }
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort());
  await page.goto(HARNESS_PATH, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__manualEditorHarness?.ready === true);
}

async function chooseAndOpen(page, fixture, side = 'question') {
  await page.evaluate(({ fixtureName, initialSide }) => {
    window.__manualEditorHarness.chooseFixture(fixtureName, initialSide, true);
  }, { fixtureName: fixture, initialSide: side });
  await expect(page.getByTestId('manual-card-editor-modal')).toBeVisible();
  await expect(page.getByTestId(`manual-card-editor-${side}`)).toBeVisible();
}

async function closeThroughHarness(page) {
  await page.evaluate(() => window.__manualEditorHarness.close());
  await expect(page.getByTestId('manual-card-editor-modal')).toHaveCount(0);
}

async function attachDiagnostics(page, testInfo, label) {
  const evidence = await page.evaluate(() => ({
    events: window.__manualEditorHarness.getDiagnostics(),
    snapshot: window.__manualEditorHarness.captureSnapshot(),
  }));
  await testInfo.attach(`${label}-diagnostics.json`, {
    body: JSON.stringify(evidence, null, 2),
    contentType: 'application/json',
  });
}

async function closePaletteByBackdrop(page) {
  await page.locator('[data-color-palette="true"]').evaluate((palette) => {
    palette.previousElementSibling?.click();
  });
  await expect(page.locator('[data-color-palette="true"]')).toHaveCount(0);
}

test('PW-CHAR-001 / EDITOR-SCROLL-001 / EDITOR-STATE-001 — apertura, selección, scroll y 20 ciclos', async ({ page }, testInfo) => {
  await openHarness(page);
  const baselineListeners = await page.evaluate(() => window.__manualEditorHarness.getListenerSnapshot());
  const appScrollRoot = page.getByTestId('harness-app-scroll-root');
  await appScrollRoot.evaluate((node) => { node.scrollTop = 240; });
  await expect.poll(() => appScrollRoot.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);

  await chooseAndOpen(page, 'empty', 'question');
  const emptyTextarea = page.getByTestId('manual-card-editor-question');
  await expect(emptyTextarea).toHaveJSProperty('tagName', 'TEXTAREA');
  await expect(emptyTextarea).toHaveValue('');
  await closeThroughHarness(page);

  await chooseAndOpen(page, 'distinct', 'question');
  const questionTextarea = page.getByTestId('manual-card-editor-question');
  await questionTextarea.fill('Pregunta sintética escrita en el harness.');
  await page.evaluate(() => window.__manualEditorHarness.setSelection(3, 14, 'forward'));
  await expect.poll(() => questionTextarea.evaluate((node) => [node.selectionStart, node.selectionEnd]))
    .toEqual([3, 14]);

  await page.getByTestId('manual-card-editor-switch-side').click();
  const answerTextarea = page.getByTestId('manual-card-editor-answer');
  await expect(answerTextarea).toBeVisible();
  await answerTextarea.fill('Respuesta sintética escrita de forma independiente.');
  await page.evaluate(() => window.__manualEditorHarness.setSelection(6, 21, 'backward'));
  await expect.poll(() => answerTextarea.evaluate((node) => [node.selectionStart, node.selectionEnd]))
    .toEqual([6, 21]);

  await page.getByTestId('manual-card-editor-switch-side').click();
  await expect(page.getByTestId('manual-card-editor-question'))
    .toHaveValue('Pregunta sintética escrita en el harness.');
  await closeThroughHarness(page);

  await chooseAndOpen(page, 'long', 'question');
  const longTextarea = page.getByTestId('manual-card-editor-question');
  const lineCount = await longTextarea.evaluate((node) => node.value.split('\n').length);
  expect(lineCount).toBeGreaterThanOrEqual(30);

  await page.evaluate(() => window.__manualEditorHarness.setSelection(8, 26, 'forward'));
  await expect.poll(() => longTextarea.evaluate((node) => ({
    start: node.selectionStart,
    end: node.selectionEnd,
    direction: node.selectionDirection,
  }))).toEqual({ start: 8, end: 26, direction: 'forward' });

  const scrollContract = await longTextarea.evaluate((node) => {
    const editor = node.closest('[role="dialog"]')?.querySelector('main');
    node.scrollTop = Math.max(1, node.scrollHeight);
    if (editor) editor.scrollTop = Math.max(1, editor.scrollHeight);
    const footer = node.closest('[role="dialog"]')?.querySelector('footer');
    return {
      textareaScrollable: node.scrollHeight > node.clientHeight,
      textareaScrollTop: node.scrollTop,
      editorOverflow: editor ? getComputedStyle(editor).overflowY : '',
      footerSharesSurface: Boolean(footer && editor && footer.parentElement === editor.parentElement),
    };
  });
  expect(scrollContract.textareaScrollable).toBe(true);
  expect(scrollContract.textareaScrollTop).toBeGreaterThan(0);
  expect(scrollContract.editorOverflow).toBe('auto');
  expect(scrollContract.footerSharesSurface).toBe(true);
  await closeThroughHarness(page);

  for (let cycle = 0; cycle < 20; cycle += 1) {
    await page.evaluate(() => window.__manualEditorHarness.open('question'));
    await expect(page.getByTestId('manual-card-editor-modal')).toBeVisible();
    await page.evaluate(() => window.__manualEditorHarness.close());
    await expect(page.getByTestId('manual-card-editor-modal')).toHaveCount(0);
  }

  const finalListeners = await page.evaluate(() => window.__manualEditorHarness.getListenerSnapshot());
  expect(finalListeners).toEqual(baselineListeners);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  expect(await page.evaluate(() => window.__manualEditorHarness.getRenderCount())).toBeGreaterThan(20);
  await attachDiagnostics(page, testInfo, 'PW-CHAR-001');
});

test('PW-CHAR-002 / EDITOR-COLOR-004 — menús DOM, presets y stubs de color/imagen', async ({ page }, testInfo) => {
  await openHarness(page);
  await chooseAndOpen(page, 'distinct', 'question');
  const textarea = page.getByTestId('manual-card-editor-question');
  await textarea.focus();
  await page.evaluate(() => window.__manualEditorHarness.setSelection(4, 15, 'forward'));

  const colorTrigger = page.getByTestId('manual-card-editor-color');
  await colorTrigger.click();
  await expect(page.locator('[data-color-palette="true"]')).toBeVisible();
  await colorTrigger.evaluate((node) => node.click());
  await expect(page.locator('[data-color-palette="true"]')).toHaveCount(0);

  await colorTrigger.click();
  await page.locator('[data-color-palette="true"]').getByRole('button', { name: 'Azul' }).click();
  await expect(page.locator('[data-color-palette="true"]')).toHaveCount(0);
  await expect.poll(() => textarea.evaluate((node) => getComputedStyle(node).color)).toBe('rgb(59, 130, 246)');

  const alignTrigger = page.getByTestId('manual-card-editor-align');
  await alignTrigger.click();
  await page.getByRole('button', { name: 'Centro', exact: true }).click();
  await expect(textarea).toHaveCSS('text-align', 'center');

  await page.evaluate(() => {
    window.__manualEditorHarness.resetPickerState();
    window.__manualEditorHarness.configureColorPicker('success');
  });
  await colorTrigger.click();
  await page.getByRole('button', { name: 'Color personalizado' }).click();
  await expect.poll(() => page.evaluate(() => window.__manualEditorHarness.getPickerState().colorRequests)).toBe(1);
  expect(await page.evaluate(() => window.__manualEditorHarness.commitCustomColor('#7c3aed'))).toBe(true);
  await expect(page.locator('[data-color-palette="true"]')).toHaveCount(0);

  await colorTrigger.click();
  await page.getByRole('button', { name: 'Color personalizado' }).click();
  const customInput = page.locator('[data-color-palette="true"] input[type="color"]');
  await customInput.evaluate((node) => { node.value = '#13579b'; });
  await page.evaluate(() => window.__manualEditorHarness.forceRender());
  await expect(customInput).toHaveValue('#13579b');
  await page.evaluate(() => window.__manualEditorHarness.cancelCustomColor());
  await expect(page.locator('[data-color-palette="true"]')).toBeVisible();
  await closePaletteByBackdrop(page);

  await page.evaluate(() => {
    window.__manualEditorHarness.resetPickerState();
    window.__manualEditorHarness.configureColorPicker('throw');
  });
  await colorTrigger.click();
  await page.getByRole('button', { name: 'Color personalizado' }).click();
  const fallbackState = await page.evaluate(() => window.__manualEditorHarness.getPickerState());
  expect(fallbackState.colorRequests).toBe(1);
  expect(fallbackState.colorFallbackClicks).toBe(1);
  await closePaletteByBackdrop(page);

  const imageControl = page.getByTestId('manual-card-editor-image-control');
  await imageControl.click();
  expect(await page.evaluate(() => window.__manualEditorHarness.getPickerState().imageRequests)).toBe(1);
  await page.evaluate(() => window.__manualEditorHarness.cancelImage());
  await expect(page.getByTestId('manual-card-editor-modal')).toBeVisible();
  await imageControl.click();
  expect(await page.evaluate(() => window.__manualEditorHarness.commitImage())).toBe(true);
  await expect(page.getByTestId('manual-card-editor-image-control').locator('img')).toBeVisible();

  await attachDiagnostics(page, testInfo, 'PW-CHAR-002');
});

test('PW-CHAR-003 / EDITOR-AS-001 — Escape cierra la superficie actual sin backend', async ({ page }, testInfo) => {
  await openHarness(page);
  await chooseAndOpen(page, 'distinct', 'question');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('manual-card-editor-modal')).toHaveCount(0);

  await page.evaluate(() => window.__manualEditorHarness.openSheet());
  await expect(page.getByRole('dialog', { name: 'Acciones de prueba' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Acciones de prueba' })).toHaveCount(0);
  await attachDiagnostics(page, testInfo, 'PW-CHAR-003');
});

test('fixtures de error, guardado, imagen y alineación por lado son montables', async ({ page }) => {
  await openHarness(page);
  await chooseAndOpen(page, 'error', 'question');
  await expect(page.getByRole('alert')).toContainText('Error de guardado simulado');
  await closeThroughHarness(page);

  await chooseAndOpen(page, 'saving', 'answer');
  await expect(page.getByTestId('manual-card-editor-done')).toBeDisabled();
  await closeThroughHarness(page);

  await chooseAndOpen(page, 'image', 'question');
  await expect(page.getByTestId('manual-card-editor-image-control').locator('img')).toBeVisible();
  await closeThroughHarness(page);

  await chooseAndOpen(page, 'styled', 'question');
  await expect(page.getByTestId('manual-card-editor-question')).toHaveCSS('text-align', 'left');
  await closeThroughHarness(page);
  await chooseAndOpen(page, 'styled', 'answer');
  await expect(page.getByTestId('manual-card-editor-answer')).toHaveCSS('text-align', 'right');
});

test('KEEP-009 — la ayuda táctil es una acción explícita; no se afirma apertura del OSK', async ({ page }) => {
  await openHarness(page, { touch: true });
  await chooseAndOpen(page, 'distinct', 'question');
  const resume = page.getByRole('button', { name: 'Toca para comenzar a escribir' });
  await expect(resume).toBeVisible({ timeout: 2_000 });
  await resume.click();
  await expect(page.getByTestId('manual-card-editor-question')).toBeFocused();
});

test.skip('PENDING — DEVICE REQUIRED EDITOR-COLOR-002 / DEV-IOS-002 / DEV-AND-001 — picker nativo, OSK y selección', async () => {
  // Un stub demuestra el contrato de llamada, pero no el retorno real desde el picker,
  // el OSK ni la selección en iOS/Android. Esa evidencia solo es válida en dispositivo.
});

test('FIXME EDITOR-COLOR-001 — Enter no activa actualmente el picker custom', async ({ page }, testInfo) => {
  await openHarness(page);
  await chooseAndOpen(page, 'distinct', 'question');
  await page.evaluate(() => {
    window.__manualEditorHarness.resetPickerState();
    window.__manualEditorHarness.configureColorPicker('success');
  });
  await page.getByTestId('manual-card-editor-color').click();
  const custom = page.getByRole('button', { name: 'Color personalizado' });
  await custom.focus();
  await custom.press('Enter');
  const requests = await page.evaluate(() => window.__manualEditorHarness.getPickerState().colorRequests);
  await attachDiagnostics(page, testInfo, 'EDITOR-COLOR-001');
  test.fixme(requests === 0, 'EDITOR-COLOR-001: el handler vive solo en pointerdown; Corte 1 debe añadir click semántico.');
  expect(requests).toBeGreaterThan(0);
});

test('FIXME EDITOR-VV-001 / EDITOR-KB-001 / EDITOR-SAFE-001 — rotación se clasifica como teclado', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHarness(page);
  await chooseAndOpen(page, 'distinct', 'question');
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByTestId('manual-card-editor-modal')).toHaveAttribute('data-keyboard-open', 'true');
  const inferredKeyboard = await page.getByTestId('manual-card-editor-modal').getAttribute('data-keyboard-open');
  await attachDiagnostics(page, testInfo, 'EDITOR-VV-001');
  test.fixme(inferredKeyboard === 'true', 'EDITOR-VV-001, EDITOR-KB-001 y EDITOR-SAFE-001: baseline portrait monotónico produce falso teclado en landscape.');
  expect(inferredKeyboard).not.toBe('true');
});

test('FIXME EDITOR-OVERLAY-002 / EDITOR-COLOR-005 — Escape salta la paleta sin foco', async ({ page }, testInfo) => {
  await openHarness(page);
  await chooseAndOpen(page, 'distinct', 'question');
  await page.getByTestId('manual-card-editor-question').focus();
  await page.getByTestId('manual-card-editor-color').click();
  await expect(page.locator('[data-color-palette="true"]')).toBeVisible();
  await page.keyboard.press('Escape');
  const modalClosed = await page.getByTestId('manual-card-editor-modal').count() === 0;
  await attachDiagnostics(page, testInfo, 'EDITOR-OVERLAY-002');
  test.fixme(modalClosed, 'EDITOR-OVERLAY-002 / EDITOR-COLOR-005: Escape lo recibe el listener global del modal y desmonta también la hija.');
  await expect(page.getByTestId('manual-card-editor-modal')).toBeVisible();
});

test('FIXME EDITOR-FOCUS-003 — Shift+Tab puede entrar al App simulado', async ({ page }, testInfo) => {
  await openHarness(page);
  await chooseAndOpen(page, 'distinct', 'question');
  await page.getByTestId('manual-card-editor-question').focus();
  await page.keyboard.press('Shift+Tab');
  const escapedToHarness = await page.evaluate(() => (
    document.activeElement?.closest?.('[data-testid="harness-toolbar"]') !== null
  ));
  await attachDiagnostics(page, testInfo, 'EDITOR-FOCUS-003');
  test.fixme(escapedToHarness, 'EDITOR-FOCUS-003: el modal actual no vuelve inert ni contiene el foco del App shell.');
  expect(escapedToHarness).toBe(false);
});
