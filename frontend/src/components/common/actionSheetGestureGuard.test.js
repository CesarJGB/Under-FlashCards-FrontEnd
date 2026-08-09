import assert from 'node:assert/strict';
import test from 'node:test';
import {
  installActionSheetGestureGuard,
  shouldContainActionSheetPan,
} from './actionSheetGestureGuard.js';

test('UT-AS-STABLE-001 — short content and both long-content edges contain vertical pan', () => {
  assert.equal(shouldContainActionSheetPan({
    scrollTop: 0, scrollHeight: 200, clientHeight: 200, deltaY: -20,
  }), true);
  assert.equal(shouldContainActionSheetPan({
    scrollTop: 0, scrollHeight: 800, clientHeight: 200, deltaY: 20,
  }), true);
  assert.equal(shouldContainActionSheetPan({
    scrollTop: 600, scrollHeight: 800, clientHeight: 200, deltaY: -20,
  }), true);
  assert.equal(shouldContainActionSheetPan({
    scrollTop: 250, scrollHeight: 800, clientHeight: 200, deltaY: -20,
  }), false);
});

test('UT-AS-STABLE-002 — the guard is layer-local, preserves ranges and cleans every listener', () => {
  const listeners = new Map();
  const layer = {
    addEventListener(type, listener, options) { listeners.set(type, { listener, options }); },
    removeEventListener(type, listener) {
      if (listeners.get(type)?.listener === listener) listeners.delete(type);
    },
    contains: () => true,
  };
  const scrollRoot = { scrollTop: 0, scrollHeight: 200, clientHeight: 200 };
  const target = {
    closest(selector) {
      if (selector === '[data-action-sheet-scroll="true"]') return scrollRoot;
      return null;
    },
  };
  const release = installActionSheetGestureGuard(layer);
  assert.equal(listeners.size, 4);
  assert.equal(listeners.get('touchmove').options.passive, false);

  listeners.get('touchstart').listener({
    target,
    touches: [{ identifier: 1, clientX: 20, clientY: 100 }],
  });
  let prevented = 0;
  listeners.get('touchmove').listener({
    touches: [{ identifier: 1, clientX: 20, clientY: 80 }],
    preventDefault() { prevented += 1; },
  });
  assert.equal(prevented, 1);

  listeners.get('touchstart').listener({
    target,
    touches: [{ identifier: 3, clientX: 20, clientY: 100 }],
  });
  listeners.get('touchmove').listener({
    touches: [{ identifier: 3, clientX: 80, clientY: 98 }],
    preventDefault() { prevented += 1; },
  });
  assert.equal(prevented, 1);

  const rangeTarget = {
    closest(selector) {
      if (selector === '[data-action-sheet-scroll="true"]') return scrollRoot;
      if (selector === 'input[type="range"]') return this;
      return null;
    },
  };
  listeners.get('touchstart').listener({
    target: rangeTarget,
    touches: [{ identifier: 2, clientX: 20, clientY: 100 }],
  });
  listeners.get('touchmove').listener({
    touches: [{ identifier: 2, clientX: 20, clientY: 80 }],
    preventDefault() { prevented += 1; },
  });
  assert.equal(prevented, 1);

  release();
  release();
  assert.equal(listeners.size, 0);
});
