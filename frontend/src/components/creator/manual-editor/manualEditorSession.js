export const EDITOR_SIDES = Object.freeze(['question', 'answer']);

export const PICKER_STATUSES = Object.freeze([
  'idle',
  'requested',
  'external',
  'committed',
  'cancelled',
  'returned-unknown',
]);

const normalizeSide = (side) => (side === 'answer' ? 'answer' : 'question');

const normalizeDirection = (direction) => (
  direction === 'forward' || direction === 'backward' ? direction : 'none'
);

const toNonNegativeInteger = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : fallback;
};

export function createValueMeta(valueLength = 0, valueRevision = 0) {
  return {
    valueLength: toNonNegativeInteger(valueLength),
    valueRevision: toNonNegativeInteger(valueRevision),
  };
}

function normalizeValueMeta(meta) {
  return createValueMeta(
    meta?.valueLength ?? meta?.length,
    meta?.valueRevision ?? meta?.revision,
  );
}

export function clampSelection(selection, valueLength) {
  const safeLength = toNonNegativeInteger(valueLength);
  const rawStart = toNonNegativeInteger(selection?.start ?? selection?.selectionStart);
  const rawEnd = toNonNegativeInteger(selection?.end ?? selection?.selectionEnd, rawStart);
  const start = Math.min(rawStart, safeLength);
  const end = Math.min(Math.max(rawEnd, start), safeLength);

  return {
    start,
    end,
    selectionStart: start,
    selectionEnd: end,
    direction: normalizeDirection(selection?.direction ?? selection?.selectionDirection),
    selectionDirection: normalizeDirection(selection?.direction ?? selection?.selectionDirection),
    valueLength: safeLength,
    valueRevision: toNonNegativeInteger(selection?.valueRevision),
  };
}

export function createSideSelection(valueMeta, selection = null) {
  const meta = normalizeValueMeta(valueMeta);
  const fallbackCaret = meta.valueLength;
  return clampSelection({
    start: selection?.start ?? selection?.selectionStart ?? fallbackCaret,
    end: selection?.end ?? selection?.selectionEnd ?? fallbackCaret,
    direction: selection?.direction ?? selection?.selectionDirection ?? 'none',
    valueRevision: selection?.valueRevision ?? meta.valueRevision,
  }, selection?.valueLength ?? meta.valueLength);
}

export function canRestoreSelection(selection, valueMeta) {
  if (!selection) return false;
  const meta = normalizeValueMeta(valueMeta);
  return (
    selection.valueLength === meta.valueLength
    && selection.valueRevision === meta.valueRevision
  );
}

export function createIdlePickerState() {
  return {
    status: 'idle',
    transactionId: null,
    kind: null,
    side: null,
    selectionAtOpen: null,
    changed: false,
    draftValue: null,
    committedValue: null,
  };
}

function normalizeInitialOptions(initialSideOrOptions, valueMetaArg) {
  if (initialSideOrOptions && typeof initialSideOrOptions === 'object') {
    return {
      initialSide: normalizeSide(initialSideOrOptions.initialSide),
      open: initialSideOrOptions.open !== false,
      valueMeta: initialSideOrOptions.valueMeta || initialSideOrOptions.values || {},
    };
  }

  return {
    initialSide: normalizeSide(initialSideOrOptions),
    open: true,
    valueMeta: valueMetaArg || {},
  };
}

export function createManualEditorSession(initialSideOrOptions = 'question', valueMetaArg = {}) {
  const options = normalizeInitialOptions(initialSideOrOptions, valueMetaArg);
  const questionMeta = normalizeValueMeta(options.valueMeta.question);
  const answerMeta = normalizeValueMeta(options.valueMeta.answer);

  return {
    phase: options.open ? 'opening' : 'closed',
    sessionRevision: options.open ? 1 : 0,
    activeSide: options.initialSide,
    pendingSide: null,
    valueMeta: {
      question: questionMeta,
      answer: answerMeta,
    },
    selections: {
      question: createSideSelection(questionMeta),
      answer: createSideSelection(answerMeta),
    },
    composition: {
      active: false,
      side: null,
    },
    domFocus: {
      observed: false,
      side: null,
    },
    focusRequestId: options.open ? 1 : 0,
    lastFocusAttemptId: null,
    initialFocusAttempted: false,
    resume: {
      available: false,
      reason: 'none',
    },
    picker: createIdlePickerState(),
  };
}

const sameSelection = (left, right) => (
  left === right
  || (
    left?.start === right?.start
    && left?.end === right?.end
    && left?.direction === right?.direction
    && left?.valueLength === right?.valueLength
    && left?.valueRevision === right?.valueRevision
  )
);

const sameValueMeta = (left, right) => (
  left?.valueLength === right?.valueLength
  && left?.valueRevision === right?.valueRevision
);

function selectionFromEvent(state, side, event) {
  const meta = state.valueMeta[side];
  return createSideSelection({
    valueLength: event.valueLength ?? event.selection?.valueLength ?? meta.valueLength,
    valueRevision: event.valueRevision ?? event.selection?.valueRevision ?? meta.valueRevision,
  }, event.selection || event);
}

function switchSideState(state, nextSide) {
  if (nextSide === state.activeSide) {
    return state.pendingSide === null ? state : { ...state, pendingSide: null };
  }

  return {
    ...state,
    activeSide: nextSide,
    pendingSide: null,
    focusRequestId: state.focusRequestId + 1,
    phase: 'opening',
  };
}

function pickerEventMatches(state, event) {
  return (
    state.phase !== 'closed'
    && state.picker.transactionId !== null
    && event.transactionId === state.picker.transactionId
  );
}

function resumeAfterPicker(state, { force = false, reason = 'picker-returned' } = {}) {
  if (!force && state.domFocus.side === state.activeSide) return state.resume;
  return { available: true, reason };
}

export function manualEditorSessionReducer(state, event) {
  if (!state || !event?.type) return state;

  switch (event.type) {
    case 'OPEN': {
      const side = normalizeSide(event.side ?? state.activeSide);
      const questionMeta = normalizeValueMeta(event.valueMeta?.question ?? state.valueMeta.question);
      const answerMeta = normalizeValueMeta(event.valueMeta?.answer ?? state.valueMeta.answer);
      const next = createManualEditorSession({
        initialSide: side,
        open: true,
        valueMeta: { question: questionMeta, answer: answerMeta },
      });
      return {
        ...next,
        sessionRevision: state.sessionRevision + 1,
        focusRequestId: state.focusRequestId + 1,
      };
    }

    case 'CLOSE':
      if (state.phase === 'closed') return state;
      return {
        ...state,
        phase: 'closed',
        pendingSide: null,
        composition: { active: false, side: null },
        domFocus: { observed: false, side: null },
        resume: { available: false, reason: 'none' },
        picker: createIdlePickerState(),
      };

    case 'VALUE_CHANGED': {
      const side = normalizeSide(event.side);
      const nextMeta = createValueMeta(event.valueLength, event.valueRevision);
      const nextSelection = event.selection
        ? createSideSelection(nextMeta, event.selection)
        : state.selections[side];
      if (
        sameValueMeta(state.valueMeta[side], nextMeta)
        && sameSelection(state.selections[side], nextSelection)
      ) return state;
      return {
        ...state,
        valueMeta: { ...state.valueMeta, [side]: nextMeta },
        selections: { ...state.selections, [side]: nextSelection },
      };
    }

    case 'SELECTION_CAPTURED': {
      const side = normalizeSide(event.side ?? state.activeSide);
      const selection = selectionFromEvent(state, side, event);
      if (sameSelection(state.selections[side], selection)) return state;
      return {
        ...state,
        selections: { ...state.selections, [side]: selection },
      };
    }

    case 'COMPOSITION_STARTED': {
      const side = normalizeSide(event.side ?? state.activeSide);
      if (state.composition.active && state.composition.side === side) return state;
      return { ...state, composition: { active: true, side } };
    }

    case 'COMPOSITION_ENDED': {
      const side = normalizeSide(event.side ?? state.composition.side ?? state.activeSide);
      let nextState = state;
      if (event.selection) {
        const selection = selectionFromEvent(state, side, event);
        nextState = sameSelection(state.selections[side], selection)
          ? state
          : { ...state, selections: { ...state.selections, [side]: selection } };
      }
      nextState = {
        ...nextState,
        composition: { active: false, side: null },
      };
      return state.pendingSide
        ? switchSideState(nextState, state.pendingSide)
        : nextState;
    }

    case 'SIDE_REQUESTED': {
      const nextSide = normalizeSide(event.side);
      if (state.composition.active && state.composition.side === state.activeSide) {
        return state.pendingSide === nextSide ? state : { ...state, pendingSide: nextSide };
      }
      return switchSideState(state, nextSide);
    }

    case 'FOCUS_ATTEMPTED': {
      const requestId = event.requestId ?? state.focusRequestId;
      if (state.lastFocusAttemptId === requestId) return state;
      return {
        ...state,
        lastFocusAttemptId: requestId,
        initialFocusAttempted: state.initialFocusAttempted || event.reason === 'initial',
      };
    }

    case 'FOCUS_OBSERVED': {
      const side = normalizeSide(event.side ?? state.activeSide);
      if (
        state.domFocus.observed
        && state.domFocus.side === side
        && !state.resume.available
        && state.phase === 'editing'
      ) return state;
      return {
        ...state,
        phase: 'editing',
        domFocus: { observed: true, side },
        resume: { available: false, reason: 'none' },
      };
    }

    case 'FOCUS_FAILED': {
      const requestId = event.requestId ?? state.focusRequestId;
      if (state.lastFocusAttemptId !== requestId) return state;
      return {
        ...state,
        phase: 'interrupted',
        domFocus: { observed: false, side: null },
        resume: { available: true, reason: event.reason || 'initial-focus-failed' },
      };
    }

    case 'FOCUS_LEFT': {
      const side = normalizeSide(event.side ?? state.activeSide);
      if (state.domFocus.side !== side) return state;
      return {
        ...state,
        phase: event.offerResume === false ? state.phase : 'interrupted',
        domFocus: { observed: false, side: null },
        resume: event.offerResume === false
          ? state.resume
          : { available: true, reason: event.reason || 'focus-left-editor' },
      };
    }

    case 'RESUME_OFFERED': {
      const reason = event.reason || 'focus-left-editor';
      if (state.resume.available && state.resume.reason === reason) return state;
      return { ...state, phase: 'interrupted', resume: { available: true, reason } };
    }

    case 'RESUME_ACTIVATED':
      return state.resume.available
        ? { ...state, resume: { available: false, reason: 'none' } }
        : state;

    case 'INPUT_OBSERVED':
      if (!state.resume.available && state.phase === 'editing') return state;
      return {
        ...state,
        phase: 'editing',
        resume: { available: false, reason: 'none' },
      };

    case 'PRESET_APPLIED':
      return state;

    case 'PICKER_REQUESTED': {
      if (state.phase === 'closed' || event.transactionId == null) return state;
      if (
        state.picker.transactionId === event.transactionId
        && state.picker.status === 'requested'
      ) return state;
      const side = normalizeSide(event.side ?? state.activeSide);
      const selectionAtOpen = event.selection
        ? selectionFromEvent(state, side, event)
        : state.selections[side];
      return {
        ...state,
        picker: {
          status: 'requested',
          transactionId: event.transactionId,
          kind: event.kind === 'image' ? 'image' : 'color',
          side,
          selectionAtOpen: { ...selectionAtOpen },
          changed: false,
          draftValue: null,
          committedValue: null,
        },
      };
    }

    case 'PICKER_EXTERNAL':
      if (!pickerEventMatches(state, event) || state.picker.status !== 'requested') return state;
      return { ...state, picker: { ...state.picker, status: 'external' } };

    case 'PICKER_INPUT': {
      if (!pickerEventMatches(state, event)) return state;
      if (!['requested', 'external', 'returned-unknown'].includes(state.picker.status)) return state;
      if (state.picker.changed && state.picker.draftValue === event.value) return state;
      return {
        ...state,
        picker: {
          ...state.picker,
          changed: true,
          draftValue: event.value ?? state.picker.draftValue,
        },
      };
    }

    case 'PICKER_COMMITTED': {
      if (!pickerEventMatches(state, event) || state.picker.status === 'committed') return state;
      if (!['requested', 'external', 'returned-unknown'].includes(state.picker.status)) return state;
      const imagePickerCommitted = state.picker.kind === 'image';
      return {
        ...state,
        phase: imagePickerCommitted || state.domFocus.side !== state.activeSide
          ? 'interrupted'
          : state.phase,
        // A native file picker can close the software keyboard while the DOM
        // still reports the textarea as focused. Treat a committed image as an
        // explicit resume point instead of trying to infer keyboard state.
        resume: resumeAfterPicker(state, {
          force: imagePickerCommitted,
          reason: imagePickerCommitted ? 'image-picker-returned' : 'picker-returned',
        }),
        picker: {
          ...state.picker,
          status: 'committed',
          changed: true,
          draftValue: event.value ?? state.picker.draftValue,
          committedValue: event.value ?? state.picker.draftValue,
        },
      };
    }

    case 'PICKER_CANCELLED':
      if (!pickerEventMatches(state, event) || state.picker.status === 'committed') return state;
      if (state.picker.status === 'cancelled') return state;
      return {
        ...state,
        phase: state.domFocus.side === state.activeSide ? state.phase : 'interrupted',
        resume: resumeAfterPicker(state),
        picker: { ...state.picker, status: 'cancelled' },
      };

    case 'PICKER_RETURN_SIGNAL':
      if (!pickerEventMatches(state, event)) return state;
      if (!['requested', 'external'].includes(state.picker.status)) return state;
      return {
        ...state,
        phase: state.domFocus.side === state.activeSide ? state.phase : 'interrupted',
        resume: resumeAfterPicker(state),
        picker: { ...state.picker, status: 'returned-unknown' },
      };

    case 'PICKER_RESOLVED':
      if (!pickerEventMatches(state, event)) return state;
      return { ...state, picker: createIdlePickerState() };

    default:
      return state;
  }
}

/**
 * Must be called directly from the pointer or semantic click handler that owns
 * user activation. It intentionally performs no scheduling.
 */
export function requestColorPickerFromClick(input) {
  if (!input) return { requested: false, method: 'none' };

  if (typeof input.showPicker === 'function') {
    try {
      input.showPicker();
      return { requested: true, method: 'showPicker' };
    } catch {
      // Fall through to the standard click path in the same call stack.
    }
  }

  try {
    input.click();
    return { requested: true, method: 'click' };
  } catch {
    return { requested: false, method: 'none' };
  }
}
