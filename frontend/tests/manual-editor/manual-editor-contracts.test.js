import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  manualEditorDiagnosticsBuildEnabled,
  sanitizeManualEditorDiagnostic,
} from '../../src/components/creator/manual-editor/manualEditorDiagnostics.js';

const readFrontendFile = (relativePath) => readFile(
  new URL(`../../${relativePath}`, import.meta.url),
  'utf8',
);

test('diagnostics discard content and preserve only the approved evidence fields', () => {
  const secretMarker = 'DO_NOT_RECORD_THIS_CONTENT';
  const event = sanitizeManualEditorDiagnostic({
    timestamp: 12.5,
    type: 'snapshot',
    question: secretMarker,
    answer: secretMarker,
    value: secretMarker,
    deckName: secretMarker,
    fileName: secretMarker,
    image: secretMarker,
    token: secretMarker,
    credentials: secretMarker,
    target: { tag: 'textarea', testId: 'manual-card-editor-question', value: secretMarker },
    activeElement: { tag: 'textarea', testId: 'manual-card-editor-question' },
    rects: { textarea: { left: 1, top: 2, width: 3, height: 4, value: secretMarker } },
    visualViewport: { width: 390, height: 500, offsetLeft: 0, offsetTop: 10, scale: 1 },
    orientation: 'portrait',
    geometry: {
      revision: 2,
      epoch: 1,
      phase: 'stable',
      source: 'visual-viewport',
      orientation: 'portrait',
      layout: { left: 0, top: 0, width: 390, height: 844 },
      visual: { left: 0, top: 10, width: 390, height: 500, scale: 1 },
      occlusion: { top: 10, right: 0, bottom: 334, left: 0 },
    },
    overflow: {
      surface: { horizontal: false, scrollWidth: 390, clientWidth: 390 },
    },
    renderCount: 4,
    listenerCount: { total: 3, byType: { resize: 2, scroll: 1 } },
    scrollOffsets: { editor: { x: 0, y: 20, value: secretMarker } },
    layerIds: ['manual-editor', 'color-palette'],
    owners: ['body-scroll-lock'],
    state: { modal: 'open', invalid: secretMarker },
    error: { name: 'Error', code: 'save-simulated', message: secretMarker, stack: secretMarker },
  });

  assert.ok(event);
  assert.equal(JSON.stringify(event).includes(secretMarker), false);
  assert.deepEqual(Object.keys(event).sort(), [
    'activeElement',
    'error',
    'geometry',
    'layerIds',
    'listenerCount',
    'orientation',
    'overflow',
    'owners',
    'rects',
    'renderCount',
    'scrollOffsets',
    'state',
    'target',
    'timestamp',
    'type',
    'visualViewport',
  ]);
  assert.deepEqual(event.error, { name: 'Error', code: 'save-simulated' });
});

test('diagnostics are inert outside a Vite development build', () => {
  assert.equal(manualEditorDiagnosticsBuildEnabled, false);
});

test('evidence schema is closed and cannot represent content fields', async () => {
  const schema = JSON.parse(await readFrontendFile('tests/manual-editor/evidence-schema.json'));
  const propertyNames = new Set();
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.properties && typeof node.properties === 'object') {
      Object.keys(node.properties).forEach((name) => propertyNames.add(name));
    }
    Object.values(node).forEach(visit);
  };
  visit(schema);
  assert.equal(schema.additionalProperties, false);
  for (const forbidden of ['question', 'answer', 'deckName', 'fileName', 'image', 'token', 'credentials', 'message', 'stack']) {
    assert.equal(propertyNames.has(forbidden), false);
  }
});

test('harness imports the real modal and provides every required synthetic fixture', async () => {
  const harness = await readFrontendFile('tests/manual-editor/harness.jsx');
  assert.match(harness, /import ManualCardEditorModal from '..\/..\/src\/components\/creator\/ManualCardEditorModal'/);
  for (const fixture of ['empty', 'distinct', 'long', 'styled', 'image', 'error', 'saving']) {
    assert.match(harness, new RegExp(`\\n  ${fixture}: \\{`));
  }
  assert.match(harness, /length: 36/);
  assert.match(harness, /data-app-scroll-root/);
  assert.doesNotMatch(harness, /VITE_BACKEND_URL|fetch\s*\(|authToken|localStorage|sessionStorage/);
});

test('KEEP-001, KEEP-005, KEEP-006, KEEP-007 and KEEP-009 remain observable', async () => {
  const [modal, stylePanel, actionSheet, sessionHook, geometryHook] = await Promise.all([
    readFrontendFile('src/components/creator/ManualCardEditorModal.jsx'),
    readFrontendFile('src/components/creator/StylePanel.jsx'),
    readFrontendFile('src/components/common/ActionSheet.jsx'),
    readFrontendFile('src/components/creator/manual-editor/useManualEditorSession.js'),
    readFrontendFile('src/components/creator/manual-editor/useEditorGeometry.js'),
  ]);

  assert.match(modal, /<textarea/);
  assert.match(sessionHook, /selectionStart/);
  assert.match(sessionHook, /selectionEnd/);
  assert.match(sessionHook, /selectionDirection/);
  assert.match(sessionHook, /setSelectionRange/);
  assert.match(geometryHook, /visualViewport\?\.addEventListener\?\.\('resize'/);
  assert.match(geometryHook, /visualViewport\?\.addEventListener\?\.\('scroll'/);
  assert.match(geometryHook, /visualViewport\?\.removeEventListener\?\.\('resize'/);
  assert.match(modal, /<footer[\s\S]*?className="[^"]*shrink-0/);
  assert.match(modal, /overflow-y-auto overscroll-contain/);
  assert.match(stylePanel, /overflow-x-auto overscroll-contain/);
  assert.match(actionSheet, /overflow-y-auto overscroll-contain/);
  assert.match(modal, /Continuar escribiendo/);
});

test('KEEP-002 and KEEP-003 retain picker detection, fallback and an uncontrolled color input', async () => {
  const [stylePanel, session] = await Promise.all([
    readFrontendFile('src/components/creator/StylePanel.jsx'),
    readFrontendFile('src/components/creator/manual-editor/manualEditorSession.js'),
  ]);
  assert.match(session, /typeof input\.showPicker === 'function'/);
  assert.match(session, /input\.showPicker\(\)/);
  assert.match(session, /catch\s*\{/);
  assert.match(session, /input\.click\(\)/);
  assert.match(stylePanel, /type="color"[\s\S]*?defaultValue=\{initialColorInputValue\.current\}/);
  assert.doesNotMatch(stylePanel, /type="color"[\s\S]{0,240}?value=\{/);
});

test('Corte 1 protects semantic pickers, per-side selection and non-blocking resume UI', async () => {
  const [modal, stylePanel, session, hook] = await Promise.all([
    readFrontendFile('src/components/creator/ManualCardEditorModal.jsx'),
    readFrontendFile('src/components/creator/StylePanel.jsx'),
    readFrontendFile('src/components/creator/manual-editor/manualEditorSession.js'),
    readFrontendFile('src/components/creator/manual-editor/useManualEditorSession.js'),
  ]);

  const customButtonStart = stylePanel.indexOf('title="Color personalizado"');
  const customButtonEnd = stylePanel.indexOf('</button>', customButtonStart);
  const customButton = stylePanel.slice(customButtonStart, customButtonEnd);
  assert.ok(customButtonStart >= 0 && customButtonEnd > customButtonStart);
  assert.match(customButton, /onClick=/);
  assert.doesNotMatch(customButton, /onPointerDown=/);
  assert.match(customButton, /requestColorPickerFromClick\(input\)/);

  assert.match(session, /question:\s*createSideSelection/);
  assert.match(session, /answer:\s*createSideSelection/);
  assert.match(session, /selectionDirection/);
  assert.match(session, /returned-unknown/);
  assert.match(session, /event\.transactionId === state\.picker\.transactionId/);

  assert.doesNotMatch(`${modal}\n${hook}`, /selectionRef|activePickerTransactionRef|guardKeyboardResumeAfterMenu|menuKeyboardGuardTimerRef|pickerReturnTimerRef/);
  assert.doesNotMatch(stylePanel, /customColorChangedRef|customColorCloseTimerRef|committedTransactionRef/);
  assert.doesNotMatch(`${modal}\n${stylePanel}`, /setTimeout\([^)]*(?:80|250)|(?:80|250)\s*\)/);
  assert.doesNotMatch(`${modal}\n${hook}`, /autoFocus/);
  assert.doesNotMatch(hook, /requestAnimationFrame/);
  assert.doesNotMatch(modal, /requestAnimationFrame[\s\S]{0,240}focus\s*\(/);
  assert.doesNotMatch(`${modal}\n${hook}\n${session}`, /useKeyboardHeight/);

  const resumeIndex = modal.indexOf('data-testid="manual-card-editor-resume"');
  const textareaIndex = modal.indexOf('data-testid={`manual-card-editor-${activeSide}`}');
  assert.ok(textareaIndex >= 0 && resumeIndex > textareaIndex);
  assert.doesNotMatch(modal.slice(resumeIndex - 500, resumeIndex + 500), /absolute\s+inset-0/);
  assert.match(modal, /onBeforeInput=\{editorSession\.observeInput\}/);

  const presetBlock = stylePanel.slice(stylePanel.indexOf('swatches.map'), customButtonStart);
  assert.doesNotMatch(presetBlock, /onPickerRequest|PICKER_REQUESTED/);
});

test('UT-ARCH-001 / Corte 2 has one geometry authority and no keyboard heuristics', async () => {
  const [modal, stylePanel, geometry, geometryHook, session, sessionHook, indexHtml] = await Promise.all([
    readFrontendFile('src/components/creator/ManualCardEditorModal.jsx'),
    readFrontendFile('src/components/creator/StylePanel.jsx'),
    readFrontendFile('src/components/creator/manual-editor/editorGeometry.js'),
    readFrontendFile('src/components/creator/manual-editor/useEditorGeometry.js'),
    readFrontendFile('src/components/creator/manual-editor/manualEditorSession.js'),
    readFrontendFile('src/components/creator/manual-editor/useManualEditorSession.js'),
    readFrontendFile('index.html'),
  ]);
  const runtimeV2 = `${modal}\n${stylePanel}\n${geometry}\n${geometryHook}\n${session}\n${sessionHook}`;

  assert.doesNotMatch(runtimeV2, /keyboardOpen|initialLayoutHeight|layoutHeight\s*-\s*100|initialKeyboardCheckTimerRef|data-keyboard-open|@remove-in-cut-2/);
  assert.doesNotMatch(runtimeV2, /useKeyboardHeight/);
  assert.doesNotMatch(runtimeV2, /navigator\.(?:userAgent|platform)|userAgentData/);
  assert.doesNotMatch(runtimeV2, /setTimeout\s*\([^)]*(?:80|250|450)|(?:80|250|450)\s*\)/);
  assert.doesNotMatch(indexHtml, /interactive-widget/i);

  assert.match(modal, /useEditorGeometry\(\{ active: open \}\)/);
  assert.match(modal, /left: `\$\{editorGeometry\.visual\.left\}px`/);
  assert.match(modal, /width: `\$\{editorGeometry\.visual\.width\}px`/);
  assert.match(modal, /--editor-safe-bottom-effective/);
  assert.match(modal, /editorGeometry=\{editorGeometry\}/);
  assert.match(stylePanel, /if \(!hasSharedGeometry\) \{[\s\S]*visualViewport\?\.addEventListener/);
  assert.match(stylePanel, /width: position \? `\$\{position\.width\}px`/);
});

test('Corte 2 safe-area ownership and horizontal overflow contracts are explicit', async () => {
  const modal = await readFrontendFile('src/components/creator/ManualCardEditorModal.jsx');
  assert.equal((modal.match(/env\(safe-area-inset-top/g) || []).length, 1);
  assert.equal((modal.match(/env\(safe-area-inset-left/g) || []).length, 1);
  assert.equal((modal.match(/env\(safe-area-inset-right/g) || []).length, 1);
  assert.equal((modal.match(/env\(safe-area-inset-bottom/g) || []).length, 1);
  assert.match(modal, /overflow-x-hidden overflow-y-auto/);
  assert.match(modal, /footer[\s\S]*overflow-x-hidden/);
  assert.match(modal, /source === 'visual-viewport'[\s\S]*visual\.scale === 1[\s\S]*occlusion\.bottom > 0/);
});

test('Corte 2 entry sanitation keeps the first surface out of the 1x1 sentinel', async () => {
  const [modal, geometry, overlayRoot] = await Promise.all([
    readFrontendFile('src/components/creator/ManualCardEditorModal.jsx'),
    readFrontendFile('src/components/creator/manual-editor/editorGeometry.js'),
    readFrontendFile('src/components/creator/manual-editor/EditorOverlayRoot.jsx'),
  ]);
  assert.match(geometry, /needsInitialEditorGeometryFallback/);
  assert.match(modal, /needsInitialEditorGeometryFallback\(editorGeometry\)[\s\S]*width: '100%'[\s\S]*height: '100dvh'/);
  assert.match(overlayRoot, /needsInitialEditorGeometryFallback\(geometry\)/);
  assert.match(overlayRoot, /width: '100%'[\s\S]*height: '100dvh'/);
});

test('UT-ARCH-001 / Corte 3 has one scoped stack, scroll lease and history owner', async () => {
  const [modal, stylePanel, layerHook, layerReducer, overlayScope, scrollLock, app, deck, actionSheet] = await Promise.all([
    readFrontendFile('src/components/creator/ManualCardEditorModal.jsx'),
    readFrontendFile('src/components/creator/StylePanel.jsx'),
    readFrontendFile('src/components/creator/manual-editor/useEditorLayerStack.js'),
    readFrontendFile('src/components/common/overlays/layerStack.js'),
    readFrontendFile('src/components/common/OverlayScope.jsx'),
    readFrontendFile('src/lib/scrollLock.js'),
    readFrontendFile('src/App.jsx'),
    readFrontendFile('src/components/DeckInterior.jsx'),
    readFrontendFile('src/components/common/ActionSheet.jsx'),
  ]);
  const editorRuntime = `${modal}\n${stylePanel}\n${layerHook}\n${layerReducer}\n${overlayScope}\n${scrollLock}`;
  assert.match(modal, /<OverlayScope/);
  assert.match(modal, /<EditorOverlayRoot/);
  assert.match(stylePanel, /<OverlayPortal/);
  assert.doesNotMatch(stylePanel, /createPortal|z-\[110\]|z-\[120\]/);
  assert.doesNotMatch(modal, /z-\[80\]|z-\[90\]|document\.body\.style\.overflow|addEventListener\(['"]keydown/);
  assert.match(layerHook, /getSharedOverlayEventCoordinator/);
  assert.match(layerReducer, /OPEN_LAYER/);
  assert.doesNotMatch(layerReducer, /callback|HTMLElement|document\.|window\.|geometry|question|answer/);
  assert.match(scrollLock, /acquireScrollLease/);
  assert.match(scrollLock, /useScrollLease/);
  assert.match(app, /data-app-scroll-root/);
  assert.doesNotMatch(deck.slice(deck.indexOf('const handleEdit'), deck.indexOf('const handleDelete')), /window\.scrollTo/);
  assert.doesNotMatch(editorRuntime, /touchmove|scrollIntoView\s*\(|navigator\.(?:userAgent|platform)|interactive-widget/);
  assert.match(actionSheet, /export default function ActionSheet/);
});

test('Corte 4 graduates ActionSheet to the common top-only authority', async () => {
  const [actionSheet, registry, reducer, legacyPath, overlayScope, stylePanel, creator] = await Promise.all([
    readFrontendFile('src/components/common/ActionSheet.jsx'),
    readFrontendFile('src/components/common/overlays/overlayRegistry.js'),
    readFrontendFile('src/components/common/overlays/layerStack.js'),
    readFrontendFile('src/components/creator/manual-editor/editorLayerStack.js'),
    readFrontendFile('src/components/common/OverlayScope.jsx'),
    readFrontendFile('src/components/creator/StylePanel.jsx'),
    readFrontendFile('src/components/FlashcardCreator.jsx'),
  ]);
  assert.match(legacyPath, /export \{ createEditorLayerState, editorLayerReducer \} from '..\/..\/common\/overlays\/layerStack\.js'/);
  assert.doesNotMatch(legacyPath, /case ['"]OPEN_LAYER|function editorLayerReducer/);
  assert.doesNotMatch(`${actionSheet}\n${creator}`, /preserveFocus/);
  assert.doesNotMatch(actionSheet, /useBodyScrollLock|setTimeout\s*\(|addEventListener\(['"]keydown/);
  assert.match(actionSheet, /useLayoutEffect/);
  assert.match(actionSheet, /useEditorGeometry/);
  assert.match(actionSheet, /acquireScrollLease/);
  assert.match(actionSheet, /<OverlayScope/);
  assert.match(actionSheet, /data-action-sheet-backdrop="true"/);
  assert.doesNotMatch(actionSheet, /<button[\s\S]{0,240}data-action-sheet-backdrop/);
  assert.equal((registry.match(/addEventListener\?\.\('keydown'/g) || []).length, 1);
  assert.equal((registry.match(/addEventListener\?\.\('popstate'/g) || []).length, 1);
  assert.match(registry, /createOverlayRegistry/);
  assert.match(reducer, /OPEN_LAYER/);
  assert.doesNotMatch(reducer, /callback|HTMLElement|document\.|window\.|geometry|question|answer/);
  assert.match(overlayScope, /hostLayerId/);
  assert.match(stylePanel, /overlayScope\.layerStack\.toggleLayer/);
  assert.match(stylePanel, /layerId=\{overlayScope\?\.layerStack/);
});

test('KEEP-011 and KEEP-012 remain unchanged in production contracts', async () => {
  const [modal, stylePanel, actionSheet, indexHtml, indexCss] = await Promise.all([
    readFrontendFile('src/components/creator/ManualCardEditorModal.jsx'),
    readFrontendFile('src/components/creator/StylePanel.jsx'),
    readFrontendFile('src/components/common/ActionSheet.jsx'),
    readFrontendFile('index.html'),
    readFrontendFile('src/index.css'),
  ]);
  const editorSurface = `${modal}\n${stylePanel}\n${actionSheet}`;

  assert.doesNotMatch(editorSurface, /\.blur\s*\(/);
  assert.doesNotMatch(editorSurface, /scrollIntoView\s*\(/);
  assert.doesNotMatch(editorSurface, /touchmove/);
  assert.doesNotMatch(editorSurface, /useKeyboardHeight/);
  assert.doesNotMatch(indexHtml, /interactive-widget|maximum-scale|user-scalable\s*=\s*no/i);
  assert.match(indexHtml, /viewport-fit=cover/);
  assert.match(indexCss, /@media \(pointer: coarse\)[\s\S]*textarea,[\s\S]*font-size: 16px !important/);
});

test('KEEP-013 still suspends preview and style sheet while the manual modal is open', async () => {
  const creator = await readFrontendFile('src/components/FlashcardCreator.jsx');
  assert.match(creator, /showPreview && !isManualModalOpen/);
  assert.match(creator, /open=\{showStyles && !isManualModalOpen\}/);
});

test('Playwright remains a development-only dependency', async () => {
  const packageJson = JSON.parse(await readFrontendFile('package.json'));
  assert.equal(packageJson.dependencies?.['@playwright/test'], undefined);
  assert.equal(typeof packageJson.devDependencies?.['@playwright/test'], 'string');
});
