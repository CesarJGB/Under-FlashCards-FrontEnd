import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FOLDER_TITLE_LAYOUT,
  getFolderTitleSafeArea,
  getMateriaTitleLayout,
} from './materiaTitleLayout.js';

const proportionalMeasure = (text, fontSize) => [...String(text)].reduce((width, character) => {
  if (character === ' ') return width + fontSize * 0.28;
  if ('iílI1'.includes(character)) return width + fontSize * 0.25;
  if ('WwMm'.includes(character)) return width + fontSize * 0.88;
  return width + fontSize * 0.5;
}, 0);

test('a visually fitting one-line title shows the MATERIA label', () => {
  const layout = getMateriaTitleLayout({
    name: 'Cálculo',
    availableWidth: 100,
    measureText: proportionalMeasure,
  });

  assert.equal(layout.state, 'single');
  assert.equal(layout.showLabel, true);
  assert.equal(layout.maxLines, 1);
});

test('comfortable and dense two-line states omit MATERIA and cap text at two lines', () => {
  const comfortable = getMateriaTitleLayout({
    name: 'Química general',
    availableWidth: 86,
    measureText: proportionalMeasure,
  });
  const dense = getMateriaTitleLayout({
    name: 'Matemáticas aplicadas para ingeniería química',
    availableWidth: 96,
    measureText: proportionalMeasure,
  });

  assert.equal(comfortable.state, 'comfortable');
  assert.equal(comfortable.showLabel, false);
  assert.equal(comfortable.maxLines, FOLDER_TITLE_LAYOUT.maxLines);
  assert.equal(dense.state, 'dense');
  assert.equal(dense.showLabel, false);
  assert.equal(dense.maxLines, FOLDER_TITLE_LAYOUT.maxLines);
});

test('classification follows measured glyph width instead of character count', () => {
  const narrowGlyphs = getMateriaTitleLayout({
    name: 'iiiiii',
    availableWidth: 70,
    measureText: proportionalMeasure,
  });
  const wideGlyphs = getMateriaTitleLayout({
    name: 'WWWWWW',
    availableWidth: 70,
    measureText: proportionalMeasure,
  });

  assert.equal(narrowGlyphs.state, 'single');
  assert.notEqual(wideGlyphs.state, 'single');
});

test('the safe title rectangle reserves the action button and pastel strip', () => {
  const folderWidth = 160;
  const safeArea = getFolderTitleSafeArea(folderWidth);
  const titleTopEdge = FOLDER_TITLE_LAYOUT.folderFrontTopPx + safeArea.topPx;
  const actionButtonBottomEdge = FOLDER_TITLE_LAYOUT.actionButtonTopPx
    + FOLDER_TITLE_LAYOUT.actionButtonHeightPx;

  assert.equal(titleTopEdge - actionButtonBottomEdge, FOLDER_TITLE_LAYOUT.titleActionGapPx);
  assert.equal(
    safeArea.widthPx,
    folderWidth - FOLDER_TITLE_LAYOUT.leftPaddingPx - FOLDER_TITLE_LAYOUT.rightPaddingPx
  );
  assert.equal(
    safeArea.bottomReservedPx,
    FOLDER_TITLE_LAYOUT.bottomStripeHeightPx + FOLDER_TITLE_LAYOUT.bottomStripeGapPx
  );
  assert.equal(FOLDER_TITLE_LAYOUT.maxLines, 2);
});
