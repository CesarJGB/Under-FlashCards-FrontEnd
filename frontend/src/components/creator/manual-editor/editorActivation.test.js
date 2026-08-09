import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createFocusPreservingPressState,
  handleFocusPreservingPress,
} from './editorActivation.js';

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
  const state = createFocusPreservingPressState();
  const down = event('pointerdown', { button: 0, isPrimary: true });
  const click = event('click', { detail: 0 });

  assert.equal(handleFocusPreservingPress(down, (source) => sources.push(source), state), true);
  assert.equal(handleFocusPreservingPress(click, (source) => sources.push(source), state), false);
  assert.equal(down.prevented(), 1);
  assert.deepEqual(sources, ['pointer']);
});

test('UT-ACT-002 — semantic click remains available and secondary pointers are ignored', () => {
  const sources = [];
  const state = createFocusPreservingPressState();
  const keyboardClick = event('click', { detail: 0 });
  const secondary = event('pointerdown', { button: 2, isPrimary: true });
  const nonPrimary = event('pointerdown', { button: 0, isPrimary: false });
  const touchCompatibilityClick = event('click', { detail: 0, pointerType: 'touch' });

  assert.equal(handleFocusPreservingPress(keyboardClick, (source) => sources.push(source), state), true);
  assert.equal(handleFocusPreservingPress(secondary, (source) => sources.push(source), state), false);
  assert.equal(handleFocusPreservingPress(nonPrimary, (source) => sources.push(source), state), false);
  assert.equal(handleFocusPreservingPress(touchCompatibilityClick, (source) => sources.push(source), state), false);
  assert.deepEqual(sources, ['semantic-click']);
});

test('UT-ACT-003 — touchstart prevents native focus and does not duplicate pointer activation', () => {
  const sources = [];
  const state = createFocusPreservingPressState();
  const down = event('pointerdown', { button: 0, isPrimary: true, pointerType: 'touch' });
  const touchStart = event('touchstart');
  touchStart.touches = [{}];
  const touchEnd = event('touchend');
  const compatibilityClick = event('click', { detail: 1, pointerType: 'touch' });

  assert.equal(handleFocusPreservingPress(down, (source) => sources.push(source), state), true);
  assert.equal(handleFocusPreservingPress(touchStart, (source) => sources.push(source), state), false);
  assert.equal(handleFocusPreservingPress(touchEnd, (source) => sources.push(source), state), false);
  assert.equal(handleFocusPreservingPress(compatibilityClick, (source) => sources.push(source), state), false);
  assert.equal(touchStart.prevented(), 1);
  assert.deepEqual(sources, ['pointer']);
});
