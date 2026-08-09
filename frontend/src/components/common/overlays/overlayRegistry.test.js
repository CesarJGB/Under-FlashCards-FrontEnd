import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createLayerInteractionState,
  createOverlayEventCoordinator,
  createOverlayRegistry,
  focusConnectedTarget,
} from './overlayRegistry.js';
import {
  acquireScrollLease,
  getScrollLeaseSnapshot,
} from '../../../lib/scrollLock.js';

const createEventTarget = () => {
  const listeners = new Map();
  return {
    activeElement: null,
    body: {},
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
    dispatch(type, event) { listeners.get(type)?.(event); },
    listenerCount: () => listeners.size,
  };
};

const createHistory = () => ({
  state: { host: 'preserved' },
  calls: [],
  pushState(state, _title, url) {
    this.state = state;
    this.calls.push(['push', url]);
  },
  replaceState(state, _title, url) {
    this.state = state;
    this.calls.push(['replace', url]);
  },
  back() { this.calls.push(['back']); },
});

const createRegistryFixture = () => {
  const documentLike = createEventTarget();
  const windowLike = createEventTarget();
  const historyLike = createHistory();
  const coordinator = createOverlayEventCoordinator({ documentLike, windowLike });
  const registry = createOverlayRegistry({
    coordinator,
    historyLike,
    locationLike: { href: 'https://example.test/current' },
    documentLike,
  });
  return { coordinator, documentLike, historyLike, registry, windowLike };
};

test('UT-AS-001 — two sheets and a child palette dismiss one top layer per event', () => {
  const { documentLike, registry, windowLike } = createRegistryFixture();
  const dismissed = [];
  registry.openLayer({ id: 'lower', kind: 'sheet', onDismiss: (reason) => dismissed.push(['lower', reason]) });
  registry.openLayer({ id: 'upper', kind: 'sheet', onDismiss: (reason) => dismissed.push(['upper', reason]) });
  registry.openLayer({ id: 'palette', ownerId: 'upper', kind: 'popover', onDismiss: (reason) => dismissed.push(['palette', reason]) });

  assert.equal(registry.getSnapshot().topId, 'palette');
  documentLike.dispatch('keydown', {
    key: 'Escape', preventDefault() {}, stopPropagation() {},
  });
  assert.deepEqual(dismissed, [['palette', 'escape']]);
  assert.equal(registry.getSnapshot().topId, 'upper');
  windowLike.dispatch('popstate', { state: { host: 'preserved' } });
  assert.deepEqual(dismissed, [['palette', 'escape'], ['upper', 'back']]);
  assert.equal(registry.getSnapshot().topId, 'lower');
  windowLike.dispatch('popstate', { state: { host: 'preserved' } });
  assert.deepEqual(dismissed, [
    ['palette', 'escape'],
    ['upper', 'back'],
    ['lower', 'back'],
  ]);
  assert.equal(registry.getSnapshot().topId, null);
  assert.equal(registry.getRuntimeSnapshot().registrySize, 0);
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

test('UT-AS-002 — lower modality, focus safety and final owner cleanup are deterministic', () => {
  const { coordinator, registry } = createRegistryFixture();
  const lowerToken = registry.openLayer({ id: 'lower', kind: 'sheet' });
  const upperToken = registry.openLayer({ id: 'upper', kind: 'sheet' });
  assert.deepEqual(createLayerInteractionState(false), {
    inert: '', ariaHidden: 'true', backdropTabIndex: undefined,
  });
  assert.deepEqual(createLayerInteractionState(true), {
    inert: undefined, ariaHidden: undefined, backdropTabIndex: undefined,
  });
  assert.equal(registry.isTop('lower'), false);
  assert.equal(registry.isTop('upper'), true);

  let disconnectedFocusCalls = 0;
  assert.equal(focusConnectedTarget({
    isConnected: false,
    focus() { disconnectedFocusCalls += 1; },
  }), false);
  assert.equal(disconnectedFocusCalls, 0);

  const scrollRoot = createElement({ overflow: 'auto', overscrollBehavior: 'contain', top: 87, left: 9 });
  const inertRoot = createElement();
  const releaseLower = acquireScrollLease({ owner: 'lower', scrollRoot, inertRoot });
  const releaseUpper = acquireScrollLease({ owner: 'upper', scrollRoot, inertRoot });
  registry.removeLayer('upper', upperToken, 'test');
  releaseUpper();
  assert.equal(scrollRoot.style.overflow, 'hidden');
  assert.equal(inertRoot.inert, true);
  assert.equal(registry.isTop('lower'), true);
  registry.removeLayer('lower', lowerToken, 'test');
  releaseLower();
  assert.deepEqual(scrollRoot.style, { overflow: 'auto', overscrollBehavior: 'contain' });
  assert.equal(scrollRoot.scrollTop, 87);
  assert.equal(scrollRoot.scrollLeft, 9);
  assert.equal(inertRoot.inert, false);
  assert.deepEqual(getScrollLeaseSnapshot(), {
    scrollRoots: 0, inertRoots: 0, ownerCount: 0, owners: [],
  });
  assert.equal(registry.getRuntimeSnapshot().registrySize, 0);
  assert.deepEqual(coordinator.getSnapshot(), { hosts: 0, listeners: 0 });
});
