import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
} from 'react';
import {
  createEditorLayerState,
  editorLayerReducer,
} from './editorLayerStack.js';

const SENTINEL_KEY = '__underFlashManualEditor';
const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

let instanceCounter = 0;
const activeRuntimeInstances = new Map();

const isPlainObject = (value) => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

export function createEditorHistoryState(previousState, token) {
  return {
    ...(isPlainObject(previousState) ? previousState : {}),
    [SENTINEL_KEY]: { token, previousState },
  };
}

export function isEditorHistoryState(state, token) {
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

export function handleEditorLayerKeyDown(event, dismissTop) {
  if (event?.key !== 'Escape') return false;
  event.preventDefault?.();
  event.stopPropagation?.();
  dismissTop?.('escape');
  return true;
}

export function createEditorHistoryController({
  historyLike,
  locationLike,
  token,
  getTopId,
  dismissTop,
  onDismissRoot,
}) {
  let alive = true;
  let armed = false;
  let closing = false;
  let previousState;

  const currentUrl = () => locationLike?.href;
  const arm = (stateToPreserve) => {
    if (!alive || !historyLike?.pushState) return false;
    previousState = stateToPreserve;
    historyLike.pushState(createEditorHistoryState(stateToPreserve, token), '', currentUrl());
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
    if (getTopId?.()) {
      dismissTop?.('back');
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
    // The close path cannot depend on a host delivering popstate. The guarded
    // popstate handler makes a later delivery a no-op.
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
      && isEditorHistoryState(historyLike.state, token)
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

const getFocusable = (scope) => (
  scope?.querySelectorAll ? [...scope.querySelectorAll(FOCUSABLE_SELECTOR)] : []
).filter((node) => node.isConnected && !node.closest?.('[inert]'));

export function getEditorLayerRuntimeSnapshot() {
  const values = [...activeRuntimeInstances.values()];
  return {
    instances: values.length,
    listeners: values.reduce((total, value) => total + value.listeners, 0),
    registrySize: values.reduce((total, value) => total + value.registry.size, 0),
    sentinels: values.filter((value) => value.history?.isArmed()).length,
    owners: values.map((value) => value.owner),
  };
}

export function useEditorLayerStack({
  active,
  dialogRef,
  overlayRootRef,
  onDismissRoot,
  resolveRootReturnFocus,
}) {
  const [state, reactDispatch] = useReducer(editorLayerReducer, undefined, createEditorLayerState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const registryRef = useRef(new Map());
  const tokenCounterRef = useRef(0);
  const historyControllerRef = useRef(null);
  const callbacksRef = useRef({ onDismissRoot, resolveRootReturnFocus });
  callbacksRef.current = { onDismissRoot, resolveRootReturnFocus };
  const runtimeTokenRef = useRef(null);
  if (runtimeTokenRef.current === null) {
    instanceCounter += 1;
    runtimeTokenRef.current = `manual-editor-${instanceCounter}`;
  }

  const dispatch = useCallback((event) => {
    const next = editorLayerReducer(stateRef.current, event);
    if (next === stateRef.current) return next;
    stateRef.current = next;
    reactDispatch(event);
    return next;
  }, []);

  const resolveReturnTarget = useCallback((entry) => {
    const candidates = [
      entry?.resolveReturnFocus?.(),
      entry?.returnTarget,
      callbacksRef.current.resolveRootReturnFocus?.(),
    ];
    return candidates.find((candidate) => (
      candidate?.isConnected === true && !candidate.closest?.('[inert]')
    )) || null;
  }, []);

  const dismissTop = useCallback((reason = 'programmatic') => {
    const top = stateRef.current.layers.at(-1);
    if (!top) {
      return historyControllerRef.current?.requestRootDismiss(reason) ?? false;
    }
    const entry = registryRef.current.get(top.id);
    const next = dispatch({ type: 'DISMISS_TOP', id: top.id, token: top.token });
    if (next.topId === top.id) return false;
    registryRef.current.delete(top.id);
    entry?.onDismiss?.(reason, top.token);
    if (top.focusPolicy === 'move-focus') focusConnectedTarget(resolveReturnTarget(entry));
    return true;
  }, [dispatch, resolveReturnTarget]);

  const dismissLayer = useCallback((id, token, reason = 'programmatic') => {
    const top = stateRef.current.layers.at(-1);
    if (!top || top.id !== id || (token && top.token !== token)) return false;
    return dismissTop(reason);
  }, [dismissTop]);

  const openLayer = useCallback((config = {}) => {
    if (!active || !config.id || config.nativePicker === true) return null;
    tokenCounterRef.current += 1;
    const token = `${runtimeTokenRef.current}:${tokenCounterRef.current}`;
    const returnTarget = config.returnTarget
      || (typeof document !== 'undefined' && document.activeElement !== document.body
        ? document.activeElement
        : null);
    const replaced = stateRef.current.layers.filter((layer) => (
      layer.id === config.id
      || (config.replaceOwner !== false && layer.ownerId === (config.ownerId || 'manual-editor'))
    ));
    replaced.forEach((layer) => {
      const entry = registryRef.current.get(layer.id);
      registryRef.current.delete(layer.id);
      entry?.onDismiss?.('replaced', layer.token);
    });
    registryRef.current.set(config.id, {
      token,
      onDismiss: config.onDismiss,
      returnTarget,
      resolveReturnFocus: config.resolveReturnFocus,
      element: null,
    });
    dispatch({
      type: 'OPEN_LAYER',
      replaceOwner: config.replaceOwner !== false,
      layer: {
        id: config.id,
        ownerId: config.ownerId || 'manual-editor',
        kind: config.kind || 'popover',
        focusPolicy: config.focusPolicy || 'none',
        token,
        historyToken: runtimeTokenRef.current,
      },
    });
    return token;
  }, [active, dispatch]);

  const toggleLayer = useCallback((config = {}) => {
    const existing = stateRef.current.layers.find((layer) => layer.id === config.id);
    if (existing) {
      const entry = registryRef.current.get(existing.id);
      const next = dispatch({
        type: 'TOGGLE_LAYER',
        expectedToken: existing.token,
        layer: existing,
      });
      if (next.layers.some((layer) => layer.id === existing.id)) return null;
      registryRef.current.delete(existing.id);
      entry?.onDismiss?.('toggle', existing.token);
      if (existing.focusPolicy === 'move-focus') focusConnectedTarget(resolveReturnTarget(entry));
      return null;
    }
    return openLayer(config);
  }, [dispatch, openLayer, resolveReturnTarget]);

  const isTop = useCallback((id) => stateRef.current.topId === id, []);

  const getLayerProps = useCallback((id) => ({
    'data-editor-layer-id': id,
    'data-editor-layer-top': stateRef.current.topId === id ? 'true' : 'false',
    ref(node) {
      const entry = registryRef.current.get(id);
      if (!entry) return;
      entry.element = node;
      const layer = stateRef.current.layers.find((candidate) => candidate.id === id);
      if (
        node
        && layer?.focusPolicy === 'move-focus'
        && !node.contains(document.activeElement)
      ) {
        focusConnectedTarget(getFocusable(node)[0]);
      }
    },
  }), []);

  useEffect(() => {
    if (!active || typeof document === 'undefined' || typeof window === 'undefined') return undefined;
    const runtimeToken = runtimeTokenRef.current;
    const runtime = {
      owner: runtimeToken,
      listeners: 0,
      registry: registryRef.current,
      history: null,
    };
    activeRuntimeInstances.set(runtimeToken, runtime);

    const restoreRootFocus = () => {
      focusConnectedTarget(callbacksRef.current.resolveRootReturnFocus?.());
    };
    const historyController = createEditorHistoryController({
      historyLike: window.history,
      locationLike: window.location,
      token: runtimeToken,
      getTopId: () => stateRef.current.topId,
      dismissTop,
      onDismissRoot(reason) {
        callbacksRef.current.onDismissRoot?.(reason);
        restoreRootFocus();
      },
    });
    historyControllerRef.current = historyController;
    runtime.history = historyController;
    historyController.start();

    const handleKeyDown = (event) => {
      if (handleEditorLayerKeyDown(event, dismissTop)) return;
      if (event.key !== 'Tab') return;
      const top = stateRef.current.layers.at(-1);
      const entry = top ? registryRef.current.get(top.id) : null;
      const scope = top?.focusPolicy === 'move-focus'
        ? entry?.element
        : dialogRef?.current;
      const focusable = getFocusable(scope);
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1);
      const activeElement = document.activeElement;
      if (!scope?.contains(activeElement)) {
        event.preventDefault();
        focusConnectedTarget(event.shiftKey ? last : first);
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        focusConnectedTarget(first);
      } else if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        focusConnectedTarget(last);
      }
    };
    const handlePopState = (event) => historyController.handlePopState(event);
    const handlePageHide = () => historyController.cleanup({ pagehide: true });
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('pagehide', handlePageHide);
    runtime.listeners = 3;

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('pagehide', handlePageHide);
      runtime.listeners = 0;
      historyController.cleanup();
      historyControllerRef.current = null;
      registryRef.current.clear();
      stateRef.current = createEditorLayerState();
      reactDispatch({ type: 'RESET' });
      activeRuntimeInstances.delete(runtimeToken);
    };
  }, [active, dialogRef, dismissTop, overlayRootRef]);

  return {
    topId: state.topId,
    layers: state.layers,
    openLayer,
    toggleLayer,
    dismissTop,
    dismissLayer,
    isTop,
    getLayerProps,
  };
}

export default useEditorLayerStack;
