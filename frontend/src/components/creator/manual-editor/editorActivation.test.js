import assert from 'node:assert/strict';
import test from 'node:test';
import { handleFocusPreservingPress } from './editorActivation.js';
import { requestColorPickerFromClick } from './manualEditorSession.js';

const event = (type, options = {}) => {
  let prevented = 0;
  return {
    type,
    button: options.button,
    detail: options.detail,
    pointerType: options.pointerType,
    isPrimary: options.isPrimary,
    preventDefault() { prevented += 1; },
    prevented: () => prevented,
  };
};

test('UT-ACT-001 — pointerdown acts once and its compatibility click is ignored', () => {
  const sources = [];
  const down = event('pointerdown', { button: 0, isPrimary: true });
  const click = event('click', { detail: 1 });

  assert.equal(handleFocusPreservingPress(down, (source) => sources.push(source)), true);
  assert.equal(handleFocusPreservingPress(click, (source) => sources.push(source)), false);
  assert.equal(down.prevented(), 1);
  assert.deepEqual(sources, ['pointer']);
});

test('UT-ACT-002 — semantic click remains available and secondary pointers are ignored', () => {
  const sources = [];
  const keyboardClick = event('click', { detail: 0 });
  const secondary = event('pointerdown', { button: 2, isPrimary: true });
  const nonPrimary = event('pointerdown', { button: 0, isPrimary: false });
  const touchCompatibilityClick = event('click', { detail: 0, pointerType: 'touch' });

  assert.equal(handleFocusPreservingPress(keyboardClick, (source) => sources.push(source)), true);
  assert.equal(handleFocusPreservingPress(secondary, (source) => sources.push(source)), false);
  assert.equal(handleFocusPreservingPress(nonPrimary, (source) => sources.push(source)), false);
  assert.equal(handleFocusPreservingPress(touchCompatibilityClick, (source) => sources.push(source)), false);
  assert.deepEqual(sources, ['semantic-click']);
});

test('UT-ACT-003 — native color request runs once per pointer or semantic activation', () => {
  let requests = 0;
  const input = { showPicker() { requests += 1; } };
  const request = () => requestColorPickerFromClick(input);

  handleFocusPreservingPress(event('pointerdown', { button: 0 }), request);
  handleFocusPreservingPress(event('click', { detail: 1, pointerType: 'touch' }), request);
  assert.equal(requests, 1);

  handleFocusPreservingPress(event('click', { detail: 0 }), request);
  assert.equal(requests, 2);
});
