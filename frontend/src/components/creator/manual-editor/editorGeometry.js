const ORIENTATIONS = new Set(['portrait', 'landscape', 'square']);
const SOURCES = new Set(['visual-viewport', 'layout-fallback']);

// VisualViewport values can jitter by a few tenths of a CSS pixel while the
// browser chrome or OSK settles. Keep position/size and scale tolerances
// separate: CSS pixels and the unitless zoom factor have different semantics.
export const GEOMETRY_CSS_PX_TOLERANCE = 0.5;
export const GEOMETRY_SCALE_TOLERANCE = 0.001;

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

const asFiniteNumber = (value) => (isFiniteNumber(value) ? value : null);

const asPositiveNumber = (value) => {
  const number = asFiniteNumber(value);
  return number !== null && number > 0 ? number : null;
};

const smallestPositive = (...values) => {
  const candidates = values.map(asPositiveNumber).filter((value) => value !== null);
  return candidates.length ? Math.min(...candidates) : null;
};

const orientationFromRect = (rect) => {
  if (rect.width === rect.height) return 'square';
  return rect.width > rect.height ? 'landscape' : 'portrait';
};

const createRect = (left, top, width, height) => {
  const normalizedLeft = asFiniteNumber(left);
  const normalizedTop = asFiniteNumber(top);
  const normalizedWidth = asPositiveNumber(width);
  const normalizedHeight = asPositiveNumber(height);
  if (
    normalizedLeft === null
    || normalizedTop === null
    || normalizedWidth === null
    || normalizedHeight === null
  ) return null;
  return {
    left: normalizedLeft,
    top: normalizedTop,
    width: normalizedWidth,
    height: normalizedHeight,
  };
};

const createVisualRect = (left, top, width, height, scale) => {
  const rect = createRect(left, top, width, height);
  const normalizedScale = asPositiveNumber(scale);
  return rect && normalizedScale !== null ? { ...rect, scale: normalizedScale } : null;
};

const createOcclusion = (layout, visual) => {
  const layoutRight = layout.left + layout.width;
  const layoutBottom = layout.top + layout.height;
  const visualRight = visual.left + visual.width;
  const visualBottom = visual.top + visual.height;
  return {
    top: Math.max(0, visual.top - layout.top),
    right: Math.max(0, layoutRight - visualRight),
    bottom: Math.max(0, layoutBottom - visualBottom),
    left: Math.max(0, visual.left - layout.left),
  };
};

export function createUnavailableEditorGeometry() {
  const fallbackRect = { left: 0, top: 0, width: 1, height: 1 };
  return {
    revision: 0,
    epoch: 0,
    phase: 'unavailable',
    source: 'layout-fallback',
    orientation: 'square',
    layout: fallbackRect,
    visual: { ...fallbackRect, scale: 1 },
    occlusion: { top: 0, right: 0, bottom: 0, left: 0 },
  };
}

/** True only before the observer has ever published a valid sample. */
export function needsInitialEditorGeometryFallback(snapshot) {
  return Boolean(
    snapshot
    && snapshot.phase === 'unavailable'
    && snapshot.epoch === 0
    && snapshot.revision === 0
  );
}

function normalizeGeometrySample(sample) {
  if (!sample || typeof sample !== 'object') return null;
  const layout = createRect(
    sample.layout?.left,
    sample.layout?.top,
    sample.layout?.width,
    sample.layout?.height,
  );
  const visual = createVisualRect(
    sample.visual?.left,
    sample.visual?.top,
    sample.visual?.width,
    sample.visual?.height,
    sample.visual?.scale,
  );
  const source = SOURCES.has(sample.source) ? sample.source : null;
  if (!layout || !visual || !source) return null;

  const orientation = ORIENTATIONS.has(sample.orientation)
    ? sample.orientation
    : orientationFromRect(layout);
  return {
    revision: 0,
    epoch: 0,
    phase: 'settling',
    source,
    orientation,
    layout,
    visual,
    occlusion: createOcclusion(layout, visual),
  };
}

/**
 * Reads observable geometry from explicit window/document-like inputs.
 * It never reads module globals and never attributes occlusion to a cause.
 */
export function readEditorGeometry(windowLike, documentLike) {
  const documentElement = documentLike?.documentElement;
  const layoutWidth = smallestPositive(
    windowLike?.innerWidth,
    documentElement?.clientWidth,
  );
  const layoutHeight = smallestPositive(
    windowLike?.innerHeight,
    documentElement?.clientHeight,
  );
  const layout = createRect(0, 0, layoutWidth, layoutHeight);
  if (!layout) return null;

  const visualViewport = windowLike?.visualViewport;
  const visualFromViewport = createVisualRect(
    visualViewport?.offsetLeft,
    visualViewport?.offsetTop,
    visualViewport?.width,
    visualViewport?.height,
    visualViewport?.scale,
  );
  const source = visualFromViewport ? 'visual-viewport' : 'layout-fallback';
  const visual = visualFromViewport || { ...layout, scale: 1 };

  return {
    revision: 0,
    epoch: 0,
    phase: 'settling',
    source,
    orientation: orientationFromRect(layout),
    layout,
    visual,
    occlusion: createOcclusion(layout, visual),
  };
}

const RECT_FIELDS = ['left', 'top', 'width', 'height'];
const OCCLUSION_FIELDS = ['top', 'right', 'bottom', 'left'];

const valuesWithinTolerance = (left, right, tolerance) => (
  isFiniteNumber(left)
  && isFiniteNumber(right)
  && Math.abs(left - right) <= tolerance
);

/** Compares only observable sample semantics, never reducer metadata. */
export function geometrySamplesEqual(left, right) {
  if (left === right) return true;
  if (!left || !right) return false;
  if (left.source !== right.source || left.orientation !== right.orientation) return false;
  if (!valuesWithinTolerance(
    left.visual?.scale,
    right.visual?.scale,
    GEOMETRY_SCALE_TOLERANCE,
  )) return false;
  if (RECT_FIELDS.some((field) => !valuesWithinTolerance(
    left.layout?.[field],
    right.layout?.[field],
    GEOMETRY_CSS_PX_TOLERANCE,
  ))) return false;
  if (RECT_FIELDS.some((field) => !valuesWithinTolerance(
    left.visual?.[field],
    right.visual?.[field],
    GEOMETRY_CSS_PX_TOLERANCE,
  ))) return false;
  return !OCCLUSION_FIELDS.some((field) => !valuesWithinTolerance(
    left.occlusion?.[field],
    right.occlusion?.[field],
    GEOMETRY_CSS_PX_TOLERANCE,
  ));
}

const publishSample = (state, sample) => {
  const normalized = normalizeGeometrySample(sample);
  if (!normalized) return reduceEditorGeometry(state, { type: 'SOURCE_UNAVAILABLE' });
  if (state.phase === 'stable' && geometrySamplesEqual(state, normalized)) return state;
  if (state.phase === 'settling' && geometrySamplesEqual(state, normalized)) return state;

  const orientationChanged = state.epoch > 0 && state.orientation !== normalized.orientation;
  return {
    ...normalized,
    revision: state.revision + 1,
    epoch: state.epoch === 0 ? 1 : state.epoch + (orientationChanged ? 1 : 0),
    phase: 'settling',
  };
};

/**
 * Pure geometry reducer. OPEN, SAMPLE, CONFIRM, SOURCE_UNAVAILABLE and CLOSE
 * are its only events; no event contains focus, selection, picker or safe area.
 */
export function reduceEditorGeometry(state = createUnavailableEditorGeometry(), event = {}) {
  switch (event.type) {
    case 'OPEN':
      return state;

    case 'SAMPLE':
      return publishSample(state, event.sample);

    case 'CONFIRM': {
      const normalized = normalizeGeometrySample(event.sample);
      if (!normalized) return reduceEditorGeometry(state, { type: 'SOURCE_UNAVAILABLE' });
      if (!geometrySamplesEqual(state, normalized)) return publishSample(state, normalized);
      if (state.phase === 'stable') return state;
      if (state.phase !== 'settling') return publishSample(state, normalized);
      return {
        ...state,
        phase: 'stable',
        revision: state.revision + 1,
      };
    }

    case 'SOURCE_UNAVAILABLE':
      if (state.phase === 'unavailable') return state;
      return {
        ...state,
        phase: 'unavailable',
        revision: state.revision + 1,
      };

    case 'CLOSE':
      return state.phase === 'unavailable' && state.revision === 0
        ? state
        : createUnavailableEditorGeometry();

    default:
      return state;
  }
}
