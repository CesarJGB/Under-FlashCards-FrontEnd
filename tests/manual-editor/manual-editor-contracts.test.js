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
    'layerIds',
    'listenerCount',
    'orientation',
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
  const [modal, stylePanel, actionSheet] = await Promise.all([
    readFrontendFile('src/components/creator/ManualCardEditorModal.jsx'),
    readFrontendFile('src/components/creator/StylePanel.jsx'),
    readFrontendFile('src/components/common/ActionSheet.jsx'),
  ]);

  assert.match(modal, /<textarea/);
  assert.match(modal, /selectionStart/);
  assert.match(modal, /selectionEnd/);
  assert.match(modal, /setSelectionRange/);
  assert.match(modal, /visualViewport\?\.addEventListener\('resize'/);
  assert.match(modal, /visualViewport\?\.addEventListener\('scroll'/);
  assert.match(modal, /visualViewport\?\.removeEventListener\('resize'/);
  assert.match(modal, /<footer[\s\S]*?className="[^"]*shrink-0/);
  assert.match(modal, /overflow-y-auto overscroll-contain/);
  assert.match(stylePanel, /overflow-x-auto overscroll-contain/);
  assert.match(actionSheet, /overflow-y-auto overscroll-contain/);
  assert.match(modal, /Toca para (?:seguir|comenzar) a escribir/);
});

test('KEEP-002 and KEEP-003 retain picker detection, fallback and an uncontrolled color input', async () => {
  const stylePanel = await readFrontendFile('src/components/creator/StylePanel.jsx');
  assert.match(stylePanel, /typeof input\.showPicker === 'function'/);
  assert.match(stylePanel, /input\.showPicker\(\)/);
  assert.match(stylePanel, /catch\s*\{/);
  assert.match(stylePanel, /input\.click\(\)/);
  assert.match(stylePanel, /type="color"[\s\S]*?defaultValue=\{initialColorInputValue\.current\}/);
  assert.doesNotMatch(stylePanel, /type="color"[\s\S]{0,240}?value=\{/);
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
