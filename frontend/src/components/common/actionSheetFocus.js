import {
  ACTION_SHEET_SNAP_COMPACT,
  ACTION_SHEET_SNAP_EXPANDED,
} from './actionSheetDrag.js';

// Tolerancia de ruido de geometría, no umbral para declarar que existe un teclado.
export const ACTION_SHEET_GEOMETRY_TOLERANCE = 0.5;
const ACTION_SHEET_SCALE_TOLERANCE = 0.001;

const isValidSnap = (snap) => (
  snap === ACTION_SHEET_SNAP_COMPACT || snap === ACTION_SHEET_SNAP_EXPANDED
);

const isVisualGeometry = (geometry) => (
  geometry?.source === 'visual-viewport'
  && Number.isFinite(geometry.visual?.width)
  && Number.isFinite(geometry.visual?.height)
  && Number.isFinite(geometry.visual?.scale)
  && Number.isFinite(geometry.occlusion?.bottom)
);

const isStableVisualGeometry = (geometry) => (
  geometry?.phase === 'stable' && isVisualGeometry(geometry)
);

const isSameFocusViewport = (baseline, current) => (
  isVisualGeometry(baseline)
  && isStableVisualGeometry(current)
  && Math.abs(baseline.visual.scale - current.visual.scale) <= ACTION_SHEET_SCALE_TOLERANCE
  && baseline.orientation === current.orientation
  && Math.abs(baseline.layout?.width - current.layout?.width) <= ACTION_SHEET_GEOMETRY_TOLERANCE
  && Math.abs(baseline.visual.width - current.visual.width) <= ACTION_SHEET_GEOMETRY_TOLERANCE
);

const hasVerticalOcclusionChange = (baseline, current) => (
  current.visual.height < baseline.visual.height - ACTION_SHEET_GEOMETRY_TOLERANCE
  || current.occlusion.bottom > baseline.occlusion.bottom + ACTION_SHEET_GEOMETRY_TOLERANCE
);

const hasRecoveredFocusViewport = (baseline, current) => (
  current.visual.height >= baseline.visual.height - ACTION_SHEET_GEOMETRY_TOLERANCE
  && current.occlusion.bottom <= baseline.occlusion.bottom + ACTION_SHEET_GEOMETRY_TOLERANCE
);

export function createActionSheetInputFocusState() {
  return {
    active: false,
    previousSnap: null,
    controlId: null,
    baseline: null,
    occlusionObserved: false,
  };
}

export function enterActionSheetInputFocus(
  state = createActionSheetInputFocusState(),
  { currentSnap, controlId = null, geometry = null } = {},
) {
  const shouldExpand = currentSnap !== ACTION_SHEET_SNAP_EXPANDED;
  if (state.active) {
    return {
      state: {
        ...state,
        controlId,
        baseline: state.baseline || (isVisualGeometry(geometry) ? geometry : null),
      },
      shouldExpand,
    };
  }

  return {
    state: {
      active: true,
      previousSnap: isValidSnap(currentSnap) ? currentSnap : null,
      controlId,
      baseline: isVisualGeometry(geometry) ? geometry : null,
      occlusionObserved: false,
    },
    shouldExpand,
  };
}

export function endActionSheetInputFocus(state = createActionSheetInputFocusState()) {
  return {
    state: createActionSheetInputFocusState(),
    restoreSnap: state.active && isValidSnap(state.previousSnap)
      ? state.previousSnap
      : null,
  };
}

export function observeActionSheetInputFocusGeometry(
  state = createActionSheetInputFocusState(),
  geometry,
) {
  const unchanged = {
    state,
    shouldExpand: false,
    restoreSnap: null,
  };
  if (!state.active || !isStableVisualGeometry(geometry)) return unchanged;

  if (!state.baseline) {
    return {
      ...unchanged,
      state: { ...state, baseline: geometry },
    };
  }

  if (!isSameFocusViewport(state.baseline, geometry)) return unchanged;

  if (!state.occlusionObserved) {
    if (!hasVerticalOcclusionChange(state.baseline, geometry)) return unchanged;
    return {
      ...unchanged,
      state: { ...state, occlusionObserved: true },
      shouldExpand: true,
    };
  }

  if (!hasRecoveredFocusViewport(state.baseline, geometry)) return unchanged;
  return {
    ...unchanged,
    state: {
      ...state,
      baseline: geometry,
      occlusionObserved: false,
    },
    restoreSnap: isValidSnap(state.previousSnap) ? state.previousSnap : null,
  };
}

export function isActionSheetInputTarget(target) {
  return Boolean(target?.matches?.('input, textarea, select'));
}

export function shouldKeepActionSheetInputFocus({
  relatedTarget = null,
  activeElement = null,
  container = null,
} = {}) {
  const isInside = (target) => (
    isActionSheetInputTarget(target)
    && (!container || container.contains?.(target))
  );
  return isInside(relatedTarget) || isInside(activeElement);
}
