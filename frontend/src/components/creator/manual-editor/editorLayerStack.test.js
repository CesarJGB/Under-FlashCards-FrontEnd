import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEditorLayerState,
  editorLayerReducer,
} from './editorLayerStack.js';
import {
  createEditorHistoryController,
  focusConnectedTarget,
  handleEditorLayerKeyDown,
  isEditorHistoryState,
} from './useEditorLayerStack.js';
import {
  acquireScrollLease,
  getScrollLeaseSnapshot,
} from '../../../lib/scrollLock.js';

const layer = (id, token = `${id}:1`) => ({
  id,
  ownerId: 'editor',
  kind: 'popover',
  focusPolicy: 'pointer-preserve',
  token,
});

test('UT-LAY-001 — toggle is atomic and never closes then reopens', () => {
  const empty = createEditorLayerState();
  const opened = editorLayerReducer(empty, { type: 'TOGGLE_LAYER', layer: layer('color') });
  const closed = editorLayerReducer(opened, {
    type: 'TOGGLE_LAYER',
    layer: layer('color'),
    expectedToken: opened.layers[0].token,
  });
  assert.deepEqual(opened.layers.map(({ id }) => id), ['color']);
  assert.deepEqual(closed.layers, []);
  assert.equal(closed.topId, null);
});

test('UT-LAY-002 — dismiss affects only the top layer', () => {
  const color = editorLayerReducer(createEditorLayerState(), {
    type: 'OPEN_LAYER', layer: layer('color'),
  });
  const sheet = editorLayerReducer(color, {
    type: 'OPEN_LAYER', layer: { ...layer('sheet'), ownerId: 'sheet', kind: 'sheet' },
  });
  const dismissed = editorLayerReducer(sheet, {
    type: 'DISMISS_TOP', id: 'sheet', token: sheet.layers.at(-1).token,
  });
  assert.deepEqual(dismissed.layers.map(({ id }) => id), ['color']);
  assert.equal(dismissed.topId, 'color');
});

test('UT-LAY-003 — one Escape dispatches one dismissal', () => {
  let calls = 0;
  const event = {
    key: 'Escape',
    preventDefault() {},
    stopPropagation() {},
  };
  assert.equal(handleEditorLayerKeyDown(event, (reason) => {
    calls += 1;
    assert.equal(reason, 'escape');
  }), true);
  assert.equal(calls, 1);
});

const createHistory = () => {
  const calls = [];
  return {
    state: { host: 'preserved' },
    calls,
    pushState(state, _title, url) {
      this.state = state;
      calls.push(['push', state, url]);
    },
    replaceState(state, _title, url) {
      this.state = state;
      calls.push(['replace', state, url]);
    },
    back() { calls.push(['back']); },
  };
};

test('UT-LAY-004 — Back closes child, rearms root, then closes root', () => {
  const historyLike = createHistory();
  let topId = 'color';
  const dismissed = [];
  const roots = [];
  const controller = createEditorHistoryController({
    historyLike,
    locationLike: { href: 'https://example.test/current' },
    token: 'instance-1',
    getTopId: () => topId,
    dismissTop(reason) { dismissed.push(reason); topId = null; },
    onDismissRoot(reason) { roots.push(reason); },
  });
  controller.start();
  assert.equal(isEditorHistoryState(historyLike.state, 'instance-1'), true);
  controller.handlePopState({ state: { host: 'preserved' } });
  assert.deepEqual(dismissed, ['back']);
  assert.equal(controller.isArmed(), true);
  controller.handlePopState({ state: { host: 'preserved' } });
  assert.deepEqual(roots, ['back']);
  assert.equal(controller.isArmed(), false);
});

test('UT-LAY-005 — disconnected return target is never focused', () => {
  let calls = 0;
  assert.equal(focusConnectedTarget({ isConnected: false, focus() { calls += 1; } }), false);
  assert.equal(calls, 0);
});

test('UT-LAY-006 — stale layer tokens and events are no-ops', () => {
  const opened = editorLayerReducer(createEditorLayerState(), {
    type: 'OPEN_LAYER', layer: layer('color', 'new-token'),
  });
  const staleRemove = editorLayerReducer(opened, {
    type: 'REMOVE_LAYER', id: 'color', token: 'old-token',
  });
  const staleDismiss = editorLayerReducer(opened, {
    type: 'DISMISS_TOP', id: 'color', token: 'old-token',
  });
  assert.equal(staleRemove, opened);
  assert.equal(staleDismiss, opened);
});

const createElement = ({ overflow = '', overscrollBehavior = '', top = 0, left = 0 } = {}) => ({
  style: { overflow, overscrollBehavior },
  scrollTop: top,
  scrollLeft: left,
  attributes: new Map(),
  inert: false,
  hasAttribute(name) { return this.attributes.has(name); },
  getAttribute(name) { return this.attributes.get(name) ?? null; },
  setAttribute(name, value) { this.attributes.set(name, String(value)); },
  removeAttribute(name) { this.attributes.delete(name); },
});

test('UT-SCR-001 — only the last owner restores scroll and inert', () => {
  const scrollRoot = createElement({ overflow: 'auto', top: 44 });
  const inertRoot = createElement();
  const first = acquireScrollLease({ owner: 'one', scrollRoot, inertRoot });
  const second = acquireScrollLease({ owner: 'two', scrollRoot, inertRoot });
  first();
  assert.equal(scrollRoot.style.overflow, 'hidden');
  assert.equal(inertRoot.inert, true);
  second();
  assert.equal(scrollRoot.style.overflow, 'auto');
  assert.equal(inertRoot.inert, false);
  assert.equal(getScrollLeaseSnapshot().scrollRoots, 0);
});

test('UT-SCR-002 — final release restores exact styles, offsets and inert attribute', () => {
  const scrollRoot = createElement({
    overflow: 'clip', overscrollBehavior: 'contain', top: 91, left: 13,
  });
  const inertRoot = createElement();
  inertRoot.inert = true;
  inertRoot.setAttribute('inert', 'host-owned');
  const release = acquireScrollLease({ owner: 'editor', scrollRoot, inertRoot });
  scrollRoot.scrollTop = 0;
  scrollRoot.scrollLeft = 0;
  release();
  assert.deepEqual(scrollRoot.style, { overflow: 'clip', overscrollBehavior: 'contain' });
  assert.equal(scrollRoot.scrollTop, 91);
  assert.equal(scrollRoot.scrollLeft, 13);
  assert.equal(inertRoot.inert, true);
  assert.equal(inertRoot.getAttribute('inert'), 'host-owned');
});

test('UT-SCR-003 / UT-LIFE-002 — release and repeated setup-cleanup are idempotent', () => {
  const scrollRoot = createElement();
  const inertRoot = createElement();
  for (let cycle = 0; cycle < 2; cycle += 1) {
    const release = acquireScrollLease({ owner: 'strict-owner', scrollRoot, inertRoot });
    release();
    release();
  }
  assert.deepEqual(getScrollLeaseSnapshot(), {
    scrollRoots: 0, inertRoots: 0, ownerCount: 0, owners: [],
  });
});

test('UT-LIFE-001 — history cleanup is complete, idempotent and does not navigate', () => {
  const historyLike = createHistory();
  const controller = createEditorHistoryController({
    historyLike,
    locationLike: { href: 'https://example.test/current' },
    token: 'cleanup-instance',
    getTopId: () => null,
  });
  controller.start();
  controller.cleanup();
  controller.cleanup();
  assert.equal(historyLike.calls.filter(([type]) => type === 'replace').length, 1);
  assert.equal(historyLike.calls.filter(([type]) => type === 'back').length, 0);
  assert.deepEqual(historyLike.state, { host: 'preserved' });
});
