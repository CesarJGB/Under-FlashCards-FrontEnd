import {
  createEditorLayerState,
  editorLayerReducer,
} from './layerStack.js';

const SENTINEL_KEY = '__underFlashOverlay';
const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

let coordinatorCounter = 0;
let registryCounter = 0;
let sharedCoordinator;
let sharedRegistry;

const isPlainObject = (value) => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

export function createOverlayHistoryState(previousState, token) {
  return {
    ...(isPlainObject(previousState) ? previousState : {}),
    [SENTINEL_KEY]: { token, previousState },
  };
}

export function isOverlayHistoryState(state, token) {
  return Boolean(state?.[SENTINEL_KEY]?.token === token);
}

export function focusConnectedTarget(target) {
  if (!target || target.isConnected !== true || typeof target.focus !== 'function') return false;
  if (target.closest?.('[inert]')) return false;
  try {
    target.focus({ preventScroll: true });
  } catch {
    target.focus();
  }
  return true;
}

export const getFocusableElements = (scope) => (
  scope?.querySelectorAll ? [...scope.querySelectorAll(FOCUSABLE_SELECTOR)] : []
).filter((node) => node.isConnected && !node.closest?.('[inert]'));

export function createLayerInteractionState(isTop) {
  return {
    inert: isTop ? undefined : '',
    ariaHidden: isTop ? undefined : 'true',
    backdropTabIndex: undefined,
  };
}

export function createOverlayHistoryController({
  historyLike,
  locationLike,
  token,
  getDepth,
  dismissTop,
  onDismissRoot,
  rootIsLayer = false,
}) {
  let alive = true;
  let armed = false;
  let closing = false;
  let previousState;

  const currentUrl = () => locationLike?.href;
  const arm = (stateToPreserve) => {
    if (!alive || !historyLike?.pushState) return false;
    previousState = stateToPreserve;
    historyLike.pushState(createOverlayHistoryState(stateToPreserve, token), '', currentUrl());
    armed = true;
    return true;
  };

  const start = () => {
    if (armed || !alive) return false;
    return arm(historyLike?.state);
  };

  const handlePopState = (event = {}) => {
    if (!alive || closing) return false;
    armed = false;
    const depth = Number(getDepth?.() || 0);
    if (rootIsLayer && depth > 0) {
      if (depth === 1) closing = true;
      dismissTop?.('back', { fromHistory: true });
      if (depth > 1) arm(event.state);
      return true;
    }
    if (depth > 0) {
      dismissTop?.('back', { fromHistory: true });
      arm(event.state);
      return true;
    }
    closing = true;
    onDismissRoot?.('back');
    return true;
  };

  const requestRootDismiss = (reason = 'programmatic') => {
    if (!alive || closing) return false;
    closing = true;
    if (armed && typeof historyLike?.back === 'function') {
      armed = false;
      historyLike.back();
    }
    onDismissRoot?.(reason);
    return true;
  };

  const cleanup = ({ pagehide = false } = {}) => {
    if (!alive) return;
    alive = false;
    if (
      !pagehide
      && armed
      && historyLike?.replaceState
      && isOverlayHistoryState(historyLike.state, token)
    ) {
      historyLike.replaceState(previousState, '', currentUrl());
    }
    armed = false;
  };

  return {
    start,
    handlePopState,
    requestRootDismiss,
    cleanup,
    isArmed: () => armed,
    isClosing: () => closing,
  };
}

export function createOverlayEventCoordinator({ documentLike, windowLike } = {}) {
  const hosts = new Map();
  let sequence = 0;
  let listening = false;

  const topHost = () => [...hosts.values()].sort((left, right) => left.order - right.order).at(-1);
  const handleKeyDown = (event) => topHost()?.handleKeyDown?.(event);
  const handlePopState = (event) => topHost()?.handlePopState?.(event);
  const handlePageHide = () => {
    [...hosts.values()].forEach((host) => host.handlePageHide?.());
  };
  const attach = () => {
    if (listening || !documentLike || !windowLike) return;
    documentLike.addEventListener?.('keydown', handleKeyDown);
    windowLike.addEventListener?.('popstate', handlePopState);
    windowLike.addEventListener?.('pagehide', handlePageHide);
    listening = true;
  };
  const detach = () => {
    if (!listening || hosts.size > 0) return;
    documentLike?.removeEventListener?.('keydown', handleKeyDown);
    windowLike?.removeEventListener?.('popstate', handlePopState);
    windowLike?.removeEventListener?.('pagehide', handlePageHide);
    listening = false;
  };

  return {
    registerHost(config) {
      coordinatorCounter += 1;
      const id = config.id || `overlay-host-${coordinatorCounter}`;
      sequence += 1;
      hosts.set(id, { ...config, id, order: sequence });
      attach();
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        hosts.delete(id);
        detach();
      };
    },
    getSnapshot: () => ({ hosts: hosts.size, listeners: listening ? 3 : 0 }),
  };
}

export function getSharedOverlayEventCoordinator() {
  if (!sharedCoordinator) {
    sharedCoordinator = createOverlayEventCoordinator({
      documentLike: typeof document !== 'undefined' ? document : null,
      windowLike: typeof window !== 'undefined' ? window : null,
    });
  }
  return sharedCoordinator;
}

export function createOverlayRegistry({
  coordinator,
  historyLike,
  locationLike,
  documentLike,
} = {}) {
  registryCounter += 1;
  const owner = `action-sheet-registry-${registryCounter}`;
  let state = createEditorLayerState();
  let tokenCounter = 0;
  let unregisterHost = null;
  let historyController = null;
  const entries = new Map();
  const subscribers = new Set();
  const pendingFocus = new Map();

  const notify = () => subscribers.forEach((subscriber) => subscriber());
  const dispatch = (event) => {
    const next = editorLayerReducer(state, event);
    if (next === state) return state;
    state = next;
    notify();
    return state;
  };
  const resolveReturnTarget = (entry) => {
    const candidates = [entry?.resolveReturnFocus?.(), entry?.returnTarget];
    return candidates.find((candidate) => (
      candidate?.isConnected === true && !candidate.closest?.('[inert]')
    )) || null;
  };
  const deactivate = ({ preserveHistory = false } = {}) => {
    unregisterHost?.();
    unregisterHost = null;
    historyController?.cleanup({ pagehide: preserveHistory });
    historyController = null;
  };
  const removeTopCore = (reason) => {
    const top = state.layers.at(-1);
    if (!top) return false;
    const entry = entries.get(top.id);
    const next = dispatch({ type: 'DISMISS_TOP', id: top.id, token: top.token });
    if (next.topId === top.id) return false;
    entries.delete(top.id);
    const returnTarget = resolveReturnTarget(entry);
    if (returnTarget) pendingFocus.set(next.topId || '__root__', returnTarget);
    entry?.onDismiss?.(reason, top.token);
    if (next.layers.length === 0) deactivate({ preserveHistory: reason === 'back' });
    return true;
  };
  const dismissTop = (reason = 'programmatic', options = {}) => {
    const depth = state.layers.length;
    if (!depth) return false;
    if (!options.fromHistory && depth === 1 && historyController?.isArmed()) {
      return historyController.requestRootDismiss(reason);
    }
    return removeTopCore(reason);
  };
  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault?.();
      event.stopPropagation?.();
      dismissTop('escape');
      return true;
    }
    if (event.key !== 'Tab') return false;
    const top = state.layers.at(-1);
    const scope = top ? entries.get(top.id)?.element : null;
    const focusable = getFocusableElements(scope);
    if (!focusable.length) {
      event.preventDefault?.();
      focusConnectedTarget(scope);
      return true;
    }
    const first = focusable[0];
    const last = focusable.at(-1);
    const activeElement = documentLike?.activeElement;
    if (!scope?.contains?.(activeElement)) {
      event.preventDefault?.();
      focusConnectedTarget(event.shiftKey ? last : first);
    } else if (!event.shiftKey && activeElement === last) {
      event.preventDefault?.();
      focusConnectedTarget(first);
    } else if (event.shiftKey && activeElement === first) {
      event.preventDefault?.();
      focusConnectedTarget(last);
    }
    return true;
  };
  const activate = () => {
    if (unregisterHost) return;
    historyController = createOverlayHistoryController({
      historyLike,
      locationLike,
      token: owner,
      getDepth: () => state.layers.length,
      dismissTop,
      rootIsLayer: true,
      onDismissRoot: removeTopCore,
    });
    historyController.start();
    unregisterHost = coordinator?.registerHost({
      id: owner,
      handleKeyDown,
      handlePopState: (event) => historyController?.handlePopState(event),
      handlePageHide: () => historyController?.cleanup({ pagehide: true }),
    }) || null;
  };

  const openLayer = (config = {}) => {
    if (!config.id || config.nativePicker === true) return null;
    activate();
    tokenCounter += 1;
    const token = `${owner}:${tokenCounter}`;
    const returnTarget = config.returnTarget || (
      documentLike?.activeElement && documentLike.activeElement !== documentLike.body
        ? documentLike.activeElement
        : null
    );
    const replaced = state.layers.filter((layer) => (
      layer.id === config.id
      || (config.replaceOwner === true && layer.ownerId === (config.ownerId || owner))
    ));
    replaced.forEach((layer) => {
      const entry = entries.get(layer.id);
      entries.delete(layer.id);
      entry?.onDismiss?.('replaced', layer.token);
    });
    entries.set(config.id, {
      token,
      onDismiss: config.onDismiss,
      returnTarget,
      resolveReturnFocus: config.resolveReturnFocus,
      element: null,
    });
    dispatch({
      type: 'OPEN_LAYER',
      replaceOwner: config.replaceOwner === true,
      layer: {
        id: config.id,
        ownerId: config.ownerId || owner,
        kind: config.kind || 'sheet',
        focusPolicy: config.focusPolicy || 'move-focus',
        token,
        historyToken: owner,
      },
    });
    return token;
  };

  const removeLayer = (id, token, reason = 'unmount', { invoke = false } = {}) => {
    const layer = state.layers.find((candidate) => candidate.id === id);
    if (!layer || (token && layer.token !== token)) return false;
    const entry = entries.get(id);
    const next = dispatch({ type: 'REMOVE_LAYER', id, token: layer.token });
    entries.delete(id);
    const returnTarget = resolveReturnTarget(entry);
    if (returnTarget) pendingFocus.set(next.topId || '__root__', returnTarget);
    if (invoke) entry?.onDismiss?.(reason, layer.token);
    if (next.layers.length === 0) deactivate();
    return true;
  };

  const dismissLayer = (id, token, reason = 'programmatic') => {
    const top = state.layers.at(-1);
    if (!top || top.id !== id || (token && top.token !== token)) return false;
    return dismissTop(reason);
  };

  const removeOwnerLayers = (ownerId, reason = 'host-unmount') => {
    const owned = state.layers.filter((layer) => layer.ownerId === ownerId).reverse();
    owned.forEach((layer) => removeLayer(layer.id, layer.token, reason));
    return owned.length;
  };

  const toggleLayer = (config = {}) => {
    const existing = state.layers.find((candidate) => candidate.id === config.id);
    if (existing) {
      dismissLayer(existing.id, existing.token, 'toggle');
      return null;
    }
    return openLayer(config);
  };

  return {
    owner,
    subscribe(subscriber) {
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },
    getSnapshot: () => state,
    openLayer,
    toggleLayer,
    dismissTop,
    dismissLayer,
    removeLayer,
    removeOwnerLayers,
    isTop: (id) => state.topId === id,
    getLayerProps(id) {
      return {
        'data-overlay-layer-id': id,
        'data-overlay-layer-top': state.topId === id ? 'true' : 'false',
        ref(node) {
          const entry = entries.get(id);
          if (entry) entry.element = node;
        },
      };
    },
    consumePendingFocus(id) {
      const target = pendingFocus.get(id);
      pendingFocus.delete(id);
      return target || null;
    },
    getRuntimeSnapshot: () => ({
      layers: state.layers.length,
      topId: state.topId,
      registrySize: entries.size,
      subscribers: subscribers.size,
      armed: Boolean(historyController?.isArmed()),
    }),
    cleanup() {
      entries.clear();
      pendingFocus.clear();
      state = createEditorLayerState();
      deactivate();
      notify();
    },
  };
}

export function getSharedOverlayRegistry() {
  if (!sharedRegistry) {
    sharedRegistry = createOverlayRegistry({
      coordinator: getSharedOverlayEventCoordinator(),
      historyLike: typeof window !== 'undefined' ? window.history : null,
      locationLike: typeof window !== 'undefined' ? window.location : null,
      documentLike: typeof document !== 'undefined' ? document : null,
    });
  }
  return sharedRegistry;
}

export function getSharedOverlayRuntimeSnapshot() {
  return {
    coordinator: getSharedOverlayEventCoordinator().getSnapshot(),
    registry: getSharedOverlayRegistry().getRuntimeSnapshot(),
  };
}
