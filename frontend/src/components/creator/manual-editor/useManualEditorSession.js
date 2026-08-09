import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
} from 'react';
import {
  canRestoreSelection,
  clampSelection,
  createManualEditorSession,
  createSideSelection,
  createValueMeta,
  manualEditorSessionReducer,
} from './manualEditorSession';

const normalizeSide = (side) => (side === 'answer' ? 'answer' : 'question');
const asString = (value) => (typeof value === 'string' ? value : '');

function readTextareaSelection(textarea, valueRevision) {
  if (!textarea) return null;
  const valueLength = textarea.value.length;
  return createSideSelection({ valueLength, valueRevision }, {
    start: textarea.selectionStart,
    end: textarea.selectionEnd,
    direction: textarea.selectionDirection,
    valueLength,
    valueRevision,
  });
}

export default function useManualEditorSession({
  open,
  initialSide = 'question',
  question,
  answer,
  textareaRef,
}) {
  const normalizedInitialSide = normalizeSide(initialSide);
  const initialValuesRef = useRef({
    question: asString(question),
    answer: asString(answer),
  });
  const observedValuesRef = useRef({ ...initialValuesRef.current });
  const valueRevisionRef = useRef({ question: 0, answer: 0 });
  const transactionCounterRef = useRef(0);
  const previousOpenRef = useRef(Boolean(open));
  const handledFocusRequestRef = useRef(0);

  const [state, dispatch] = useReducer(
    manualEditorSessionReducer,
    null,
    () => createManualEditorSession({
      initialSide: normalizedInitialSide,
      open: Boolean(open),
      valueMeta: {
        question: createValueMeta(initialValuesRef.current.question.length, 0),
        answer: createValueMeta(initialValuesRef.current.answer.length, 0),
      },
    }),
  );

  useLayoutEffect(() => {
    const wasOpen = previousOpenRef.current;
    previousOpenRef.current = Boolean(open);

    if (open && !wasOpen) {
      dispatch({
        type: 'OPEN',
        side: normalizedInitialSide,
        valueMeta: {
          question: createValueMeta(
            observedValuesRef.current.question.length,
            valueRevisionRef.current.question,
          ),
          answer: createValueMeta(
            observedValuesRef.current.answer.length,
            valueRevisionRef.current.answer,
          ),
        },
      });
    } else if (!open && wasOpen) {
      dispatch({ type: 'CLOSE' });
    }
  }, [normalizedInitialSide, open]);

  useLayoutEffect(() => {
    const nextValues = {
      question: asString(question),
      answer: asString(answer),
    };

    for (const side of ['question', 'answer']) {
      if (observedValuesRef.current[side] === nextValues[side]) continue;
      observedValuesRef.current[side] = nextValues[side];
      valueRevisionRef.current[side] += 1;
      dispatch({
        type: 'VALUE_CHANGED',
        side,
        valueLength: nextValues[side].length,
        valueRevision: valueRevisionRef.current[side],
      });
    }
  }, [answer, question]);

  const captureSelection = useCallback((side = state.activeSide) => {
    const normalizedSide = normalizeSide(side);
    const textarea = textareaRef.current;
    if (!textarea || normalizedSide !== state.activeSide) {
      return state.selections[normalizedSide];
    }

    const selection = readTextareaSelection(
      textarea,
      valueRevisionRef.current[normalizedSide],
    );
    if (!selection) return state.selections[normalizedSide];
    dispatch({ type: 'SELECTION_CAPTURED', side: normalizedSide, selection });
    return selection;
  }, [state.activeSide, state.selections, textareaRef]);

  const restoreSelection = useCallback((side, textarea = textareaRef.current) => {
    const normalizedSide = normalizeSide(side);
    if (!textarea) return false;
    const meta = state.valueMeta[normalizedSide];
    const savedSelection = state.selections[normalizedSide];
    const restorable = canRestoreSelection(savedSelection, meta);
    const selection = restorable
      ? clampSelection(savedSelection, meta.valueLength)
      : createSideSelection(meta);

    try {
      textarea.setSelectionRange(
        selection.start,
        selection.end,
        selection.direction,
      );
    } catch {
      return false;
    }

    if (!restorable || !canRestoreSelection(savedSelection, meta)) {
      dispatch({
        type: 'SELECTION_CAPTURED',
        side: normalizedSide,
        selection,
      });
    }
    return true;
  }, [state.selections, state.valueMeta, textareaRef]);

  const attemptFocus = useCallback(({
    side = state.activeSide,
    reason = 'continuation',
    requestId = state.focusRequestId,
    restore = true,
  } = {}) => {
    const normalizedSide = normalizeSide(side);
    const textarea = textareaRef.current;
    dispatch({ type: 'FOCUS_ATTEMPTED', requestId, reason });

    if (!textarea || textarea.isConnected === false) {
      dispatch({ type: 'FOCUS_FAILED', requestId, reason: `${reason}-failed` });
      return false;
    }

    let focusCallCompleted = false;
    try {
      textarea.focus({ preventScroll: true });
      focusCallCompleted = true;
    } catch {
      try {
        textarea.focus();
        focusCallCompleted = true;
      } catch {
        focusCallCompleted = false;
      }
    }

    const focusObserved = focusCallCompleted && (
      typeof document === 'undefined' || document.activeElement === textarea
    );
    if (focusObserved) {
      dispatch({ type: 'FOCUS_OBSERVED', side: normalizedSide });
    } else {
      dispatch({ type: 'FOCUS_FAILED', requestId, reason: `${reason}-failed` });
    }

    // Selection is deliberately isolated from focus. A range exception must
    // never cause another focus() call.
    if (restore) restoreSelection(normalizedSide, textarea);
    return focusObserved;
  }, [restoreSelection, state.activeSide, state.focusRequestId, textareaRef]);

  useLayoutEffect(() => {
    if (!open || state.phase === 'closed') return;
    if (handledFocusRequestRef.current === state.focusRequestId) return;
    handledFocusRequestRef.current = state.focusRequestId;
    attemptFocus({
      side: state.activeSide,
      reason: state.initialFocusAttempted ? 'side-switch' : 'initial',
      requestId: state.focusRequestId,
    });
  }, [attemptFocus, open, state.activeSide, state.focusRequestId, state.initialFocusAttempted, state.phase]);

  const updateValue = useCallback((side, nextValue, selectionLike) => {
    const normalizedSide = normalizeSide(side);
    const normalizedValue = asString(nextValue);
    observedValuesRef.current[normalizedSide] = normalizedValue;
    valueRevisionRef.current[normalizedSide] += 1;
    const revision = valueRevisionRef.current[normalizedSide];
    const selection = selectionLike
      ? createSideSelection({ valueLength: normalizedValue.length, valueRevision: revision }, {
        start: selectionLike.selectionStart,
        end: selectionLike.selectionEnd,
        direction: selectionLike.selectionDirection,
        valueLength: normalizedValue.length,
        valueRevision: revision,
      })
      : null;
    dispatch({
      type: 'VALUE_CHANGED',
      side: normalizedSide,
      valueLength: normalizedValue.length,
      valueRevision: revision,
      selection,
    });
  }, []);

  const switchSide = useCallback((nextSide) => {
    captureSelection(state.activeSide);
    dispatch({ type: 'SIDE_REQUESTED', side: normalizeSide(nextSide) });
  }, [captureSelection, state.activeSide]);

  const startComposition = useCallback((side = state.activeSide) => {
    dispatch({ type: 'COMPOSITION_STARTED', side: normalizeSide(side) });
  }, [state.activeSide]);

  const endComposition = useCallback((side = state.activeSide, textarea = textareaRef.current) => {
    const normalizedSide = normalizeSide(side);
    const selection = readTextareaSelection(
      textarea,
      valueRevisionRef.current[normalizedSide],
    );
    dispatch({ type: 'COMPOSITION_ENDED', side: normalizedSide, selection });
  }, [state.activeSide, textareaRef]);

  const observeFocus = useCallback((side = state.activeSide) => {
    dispatch({ type: 'FOCUS_OBSERVED', side: normalizeSide(side) });
  }, [state.activeSide]);

  const observeBlur = useCallback((side = state.activeSide) => {
    captureSelection(side);
    dispatch({
      type: 'FOCUS_LEFT',
      side: normalizeSide(side),
      reason: 'focus-left-editor',
    });
  }, [captureSelection, state.activeSide]);

  const observeInput = useCallback(() => {
    dispatch({ type: 'INPUT_OBSERVED' });
  }, []);

  const resolveResumeFromGesture = useCallback(() => {
    dispatch({ type: 'RESUME_ACTIVATED' });
    return attemptFocus({
      side: state.activeSide,
      reason: 'resume-gesture',
      requestId: state.focusRequestId,
    });
  }, [attemptFocus, state.activeSide, state.focusRequestId]);

  const beginPicker = useCallback((kind) => {
    const side = state.activeSide;
    const selection = captureSelection(side);
    const transactionId = transactionCounterRef.current + 1;
    transactionCounterRef.current = transactionId;
    dispatch({
      type: 'PICKER_REQUESTED',
      transactionId,
      kind,
      side,
      selection,
    });
    return transactionId;
  }, [captureSelection, state.activeSide]);

  const markPickerExternal = useCallback((transactionId) => {
    if (transactionId == null) return false;
    // This can run in the same gesture stack as PICKER_REQUESTED. The reducer
    // receives both actions in order and remains the stale-event authority.
    dispatch({ type: 'PICKER_EXTERNAL', transactionId });
    return true;
  }, []);

  const updatePickerDraft = useCallback((transactionId, value) => {
    if (
      state.picker.transactionId !== transactionId
      || !['requested', 'external', 'returned-unknown'].includes(state.picker.status)
    ) return false;
    dispatch({ type: 'PICKER_INPUT', transactionId, value });
    return true;
  }, [state.picker.status, state.picker.transactionId]);

  const commitPicker = useCallback((transactionId, value) => {
    if (
      state.picker.transactionId !== transactionId
      || !['requested', 'external', 'returned-unknown'].includes(state.picker.status)
    ) return false;
    dispatch({ type: 'PICKER_COMMITTED', transactionId, value });
    return true;
  }, [state.picker.status, state.picker.transactionId]);

  const cancelPicker = useCallback((transactionId) => {
    if (
      state.picker.transactionId !== transactionId
      || !['requested', 'external', 'returned-unknown'].includes(state.picker.status)
    ) return false;
    dispatch({ type: 'PICKER_CANCELLED', transactionId });
    return true;
  }, [state.picker.status, state.picker.transactionId]);

  const signalPickerReturn = useCallback((transactionId = state.picker.transactionId) => {
    if (transactionId == null) return false;
    dispatch({ type: 'PICKER_RETURN_SIGNAL', transactionId });
    return true;
  }, [state.picker.transactionId]);

  const resolvePicker = useCallback((transactionId) => {
    if (state.picker.transactionId !== transactionId) return false;
    dispatch({ type: 'PICKER_RESOLVED', transactionId });
    return true;
  }, [state.picker.transactionId]);

  useEffect(() => {
    if (!open || typeof window === 'undefined' || typeof document === 'undefined') return undefined;

    const handlePossibleReturn = () => {
      const pickerCanReturn = ['requested', 'external'].includes(state.picker.status);
      if (!pickerCanReturn) return;
      if (
        state.domFocus.observed
        && textareaRef.current
        && document.activeElement !== textareaRef.current
      ) {
        dispatch({
          type: 'FOCUS_LEFT',
          side: state.domFocus.side,
          reason: 'picker-returned',
        });
      }
      signalPickerReturn();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') handlePossibleReturn();
    };

    window.addEventListener('focus', handlePossibleReturn);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('focus', handlePossibleReturn);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [open, signalPickerReturn, state.domFocus, state.picker.status, textareaRef]);

  return {
    state,
    activeSide: state.activeSide,
    captureSelection,
    restoreSelection,
    attemptFocus,
    updateValue,
    switchSide,
    startComposition,
    endComposition,
    observeFocus,
    observeBlur,
    observeInput,
    resolveResumeFromGesture,
    beginPicker,
    markPickerExternal,
    updatePickerDraft,
    commitPicker,
    cancelPicker,
    signalPickerReturn,
    resolvePicker,
  };
}
