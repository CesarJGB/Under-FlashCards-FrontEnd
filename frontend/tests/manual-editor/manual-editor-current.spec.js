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

async function setSyntheticGeometry(page, sample, eventCount = 1) {
  const applied = await page.evaluate(({ geometry, count }) => {
    const didApply = window.__manualEditorHarness.setGeometrySample(geometry);
    if (didApply) window.__manualEditorHarness.emitGeometryEvents(count);
    return didApply;
  }, { geometry: sample, count: eventCount });
  expect(applied).toBe(true);
}

async function expectStableGeometry(page, expected = {}) {
  await expect.poll(() => page.evaluate(() => (
    window.__manualEditorHarness.getGeometrySnapshot()
  ))).toMatchObject({ phase: 'stable', ...expected });
  return page.evaluate(() => window.__manualEditorHarness.getGeometrySnapshot());
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

async function activateLikeMobile(locator, testInfo) {
  if (testInfo.project.name === 'firefox') await locator.click();
  else await locator.tap();
}

async function readSelection(locator) {
  return locator.evaluate((node) => ({
    start: node.selectionStart,
    end: node.selectionEnd,
    direction: node.selectionDirection,
  }));
}

async function attachInteractionTrace(page, testInfo, label) {
  const trace = await page.evaluate(() => window.__manualEditorHarness.getInteractionTrace());
  await testInfo.attach(`${label}-interaction-events.json`, {
    body: JSON.stringify(trace, null, 2),
    contentType: 'application/json',
  });
  return trace;
}

test('PW-CHAR-001 / EDITOR-SCROLL-001 / EDITOR-STATE-001 — apertura, selección, scroll y 20 ciclos', async ({ page }, testInfo) => {
  await openHarness(page);
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

  // React instala listeners delegados la primera vez que encuentra un target
  // de portal. Comparamos ciclos posteriores contra esa línea base caliente.
  const baselineListeners = await page.evaluate(() => window.__manualEditorHarness.getListenerSnapshot());

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

test('PW-CHAR-002 / PW-MENU-001 / EDITOR-COLOR-004 — menús DOM, presets y stubs de color/imagen', async ({ page }, testInfo) => {
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
  });
  await colorTrigger.click();
  await page.getByLabel('Color personalizado').click();
  await expect.poll(() => page.evaluate(() => window.__manualEditorHarness.getPickerState()))
    .toMatchObject({ colorDirectClicks: 1, colorRequests: 0, colorFallbackClicks: 0 });
  expect(await page.evaluate(() => window.__manualEditorHarness.commitCustomColor('#7c3aed'))).toBe(true);
  await expect(page.locator('[data-color-palette="true"]')).toHaveCount(0);

  await colorTrigger.click();
  await page.getByLabel('Color personalizado').click();
  const customInput = page.locator('[data-color-palette="true"] input[type="color"]');
  await customInput.evaluate((node) => { node.value = '#13579b'; });
  await page.evaluate(() => window.__manualEditorHarness.forceRender());
  await expect(customInput).toHaveValue('#13579b');
  await page.evaluate(() => window.__manualEditorHarness.cancelCustomColor());
  await expect(page.locator('[data-color-palette="true"]')).toBeVisible();
  await closePaletteByBackdrop(page);

  const imageControl = page.getByTestId('manual-card-editor-image-control');
  await imageControl.click();
  expect(await page.evaluate(() => window.__manualEditorHarness.getPickerState().imageRequests)).toBe(1);
  expect(await page.evaluate(() => window.__manualEditorHarness.cancelImage())).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__manualEditorHarness.getPublicState().pickerStatus)).toBe('cancelled');
  await expect(page.getByTestId('manual-card-editor-modal')).toBeVisible();
  await imageControl.click();
  expect(await page.evaluate(() => window.__manualEditorHarness.commitImage())).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__manualEditorHarness.getPublicState().pickerStatus)).toBe('committed');
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

test('PW-ESC-001 — Escape closes exactly the top editor layer', async ({ page }) => {
  await openHarness(page);
  await chooseAndOpen(page, 'distinct', 'question');
  await page.getByTestId('manual-card-editor-color').click();
  await expect(page.locator('[data-color-palette="true"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__manualEditorHarness.getLayerSnapshot()))
    .toMatchObject({ topId: 'manual-editor-color', count: 1 });

  await page.keyboard.press('Escape');
  await expect(page.locator('[data-color-palette="true"]')).toHaveCount(0);
  await expect(page.getByTestId('manual-card-editor-modal')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__manualEditorHarness.getLayerSnapshot()))
    .toMatchObject({ topId: null, count: 0 });

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('manual-card-editor-modal')).toHaveCount(0);
});

test('PW-BACK-001 — Back closes a child, rearms once, then closes the root', async ({ page }) => {
  await openHarness(page);
  await chooseAndOpen(page, 'distinct', 'question');
  await page.getByTestId('manual-card-editor-align').click();
  await expect(page.locator('[data-editor-align-popover="true"]')).toBeVisible();

  await page.goBack();
  await expect(page.locator('[data-editor-align-popover="true"]')).toHaveCount(0);
  await expect(page.getByTestId('manual-card-editor-modal')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (
    window.__manualEditorHarness.getOwnershipSnapshot().layers.sentinels
  ))).toBe(1);

  await page.goBack();
  await expect(page.getByTestId('manual-card-editor-modal')).toHaveCount(0);
});

test('PW-SCROLL-001 — app scroll is leased while editor and internal scroll remain usable', async ({ page }) => {
  await openHarness(page);
  const appScrollRoot = page.getByTestId('harness-app-scroll-root');
  await appScrollRoot.evaluate((node) => { node.scrollTop = 240; });
  const before = await appScrollRoot.evaluate((node) => node.scrollTop);
  await chooseAndOpen(page, 'long', 'question');

  await expect.poll(() => page.evaluate(() => window.__manualEditorHarness.getModalRuntimeSnapshot().inert))
    .toBe(true);
  await expect(appScrollRoot).toHaveCSS('overflow-y', 'hidden');
  const textarea = page.getByTestId('manual-card-editor-question');
  const internal = await textarea.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
    return { top: node.scrollTop, scrollable: node.scrollHeight > node.clientHeight };
  });
  expect(internal.scrollable).toBe(true);
  expect(internal.top).toBeGreaterThan(0);

  await closeThroughHarness(page);
  await expect.poll(() => appScrollRoot.evaluate((node) => node.scrollTop)).toBe(before);
  expect(await page.evaluate(() => window.__manualEditorHarness.getModalRuntimeSnapshot().inert)).toBe(false);
});

test('PW-A11Y-001 — scoped portal, inert shell and focus containment are observable', async ({ page }) => {
  await openHarness(page);
  await chooseAndOpen(page, 'distinct', 'question');
  await page.getByTestId('manual-card-editor-color').focus();
  await page.getByTestId('manual-card-editor-color').press('Enter');
  const palette = page.locator('[data-color-palette="true"]');
  await expect(palette).toBeVisible();
  await expect(palette).not.toHaveAttribute('aria-modal', 'true');
  await expect(page.getByTestId('manual-editor-color-backdrop')).not.toHaveAttribute('tabindex', /.+/);
  expect(await page.evaluate(() => window.__manualEditorHarness.getModalRuntimeSnapshot().portalTarget)).toBe(true);

  for (let index = 0; index < 8; index += 1) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.closest('[data-testid="harness-toolbar"]') !== null)).toBe(false);
  await page.keyboard.press('Escape');
  await expect(palette).toHaveCount(0);
});

test('PW-LIFE-001 — 20 cycles and open-layer unmount leave zero runtime resources', async ({ page }) => {
  await openHarness(page);
  for (let cycle = 0; cycle < 20; cycle += 1) {
    await page.evaluate(() => window.__manualEditorHarness.open('question'));
    await expect(page.getByTestId('manual-card-editor-modal')).toBeVisible();
    await page.evaluate(() => window.__manualEditorHarness.close());
    await expect(page.getByTestId('manual-card-editor-modal')).toHaveCount(0);
  }
  await page.evaluate(() => window.__manualEditorHarness.open('question'));
  await page.getByTestId('manual-card-editor-color').click();
  await page.evaluate(() => window.__manualEditorHarness.close());
  await expect(page.getByTestId('manual-card-editor-modal')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__manualEditorHarness.getOwnershipSnapshot()))
    .toEqual({
      layers: { instances: 0, listeners: 0, registrySize: 0, sentinels: 0, owners: [] },
      sharedOverlays: {
        coordinator: { hosts: 0, listeners: 0 },
        registry: {
          layers: 0,
          topId: null,
          registrySize: 0,
          subscribers: 0,
          armed: false,
        },
      },
      scroll: { scrollRoots: 0, inertRoots: 0, ownerCount: 0, owners: [] },
    });
  expect(await page.locator('[data-editor-overlay-root="true"]').count()).toBe(0);
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

test('PW-AS-001 — opciones simples conservan foco, backdrop no tabbable y cierre único', async ({ page }) => {
  await openHarness(page);
  await page.evaluate(() => window.__manualEditorHarness.openActionSheetCase('simple'));
  const sheet = page.getByRole('dialog', { name: 'Acciones de prueba' });
  await expect(sheet).toBeVisible();
  await expect(page.getByRole('button', { name: 'Acción sintética' })).toBeFocused();
  const backdrop = page.locator('[data-action-sheet-backdrop="true"]');
  await expect(backdrop).toHaveCount(1);
  expect(await backdrop.evaluate((node) => ({
    tag: node.tagName,
    tabIndex: node.getAttribute('tabindex'),
  }))).toEqual({ tag: 'DIV', tabIndex: null });
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
});

test('PW-AS-002 — contenido custom/footer porta ColorPalette dentro del scope del sheet', async ({ page }) => {
  await openHarness(page);
  await page.evaluate(() => window.__manualEditorHarness.openActionSheetCase('style'));
  const sheet = page.getByRole('dialog', { name: 'Estilo sintético' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Color de estilo de la pregunta' }).click();
  const palette = page.locator('[data-color-palette="true"]');
  await expect(palette).toBeVisible();
  expect(await palette.evaluate((node) => (
    node.parentElement?.matches('[data-action-sheet-overlay-root="true"]')
  ))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(palette).toHaveCount(0);
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Listo' })).toBeVisible();
});

test('PW-AS-003 — dos sheets consecutivos mantienen inferior inert y cierran uno por Escape', async ({ page }) => {
  await openHarness(page);
  await page.evaluate(() => window.__manualEditorHarness.openActionSheetCase('consecutive'));
  const lower = page.getByRole('dialog', { name: 'Hoja inferior sintética', includeHidden: true });
  const upper = page.getByRole('dialog', { name: 'Hoja superior sintética' });
  await expect(upper).toBeVisible();
  await expect(lower).toHaveAttribute('inert', '');
  await expect(lower).toHaveAttribute('aria-hidden', 'true');
  await page.keyboard.press('Escape');
  await expect(upper).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Hoja inferior sintética' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Hoja inferior sintética' })).toHaveCount(0);
});

test('PW-AS-004 — contenido largo en landscape llega a la última acción por scroll interno', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await openHarness(page);
  await page.evaluate(() => window.__manualEditorHarness.openActionSheetCase('long'));
  const sheet = page.getByRole('dialog', { name: 'Contenido largo sintético' });
  await expect(sheet).toBeVisible();
  const scroll = sheet.locator('[data-action-sheet-scroll="true"]');
  const result = await scroll.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
    return {
      scrollable: node.scrollHeight > node.clientHeight,
      atEnd: node.scrollTop + node.clientHeight >= node.scrollHeight - 1,
    };
  });
  expect(result).toEqual({ scrollable: true, atEnd: true });
  await expect(sheet.getByRole('button', { name: 'Acción sintética 18' })).toBeVisible();
});

test('PW-OPEN-001 / KEEP-009 — la ayuda baja el área editable y permite reanudar', async ({ page }) => {
  await openHarness(page);
  await chooseAndOpen(page, 'distinct', 'question');
  const textarea = page.getByTestId('manual-card-editor-question');
  await page.getByTestId('manual-card-editor-done').focus();
  const resume = page.getByTestId('manual-card-editor-resume');
  await expect(resume).toBeVisible();
  const [textareaBox, resumeBox] = await Promise.all([
    textarea.boundingBox(),
    resume.boundingBox(),
  ]);
  expect(textareaBox).not.toBeNull();
  expect(resumeBox).not.toBeNull();
  expect(Math.abs(resumeBox.x - textareaBox.x)).toBeLessThanOrEqual(4);
  expect(Math.abs(resumeBox.y - textareaBox.y)).toBeLessThanOrEqual(4);
  expect(Math.abs(resumeBox.width - textareaBox.width)).toBeLessThanOrEqual(4);
  expect(Math.abs(resumeBox.height - textareaBox.height)).toBeLessThanOrEqual(4);
  await resume.click();
  await expect(textarea).toBeFocused();
  await textarea.fill('El helper no bloqueó la edición física.');
  await expect(resume).toHaveCount(0);
  await page.getByTestId('manual-card-editor-done').focus();
  await expect(resume).toBeVisible();
  await resume.click();
  await expect(textarea).toBeFocused();
});

test.skip('PENDING — DEVICE REQUIRED EDITOR-COLOR-002 / DEV-IOS-002 / DEV-AND-001 — picker nativo, OSK y selección', async () => {
  // Un stub demuestra el contrato de llamada, pero no el retorno real desde el picker,
  // el OSK ni la selección en iOS/Android. Esa evidencia solo es válida en dispositivo.
});

test('PW-PICK-001 / EDITOR-COLOR-001 — pointer, Enter y Space ejecutan un toggle cada uno', async ({ page }, testInfo) => {
  await openHarness(page);
  await chooseAndOpen(page, 'distinct', 'question');
  const color = page.getByTestId('manual-card-editor-color');
  const palette = page.locator('[data-color-palette="true"]');

  await color.click();
  await expect(palette).toHaveCount(1);
  await color.click();
  await expect(palette).toHaveCount(0);

  await color.focus();
  await color.press('Enter');
  await expect(palette).toHaveCount(1);
  await color.press('Space');
  await expect(palette).toHaveCount(0);

  const switchSide = page.getByTestId('manual-card-editor-switch-side');
  await switchSide.focus();
  await switchSide.press('Enter');
  await expect(page.getByTestId('manual-card-editor-answer')).toBeVisible();
  await switchSide.press('Space');
  await expect(page.getByTestId('manual-card-editor-question')).toBeVisible();
  await attachDiagnostics(page, testInfo, 'EDITOR-COLOR-001');
});

test('PW-TOUCH-001 — 20 cambios rápidos conservan foco DOM y selecciones por lado', async ({ page }, testInfo) => {
  await openHarness(page, { touch: true });
  await chooseAndOpen(page, 'distinct', 'question');
  let textarea = page.getByTestId('manual-card-editor-question');
  await textarea.fill('Pregunta con selección independiente para veinte cambios rápidos.');
  await page.evaluate(() => window.__manualEditorHarness.setSelection(3, 18, 'forward'));
  const questionSelection = await readSelection(textarea);

  const switchSide = page.getByTestId('manual-card-editor-switch-side');
  await activateLikeMobile(switchSide, testInfo);
  textarea = page.getByTestId('manual-card-editor-answer');
  await textarea.fill('Respuesta con otra selección independiente.');
  await page.evaluate(() => window.__manualEditorHarness.setSelection(5, 22, 'backward'));
  const answerSelection = await readSelection(textarea);
  await page.evaluate(() => window.__manualEditorHarness.resetInteractionTrace());

  for (let cycle = 0; cycle < 20; cycle += 1) {
    await activateLikeMobile(switchSide, testInfo);
    const expectedSide = cycle % 2 === 0 ? 'question' : 'answer';
    textarea = page.getByTestId(`manual-card-editor-${expectedSide}`);
    await expect(textarea).toBeFocused();
    await expect.poll(() => readSelection(textarea)).toEqual(
      expectedSide === 'question' ? questionSelection : answerSelection,
    );
  }

  const trace = await attachInteractionTrace(page, testInfo, 'PW-TOUCH-001');
  expect(trace.some((event) => (
    event.type === 'focus'
    && event.target.testId === 'manual-card-editor-switch-side'
  ))).toBe(false);
  expect(trace.some((event) => (
    event.type === 'blur'
    && event.target.tag === 'textarea'
  ))).toBe(false);
});

test('PW-TOUCH-002 — color y alineación hacen un toggle por gesto sin enfocar el trigger', async ({ page }, testInfo) => {
  await openHarness(page, { touch: true });
  await chooseAndOpen(page, 'distinct', 'question');
  const textarea = page.getByTestId('manual-card-editor-question');
  await textarea.fill('Texto enfocado durante toggles repetidos.');

  const cases = [
    {
      trigger: page.getByTestId('manual-card-editor-color'),
      layer: page.locator('[data-color-palette="true"]'),
      testId: 'manual-card-editor-color',
    },
    {
      trigger: page.getByTestId('manual-card-editor-align'),
      layer: page.locator('[data-editor-align-popover="true"]'),
      testId: 'manual-card-editor-align',
    },
  ];

  for (const current of cases) {
    await textarea.focus();
    await page.evaluate(() => window.__manualEditorHarness.resetInteractionTrace());
    for (let cycle = 0; cycle < 20; cycle += 1) {
      await activateLikeMobile(current.trigger, testInfo);
      if (cycle === 0) {
        await attachInteractionTrace(page, testInfo, `PW-TOUCH-002-${current.testId}-first-gesture`);
      }
      await expect(current.layer).toHaveCount(cycle % 2 === 0 ? 1 : 0);
      await expect(textarea).toBeFocused();
    }
    const trace = await page.evaluate(() => window.__manualEditorHarness.getInteractionTrace());
    expect(trace.filter((event) => (
      event.phase === 'capture'
      && event.type === 'focus'
      && event.target.testId === current.testId
    ))).toHaveLength(0);
    if (testInfo.project.name !== 'firefox') {
      expect(trace.some((event) => (
        event.phase === 'bubble'
        && event.type === 'touchstart'
        && event.defaultPrevented
      ))).toBe(true);
    }
  }

  await activateLikeMobile(cases[0].trigger, testInfo);
  await expect(cases[0].layer).toHaveCount(1);
  await activateLikeMobile(cases[1].trigger, testInfo);
  await expect(cases[0].layer).toHaveCount(0);
  await expect(cases[1].layer).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => window.__manualEditorHarness.getLayerSnapshot()))
    .toMatchObject({ topId: 'manual-editor-align', count: 1 });
  await expect(textarea).toBeFocused();
  await activateLikeMobile(cases[1].trigger, testInfo);
  await expect.poll(() => page.evaluate(() => window.__manualEditorHarness.getLayerSnapshot()))
    .toMatchObject({ topId: null, count: 0 });
  await expect(page.locator('[data-color-palette="true"], [data-editor-align-popover="true"]'))
    .toHaveCount(0);
  await expect(page.locator('[data-testid$="-backdrop"]')).toHaveCount(0);
  await attachInteractionTrace(page, testInfo, 'PW-TOUCH-002');
});

test('PW-TOUCH-003 — un click compatible detail=0 no repite el pointerdown', async ({ page }, testInfo) => {
  await openHarness(page, { touch: true });
  await chooseAndOpen(page, 'distinct', 'question');
  const textarea = page.getByTestId('manual-card-editor-question');
  await textarea.focus();
  const color = page.getByTestId('manual-card-editor-color');
  await page.evaluate(() => window.__manualEditorHarness.resetInteractionTrace());
  await color.dispatchEvent('pointerdown', {
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
  });
  await color.dispatchEvent('pointerup', {
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
  });
  await color.dispatchEvent('click', { detail: 0 });
  await attachInteractionTrace(page, testInfo, 'PW-TOUCH-003-before-assertion');
  await expect(page.locator('[data-color-palette="true"]')).toHaveCount(1);
  await expect(textarea).toBeFocused();
  await attachInteractionTrace(page, testInfo, 'PW-TOUCH-003');
});

test('PW-PICK-003 — color personalizado recibe el gesto nativo directo y resuelve una transacción', async ({ page }, testInfo) => {
  await openHarness(page, { touch: true });
  await chooseAndOpen(page, 'distinct', 'question');
  const textarea = page.getByTestId('manual-card-editor-question');
  const colorTrigger = page.getByTestId('manual-card-editor-color');
  await textarea.focus();
  await activateLikeMobile(colorTrigger, testInfo);
  await expect(page.locator('[data-color-palette="true"]')).toBeVisible();
  const nativeInput = page.locator('[data-color-palette="true"] input[type="color"]');
  await expect(nativeInput).toHaveCount(1);
  await page.evaluate(() => {
    window.__manualEditorHarness.resetPickerState();
    window.__manualEditorHarness.resetStyleUpdateCounts();
    window.__manualEditorHarness.resetInteractionTrace();
  });

  const directHit = await nativeInput.evaluate((input) => {
    const rect = input.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {
      inputIsHit: hit === input,
      hitTag: hit?.tagName || '',
      hitTestId: hit?.dataset?.testid || '',
      height: rect.height,
      width: rect.width,
    };
  });
  expect(directHit).toMatchObject({ inputIsHit: true, hitTag: 'INPUT' });
  expect(directHit.width).toBeGreaterThanOrEqual(30);
  expect(directHit.height).toBeGreaterThanOrEqual(30);
  await activateLikeMobile(nativeInput, testInfo);
  await expect.poll(() => page.evaluate(() => window.__manualEditorHarness.getPickerState()))
    .toMatchObject({
      colorDirectClicks: 1,
      colorTrustedDirectClicks: 1,
      colorRequests: 0,
      colorFallbackClicks: 0,
    });

  expect(await page.evaluate(() => window.__manualEditorHarness.inputCustomColor('#13579b'))).toBe(true);
  expect(await page.evaluate(() => window.__manualEditorHarness.commitCustomColor('#13579b'))).toBe(true);
  await expect(page.locator('[data-color-palette="true"]')).toHaveCount(0);
  await expect(textarea).toHaveCSS('color', 'rgb(19, 87, 155)');
  expect(await page.evaluate(() => window.__manualEditorHarness.getStyleUpdateCounts().qColor)).toBe(1);

  await activateLikeMobile(colorTrigger, testInfo);
  const colorBeforeCancel = await textarea.evaluate((node) => getComputedStyle(node).color);
  await activateLikeMobile(page.locator('[data-color-palette="true"] input[type="color"]'), testInfo);
  await page.evaluate(() => {
    window.__manualEditorHarness.resetStyleUpdateCounts();
    window.__manualEditorHarness.cancelCustomColor();
  });
  await expect(page.locator('[data-color-palette="true"]')).toHaveCount(1);
  await expect(textarea).toHaveCSS('color', colorBeforeCancel);
  expect(await page.evaluate(() => window.__manualEditorHarness.getStyleUpdateCounts().qColor || 0)).toBe(0);

  expect(await page.evaluate(() => window.__manualEditorHarness.commitCustomColor('#abcdef'))).toBe(true);
  await expect(textarea).toHaveCSS('color', colorBeforeCancel);
  expect(await page.evaluate(() => window.__manualEditorHarness.getStyleUpdateCounts().qColor || 0)).toBe(0);
  await attachInteractionTrace(page, testInfo, 'PW-PICK-003');
});

test('PW-SIDE-001 — tres alternancias restauran rangos independientes', async ({ page }) => {
  await openHarness(page);
  await chooseAndOpen(page, 'distinct', 'question');
  const question = page.getByTestId('manual-card-editor-question');
  await page.evaluate(() => window.__manualEditorHarness.setSelection(2, 11, 'forward'));
  await page.getByTestId('manual-card-editor-switch-side').click();
  const answer = page.getByTestId('manual-card-editor-answer');
  await page.evaluate(() => window.__manualEditorHarness.setSelection(5, 17, 'backward'));
  await page.getByTestId('manual-card-editor-switch-side').click();
  await expect.poll(() => question.evaluate((node) => ({
    start: node.selectionStart,
    end: node.selectionEnd,
    direction: node.selectionDirection,
  }))).toEqual({ start: 2, end: 11, direction: 'forward' });
  await page.getByTestId('manual-card-editor-switch-side').click();
  await expect.poll(() => answer.evaluate((node) => ({
    start: node.selectionStart,
    end: node.selectionEnd,
    direction: node.selectionDirection,
  }))).toEqual({ start: 5, end: 17, direction: 'backward' });
});

test('PW-PICK-002 — imagen distingue cancel, returned-unknown y commit', async ({ page }) => {
  await openHarness(page);
  await chooseAndOpen(page, 'distinct', 'answer');
  const imageControl = page.getByTestId('manual-card-editor-image-control');

  await imageControl.click();
  expect(await page.evaluate(() => window.__manualEditorHarness.cancelImage())).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__manualEditorHarness.getPublicState().pickerStatus)).toBe('cancelled');

  await imageControl.click();
  await page.evaluate(() => window.__manualEditorHarness.returnImageUnknown());
  await expect.poll(() => page.evaluate(() => window.__manualEditorHarness.getPublicState().pickerStatus)).toBe('returned-unknown');
  await expect(page.getByTestId('manual-card-editor-modal')).toBeVisible();

  await imageControl.click();
  expect(await page.evaluate(() => window.__manualEditorHarness.commitImage())).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__manualEditorHarness.getPublicState().pickerStatus)).toBe('committed');
  await expect(page.getByTestId('manual-card-editor-image-control').locator('img')).toBeVisible();
});

test('PW-GEO-001 — snapshot compartido rota epochs, coalesce eventos y reancla la paleta', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHarness(page);
  await setSyntheticGeometry(page, {
    layout: { width: 390, height: 844 },
    visual: { left: 10, top: 20, width: 370, height: 760, scale: 1 },
  });
  await chooseAndOpen(page, 'distinct', 'question');
  const portrait = await expectStableGeometry(page, {
    source: 'visual-viewport',
    orientation: 'portrait',
    visual: { left: 10, top: 20, width: 370, height: 760, scale: 1 },
    occlusion: { top: 20, right: 10, bottom: 64, left: 10 },
  });
  const surface = page.getByTestId('manual-card-editor-surface');
  await expect(surface).toHaveCSS('left', '10px');
  await expect(surface).toHaveCSS('top', '20px');
  await expect(surface).toHaveCSS('width', '370px');
  await expect(surface).toHaveCSS('height', '760px');

  const rendersBefore = await page.evaluate(() => window.__manualEditorHarness.getRenderCount());
  await page.evaluate(() => window.__manualEditorHarness.emitGeometryEvents(100));
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(await page.evaluate(() => window.__manualEditorHarness.getRenderCount())).toBe(rendersBefore);

  await page.getByTestId('manual-card-editor-color').click();
  await expect(page.locator('[data-color-palette="true"]')).toBeVisible();
  await page.setViewportSize({ width: 844, height: 390 });
  await setSyntheticGeometry(page, {
    layout: { width: 844, height: 390 },
    visual: { left: 12, top: 8, width: 820, height: 360, scale: 1 },
  });
  const landscape = await expectStableGeometry(page, {
    source: 'visual-viewport',
    orientation: 'landscape',
  });
  expect(landscape.epoch).toBe(portrait.epoch + 1);
  await expect.poll(() => page.evaluate(() => window.__manualEditorHarness.getPaletteMetrics()))
    .toMatchObject({ geometry: 'shared', epoch: landscape.epoch });
  const palette = await page.evaluate(() => window.__manualEditorHarness.getPaletteMetrics());
  expect(palette.width).toBeGreaterThan(0);
  expect(palette.left).toBeGreaterThanOrEqual(12);
  expect(palette.left + palette.width).toBeLessThanOrEqual(832);

  await page.setViewportSize({ width: 390, height: 844 });
  await setSyntheticGeometry(page, {
    layout: { width: 390, height: 844 },
    visual: { left: 0, top: 0, width: 390, height: 844, scale: 1 },
  });
  const portraitAgain = await expectStableGeometry(page, { orientation: 'portrait' });
  expect(portraitAgain.epoch).toBe(landscape.epoch + 1);
  const overflow = await page.evaluate(() => window.__manualEditorHarness.getOverflowSnapshot());
  expect(overflow.surface.horizontal).toBe(false);
  expect(overflow.editor.horizontal).toBe(false);
  expect(overflow.footer.horizontal).toBe(false);
  await attachDiagnostics(page, testInfo, 'PW-GEO-001');
});

test('PW-GEO-002 — fallback y 320×568/568×320 conservan layout recuperable sin overflow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openHarness(page);
  await setSyntheticGeometry(page, {
    source: 'layout-fallback',
    layout: { width: 320, height: 568 },
  });
  await chooseAndOpen(page, 'long', 'question');
  const portrait = await expectStableGeometry(page, {
    source: 'layout-fallback',
    orientation: 'portrait',
    layout: { left: 0, top: 0, width: 320, height: 568 },
    visual: { left: 0, top: 0, width: 320, height: 568, scale: 1 },
  });
  await expect(page.getByTestId('manual-card-editor-modal'))
    .toHaveAttribute('data-geometry-safe-bottom', 'conservative');
  let overflow = await page.evaluate(() => window.__manualEditorHarness.getOverflowSnapshot());
  expect(Object.values(overflow).every((entry) => !entry.horizontal)).toBe(true);

  await page.setViewportSize({ width: 568, height: 320 });
  await setSyntheticGeometry(page, {
    source: 'layout-fallback',
    layout: { width: 568, height: 320 },
  });
  const landscape = await expectStableGeometry(page, {
    source: 'layout-fallback',
    orientation: 'landscape',
  });
  expect(landscape.epoch).toBe(portrait.epoch + 1);
  overflow = await page.evaluate(() => window.__manualEditorHarness.getOverflowSnapshot());
  expect(Object.values(overflow).every((entry) => !entry.horizontal)).toBe(true);

  await setSyntheticGeometry(page, {
    layout: { width: 568, height: 320 },
    visual: { left: 18, top: 14, width: 520, height: 280, scale: 1.5 },
  });
  await expectStableGeometry(page, {
    source: 'visual-viewport',
    visual: { left: 18, top: 14, width: 520, height: 280, scale: 1.5 },
  });
  await expect(page.getByTestId('manual-card-editor-modal'))
    .toHaveAttribute('data-geometry-safe-bottom', 'conservative');
  await attachDiagnostics(page, testInfo, 'PW-GEO-002');
});

test('PW-VIS-001 — visual-edge solo aparece con geometría estable, escala 1 y textarea activo', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHarness(page);
  await setSyntheticGeometry(page, {
    layout: { width: 390, height: 844 },
    visual: { left: 0, top: 0, width: 390, height: 620, scale: 2 },
  });
  await chooseAndOpen(page, 'distinct', 'question');
  await expectStableGeometry(page, { source: 'visual-viewport' });
  await page.getByTestId('manual-card-editor-question').click();
  await expect(page.getByTestId('manual-card-editor-modal'))
    .toHaveAttribute('data-geometry-safe-bottom', 'conservative');

  await setSyntheticGeometry(page, {
    layout: { width: 390, height: 844 },
    visual: { left: 0, top: 0, width: 390, height: 620, scale: 1 },
  });
  await expectStableGeometry(page, { source: 'visual-viewport', phase: 'stable' });
  await expect(page.getByTestId('manual-card-editor-modal'))
    .toHaveAttribute('data-geometry-safe-bottom', 'visual-edge');

  await setSyntheticGeometry(page, {
    source: 'layout-fallback',
    layout: { width: 390, height: 844 },
  });
  await expectStableGeometry(page, { source: 'layout-fallback' });
  await expect(page.getByTestId('manual-card-editor-modal'))
    .toHaveAttribute('data-geometry-safe-bottom', 'conservative');
  await attachDiagnostics(page, testInfo, 'PW-VIS-001');
});

test('PW-ESC-001 regression — Escape without palette focus still closes only the palette', async ({ page }, testInfo) => {
  await openHarness(page);
  await chooseAndOpen(page, 'distinct', 'question');
  await page.getByTestId('manual-card-editor-question').focus();
  await page.getByTestId('manual-card-editor-color').click();
  await expect(page.locator('[data-color-palette="true"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await attachDiagnostics(page, testInfo, 'EDITOR-OVERLAY-002');
  await expect(page.locator('[data-color-palette="true"]')).toHaveCount(0);
  await expect(page.getByTestId('manual-card-editor-modal')).toBeVisible();
});

test('PW-A11Y-001 regression — Shift+Tab cannot enter the simulated App shell', async ({ page }, testInfo) => {
  await openHarness(page);
  await chooseAndOpen(page, 'distinct', 'question');
  await page.getByTestId('manual-card-editor-question').focus();
  await page.keyboard.press('Shift+Tab');
  const escapedToHarness = await page.evaluate(() => (
    document.activeElement?.closest?.('[data-testid="harness-toolbar"]') !== null
  ));
  await attachDiagnostics(page, testInfo, 'EDITOR-FOCUS-003');
  expect(escapedToHarness).toBe(false);
});
