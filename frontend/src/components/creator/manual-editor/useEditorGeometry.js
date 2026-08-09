import { useEffect, useRef, useState } from 'react';
import {
  createUnavailableEditorGeometry,
  readEditorGeometry,
  reduceEditorGeometry,
} from './editorGeometry.js';

const DIAGNOSTICS_ENABLED = Boolean(
  import.meta.env?.DEV || import.meta.env?.MODE === 'test',
);

const emitDiagnostic = (callback, type, snapshot) => {
  if (!DIAGNOSTICS_ENABLED || typeof callback !== 'function') return;
  callback(type, {
    rects: {
      layout: snapshot.layout,
      visual: snapshot.visual,
    },
    visualViewport: {
      width: snapshot.visual.width,
      height: snapshot.visual.height,
      offsetLeft: snapshot.visual.left,
      offsetTop: snapshot.visual.top,
      scale: snapshot.visual.scale,
    },
    orientation: snapshot.orientation,
    state: { geometry: snapshot.phase },
  });
};

/**
 * Imperative owner used by the hook and deterministic lifecycle tests.
 * Events only invalidate; every read occurs inside the single rAF scheduler.
 */
export function observeEditorGeometry({
  windowLike,
  documentLike,
  initialState = createUnavailableEditorGeometry(),
  onSnapshot,
  onDiagnosticEvent,
}) {
  let alive = true;
  let cleaned = false;
  let frameId = null;
  let requestedMode = initialState.phase === 'settling' ? 'confirm' : 'sample';
  let state = initialState;
  const visualViewport = windowLike?.visualViewport;
  const requestFrame = typeof windowLike?.requestAnimationFrame === 'function'
    ? windowLike.requestAnimationFrame.bind(windowLike)
    : (callback) => {
      callback(0);
      return 0;
    };
  const cancelFrame = typeof windowLike?.cancelAnimationFrame === 'function'
    ? windowLike.cancelAnimationFrame.bind(windowLike)
    : () => {};

  const publish = (event, diagnosticType) => {
    const next = reduceEditorGeometry(state, event);
    if (next === state) return state;
    state = next;
    onSnapshot?.(next);
    emitDiagnostic(onDiagnosticEvent, diagnosticType, next);
    return next;
  };

  const schedule = (mode = 'sample') => {
    if (!alive) return;
    if (mode === 'sample' || requestedMode === null) requestedMode = mode;
    if (frameId !== null) return;
    frameId = requestFrame(() => {
      frameId = null;
      if (!alive) return;
      const modeToRun = requestedMode || 'sample';
      requestedMode = null;
      const sample = readEditorGeometry(windowLike, documentLike);
      if (!sample) {
        publish({ type: 'SOURCE_UNAVAILABLE' }, 'geometry:unavailable');
        return;
      }
      const next = publish(
        { type: modeToRun === 'confirm' ? 'CONFIRM' : 'SAMPLE', sample },
        modeToRun === 'confirm' ? 'geometry:stable' : 'geometry:sample',
      );
      if (next.phase === 'settling') schedule('confirm');
    });
  };

  const invalidate = () => schedule('sample');
  visualViewport?.addEventListener?.('resize', invalidate);
  visualViewport?.addEventListener?.('scroll', invalidate);
  windowLike?.addEventListener?.('resize', invalidate);
  schedule(requestedMode);

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    alive = false;
    if (frameId !== null) {
      cancelFrame(frameId);
      frameId = null;
    }
    visualViewport?.removeEventListener?.('resize', invalidate);
    visualViewport?.removeEventListener?.('scroll', invalidate);
    windowLike?.removeEventListener?.('resize', invalidate);
  };

  cleanup.getSnapshot = () => state;
  cleanup.invalidate = invalidate;
  return cleanup;
}

export default function useEditorGeometry({ active, onDiagnosticEvent } = {}) {
  const diagnosticCallbackRef = useRef(onDiagnosticEvent);
  diagnosticCallbackRef.current = onDiagnosticEvent;
  const stateRef = useRef(null);
  if (stateRef.current === null) stateRef.current = createUnavailableEditorGeometry();
  const [snapshot, setSnapshot] = useState(stateRef.current);

  useEffect(() => {
    if (!active || typeof window === 'undefined' || typeof document === 'undefined') {
      const closed = reduceEditorGeometry(stateRef.current, { type: 'CLOSE' });
      stateRef.current = closed;
      setSnapshot((current) => (current === closed ? current : closed));
      return undefined;
    }

    const opened = reduceEditorGeometry(stateRef.current, { type: 'OPEN' });
    stateRef.current = opened;
    const cleanup = observeEditorGeometry({
      windowLike: window,
      documentLike: document,
      initialState: opened,
      onSnapshot(next) {
        stateRef.current = next;
        setSnapshot(next);
      },
      onDiagnosticEvent(type, detail) {
        diagnosticCallbackRef.current?.(type, detail);
      },
    });

    return cleanup;
  }, [active]);

  return snapshot;
}
