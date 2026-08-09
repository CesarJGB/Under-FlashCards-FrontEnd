import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
} from 'react';
import {
  createEditorLayerState,
  editorLayerReducer,
} from '../../common/overlays/layerStack.js';
import {
  createOverlayHistoryController,
  focusConnectedTarget,
  getFocusableElements,
  getSharedOverlayEventCoordinator,
  isOverlayHistoryState,
} from '../../common/overlays/overlayRegistry.js';

let instanceCounter = 0;
const activeRuntimeInstances = new Map();

export { focusConnectedTarget, isOverlayHistoryState as isEditorHistoryState };

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
  return createOverlayHistoryController({
    historyLike,
    locationLike,
    token,
    getDepth: () => (getTopId?.() ? 1 : 0),
    dismissTop,
    onDismissRoot,
  });
}

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
        focusConnectedTarget(getFocusableElements(node)[0]);
      }
    },
  }), []);

  const removeLayer = useCallback((id, token, reason = 'unmount', { invoke = true } = {}) => {
    const layer = stateRef.current.layers.find((candidate) => candidate.id === id);
    if (!layer || (token && layer.token !== token)) return false;
    const entry = registryRef.current.get(id);
    const next = dispatch({ type: 'REMOVE_LAYER', id, token: layer.token });
    if (next.layers.some((candidate) => candidate.id === id)) return false;
    registryRef.current.delete(id);
    if (invoke) entry?.onDismiss?.(reason, layer.token);
    return true;
  }, [dispatch]);

  const removeOwnerLayers = useCallback((ownerId, reason = 'host-unmount') => {
    const owned = stateRef.current.layers
      .filter((layer) => layer.ownerId === ownerId)
      .reverse();
    owned.forEach((layer) => removeLayer(layer.id, layer.token, reason, { invoke: false }));
    return owned.length;
  }, [removeLayer]);

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
      const focusable = getFocusableElements(scope);
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
    const releaseCoordinator = getSharedOverlayEventCoordinator().registerHost({
      id: runtimeToken,
      handleKeyDown,
      handlePopState: (event) => historyController.handlePopState(event),
      handlePageHide: () => historyController.cleanup({ pagehide: true }),
    });
    runtime.listeners = 0;

    return () => {
      releaseCoordinator();
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
    removeLayer,
    removeOwnerLayers,
    isTop,
    getLayerProps,
  };
}

export default useEditorLayerStack;
