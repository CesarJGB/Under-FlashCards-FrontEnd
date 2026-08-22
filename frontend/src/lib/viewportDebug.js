// INSTRUMENTACIÓN TEMPORAL: retirar este archivo y sus dos puntos de llamada
// cuando termine la investigación del arranque de la PWA en iOS.
const DEBUG_QUERY_PARAM = 'viewportDebug';
const MAX_HISTORY_ENTRIES = 240;
const MAX_GEOMETRY_CHANGES = 120;
const PANEL_HISTORY_ENTRIES = 24;
const SAFE_AREA_PROBE_ID = '__under_flashcards_viewport_debug_safe_area';
const VIEWPORT_UNITS_PROBE_ID = '__under_flashcards_viewport_debug_units';
const PANEL_ID = '__under_flashcards_viewport_debug_panel';

// La ventana inicial evita confundir una geometría temporalmente quieta con
// la geometría final que WebKit puede entregar unos frames más tarde.
export const GEOMETRY_TOLERANCE_PX = 0.5;
export const STABLE_FRAMES_REQUIRED = 3;
export const MIN_INITIAL_OBSERVATION_MS = 150;
export const STABILITY_OBSERVATION_WINDOW_MS = 500;
export const HIGH_RESOLUTION_SAMPLE_WINDOW_MS = 200;
export const POST_CONFIRMATION_OBSERVATION_MS = 250;
const STABILITY_MONITOR_END_MS = 1000;

const RECT_FIELDS = ['x', 'y', 'top', 'right', 'bottom', 'left', 'width', 'height'];
const VIEWPORT_GEOMETRY_PATHS = [
  'innerWidth',
  'innerHeight',
  'documentElementClientWidth',
  'documentElementClientHeight',
  'visualViewport.width',
  'visualViewport.height',
  'visualViewport.offsetTop',
  'visualViewport.offsetLeft',
  'visualViewport.scale',
];
const SAFE_AREA_GEOMETRY_PATHS = [
  'safeArea.safeTop',
  'safeArea.safeBottom',
  'safeArea.safeLeft',
  'safeArea.safeRight',
];
const HTML_BODY_GEOMETRY_PATHS = [
  ...RECT_FIELDS.map((field) => `htmlRect.${field}`),
  ...RECT_FIELDS.map((field) => `bodyRect.${field}`),
];
const ROOT_GEOMETRY_PATHS = RECT_FIELDS.map((field) => `rootRect.${field}`);
const SURFACE_GEOMETRY_PATHS = RECT_FIELDS.map((field) => `loginSurfaceRect.${field}`);
const ALL_GEOMETRY_PATHS = [
  ...VIEWPORT_GEOMETRY_PATHS,
  ...SAFE_AREA_GEOMETRY_PATHS,
  ...HTML_BODY_GEOMETRY_PATHS,
  ...ROOT_GEOMETRY_PATHS,
  ...SURFACE_GEOMETRY_PATHS,
];

const readDebugQuery = (windowLike) => {
  try {
    return new URLSearchParams(windowLike.location?.search || '').get(DEBUG_QUERY_PARAM);
  } catch {
    return null;
  }
};

const setDebugPreference = (windowLike) => {
  try {
    windowLike.localStorage.setItem(DEBUG_QUERY_PARAM, '1');
    return true;
  } catch {
    return false;
  }
};

const removeDebugPreference = (windowLike) => {
  try {
    windowLike.localStorage.removeItem(DEBUG_QUERY_PARAM);
    return true;
  } catch {
    return false;
  }
};

const persistDebugPreference = (windowLike, queryValue) => {
  try {
    const storage = windowLike.localStorage;
    if (queryValue === '1') setDebugPreference(windowLike);
    if (queryValue === '0') removeDebugPreference(windowLike);
    return storage.getItem(DEBUG_QUERY_PARAM) === '1';
  } catch {
    // Safari puede bloquear localStorage en algunos contextos; la query sigue
    // siendo suficiente para activar o desactivar esta instrumentación.
    return null;
  }
};

const round = (value, digits = 2) => {
  if (!Number.isFinite(Number(value))) return null;
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
};

const normalizeNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const normalizeRect = (rect) => {
  if (!rect || typeof rect !== 'object') return null;
  return Object.fromEntries(RECT_FIELDS.map((field) => [field, normalizeNumber(rect[field])]));
};

const normalizeVisualViewport = (snapshot) => {
  const viewport = snapshot?.visualViewport;
  const hasFlatValues = Object.prototype.hasOwnProperty.call(snapshot || {}, 'visualViewportWidth');
  if (!viewport && !hasFlatValues) return null;
  return {
    width: normalizeNumber(viewport?.width ?? snapshot.visualViewportWidth),
    height: normalizeNumber(viewport?.height ?? snapshot.visualViewportHeight),
    offsetTop: normalizeNumber(viewport?.offsetTop ?? snapshot.visualViewportOffsetTop),
    offsetLeft: normalizeNumber(viewport?.offsetLeft ?? snapshot.visualViewportOffsetLeft),
    scale: normalizeNumber(viewport?.scale ?? snapshot.visualViewportScale),
  };
};

const normalizeSafeArea = (snapshot) => {
  const safeArea = snapshot?.safeArea || {};
  return {
    safeTop: normalizeNumber(safeArea.safeTop ?? snapshot?.safeTop),
    safeBottom: normalizeNumber(safeArea.safeBottom ?? snapshot?.safeBottom),
    safeLeft: normalizeNumber(safeArea.safeLeft ?? snapshot?.safeLeft),
    safeRight: normalizeNumber(safeArea.safeRight ?? snapshot?.safeRight),
  };
};

/**
 * Extrae solo los valores que pueden cambiar la geometría observable.
 * Mantener esta función pura permite probar la tolerancia sin un DOM real.
 */
export function normalizeGeometrySnapshot(snapshot) {
  return {
    innerWidth: normalizeNumber(snapshot?.innerWidth),
    innerHeight: normalizeNumber(snapshot?.innerHeight),
    documentElementClientWidth: normalizeNumber(snapshot?.documentElementClientWidth),
    documentElementClientHeight: normalizeNumber(snapshot?.documentElementClientHeight),
    visualViewport: normalizeVisualViewport(snapshot),
    safeArea: normalizeSafeArea(snapshot),
    htmlRect: normalizeRect(snapshot?.htmlRect),
    bodyRect: normalizeRect(snapshot?.bodyRect),
    rootRect: normalizeRect(snapshot?.rootRect),
    loginSurfaceRect: normalizeRect(snapshot?.loginSurfaceRect),
  };
}

const readGeometryPath = (geometry, path) => path
  .split('.')
  .reduce((value, key) => value?.[key], geometry);

const valuesEqual = (left, right, tolerance = GEOMETRY_TOLERANCE_PX) => {
  const normalizedLeft = normalizeNumber(left);
  const normalizedRight = normalizeNumber(right);
  if (normalizedLeft === null || normalizedRight === null) {
    return normalizedLeft === normalizedRight;
  }
  return Math.abs(normalizedLeft - normalizedRight) <= tolerance;
};

const changedPaths = (previous, next, paths, tolerance) => paths.filter((path) => (
  !valuesEqual(
    readGeometryPath(previous, path),
    readGeometryPath(next, path),
    tolerance,
  )
));

/**
 * Compara dos snapshots sin exigir igualdad subpíxel. La salida separa
 * viewport, safe-area, html/body, root y superficie para que el resumen pueda
 * explicar qué cambió y en qué orden.
 */
export function compareGeometrySnapshots(
  previousSnapshot,
  nextSnapshot,
  tolerance = GEOMETRY_TOLERANCE_PX,
) {
  const previous = normalizeGeometrySnapshot(previousSnapshot);
  const next = normalizeGeometrySnapshot(nextSnapshot);
  const hasPrevious = previousSnapshot !== null && previousSnapshot !== undefined;
  const paths = hasPrevious ? changedPaths(previous, next, ALL_GEOMETRY_PATHS, tolerance) : [];
  const viewportChangedFields = hasPrevious
    ? changedPaths(previous, next, VIEWPORT_GEOMETRY_PATHS, tolerance)
    : [];
  const visualViewportChangedFields = hasPrevious
    ? changedPaths(
      previous,
      next,
      VIEWPORT_GEOMETRY_PATHS.filter((path) => path.startsWith('visualViewport.')),
      tolerance,
    )
    : [];
  const safeAreaChangedFields = hasPrevious
    ? changedPaths(previous, next, SAFE_AREA_GEOMETRY_PATHS, tolerance)
    : [];
  const htmlBodyChangedFields = hasPrevious
    ? changedPaths(previous, next, HTML_BODY_GEOMETRY_PATHS, tolerance)
    : [];
  const rootChangedFields = hasPrevious
    ? changedPaths(previous, next, ROOT_GEOMETRY_PATHS, tolerance)
    : [];
  const surfaceChangedFields = hasPrevious
    ? changedPaths(previous, next, SURFACE_GEOMETRY_PATHS, tolerance)
    : [];

  return {
    changed: paths.length > 0,
    meaningful: paths.length > 0,
    changedFields: paths,
    viewportChanged: viewportChangedFields.length > 0,
    viewportChangedFields,
    visualViewportChanged: visualViewportChangedFields.length > 0,
    visualViewportChangedFields,
    safeAreaChanged: safeAreaChangedFields.length > 0,
    safeAreaChangedFields,
    htmlBodyChanged: htmlBodyChangedFields.length > 0,
    htmlBodyChangedFields,
    rootChanged: rootChangedFields.length > 0,
    rootChangedFields,
    surfaceChanged: surfaceChangedFields.length > 0,
    surfaceChangedFields,
  };
}

export function areGeometrySnapshotsEquivalent(
  leftSnapshot,
  rightSnapshot,
  tolerance = GEOMETRY_TOLERANCE_PX,
) {
  return !compareGeometrySnapshots(leftSnapshot, rightSnapshot, tolerance).changed;
}

const emptyComparison = {
  changed: false,
  meaningful: false,
  changedFields: [],
  viewportChanged: false,
  viewportChangedFields: [],
  visualViewportChanged: false,
  visualViewportChangedFields: [],
  safeAreaChanged: false,
  safeAreaChangedFields: [],
  htmlBodyChanged: false,
  htmlBodyChangedFields: [],
  rootChanged: false,
  rootChangedFields: [],
  surfaceChanged: false,
  surfaceChangedFields: [],
};

/**
 * Tracker puro de estabilidad. Un cambio de cualquier geometría reinicia la
 * racha de frames. La racha solo empieza después de la ventana mínima, y una
 * confirmación posterior puede invalidarse si llega un cambio tardío. Tras
 * confirmar, se mantiene una espera adicional para descubrir otro cambio.
 */
export function createStabilityTracker({
  initialSnapshot = null,
  stableFramesRequired = STABLE_FRAMES_REQUIRED,
  minimumObservationMs = MIN_INITIAL_OBSERVATION_MS,
  observationWindowMs = STABILITY_OBSERVATION_WINDOW_MS,
  postConfirmationObservationMs = POST_CONFIRMATION_OBSERVATION_MS,
} = {}) {
  const requiredFrames = Math.max(1, Math.floor(Number(stableFramesRequired) || STABLE_FRAMES_REQUIRED));
  const minimumMs = Math.max(0, Number(minimumObservationMs) || 0);
  const observationMs = Math.max(minimumMs, Number(observationWindowMs) || 0);
  const postConfirmationMs = Math.max(0, Number(postConfirmationObservationMs) || 0);
  let previous = initialSnapshot === null || initialSnapshot === undefined
    ? null
    : normalizeGeometrySnapshot(initialSnapshot);
  const state = {
    firstGeometryChangeAtMs: null,
    firstMeaningfulGeometryChangeAtMs: null,
    lastGeometryChangeAtMs: null,
    lastMeaningfulGeometryChangeAtMs: null,
    stableAtMs: null,
    unstableWindowMs: null,
    confirmationAtMs: null,
    firstConfirmationAtMs: null,
    finalizedAtMs: null,
    stableFrameCount: 0,
    stableFramesAtConfirmation: null,
    confirmationCount: 0,
    status: 'observing',
  };

  const getState = (elapsedMs = 0) => {
    const elapsedValue = round(Math.max(0, Number(elapsedMs) || 0));
    if (
      state.confirmationAtMs !== null
      && elapsedValue >= Math.max(observationMs, state.confirmationAtMs + postConfirmationMs)
    ) {
      state.status = 'stable';
      state.finalizedAtMs ??= elapsedValue;
    }

    return {
      ...state,
      stableFramesRequired: requiredFrames,
      stableAfterFrames: requiredFrames,
      minimumObservationMs: minimumMs,
      observationWindowMs: observationMs,
      postConfirmationObservationMs: postConfirmationMs,
      isStable: state.status === 'stable',
    };
  };

  const observe = (
    snapshot,
    { elapsedMs = 0, isFrame = false, meaningful } = {},
  ) => {
    const elapsedValue = round(Math.max(0, Number(elapsedMs) || 0));
    const current = normalizeGeometrySnapshot(snapshot);
    const comparison = previous === null
      ? emptyComparison
      : compareGeometrySnapshots(previous, current);
    previous = current;

    let observedMeaningful = false;
    let confirmedNow = false;
    if (comparison.changed) {
      observedMeaningful = meaningful === undefined
        ? comparison.meaningful
        : Boolean(meaningful);
      state.firstGeometryChangeAtMs ??= elapsedValue;
      state.lastGeometryChangeAtMs = elapsedValue;
      if (observedMeaningful) {
        state.firstMeaningfulGeometryChangeAtMs ??= elapsedValue;
        state.lastMeaningfulGeometryChangeAtMs = elapsedValue;
      }
      // Un cambio posterior invalida incluso una confirmación ya emitida.
      state.stableFrameCount = 0;
      state.confirmationAtMs = null;
      state.stableAtMs = null;
      state.unstableWindowMs = null;
      state.finalizedAtMs = null;
      state.stableFramesAtConfirmation = null;
      state.status = 'observing';
    } else if (isFrame && elapsedValue >= minimumMs) {
      state.stableFrameCount += 1;
      if (
        state.stableFrameCount >= requiredFrames
        && state.confirmationAtMs === null
      ) {
        state.stableAtMs = state.lastMeaningfulGeometryChangeAtMs ?? 0;
        state.unstableWindowMs = state.stableAtMs;
        state.confirmationAtMs = elapsedValue;
        state.firstConfirmationAtMs ??= elapsedValue;
        state.stableFramesAtConfirmation = state.stableFrameCount;
        state.confirmationCount += 1;
        state.status = elapsedValue >= Math.max(observationMs, elapsedValue + postConfirmationMs)
          ? 'stable'
          : 'confirmed';
        confirmedNow = true;
      }
    }

    return {
      comparison,
      changed: comparison.changed,
      meaningful: observedMeaningful,
      confirmedNow,
      ...getState(elapsedValue),
    };
  };

  return { observe, getState };
}

export function createGeometryChangeSummary(
  snapshot,
  { elapsedMs = 0, reason = 'unknown', comparison = emptyComparison, meaningful = false } = {},
) {
  const geometry = normalizeGeometrySnapshot(snapshot);
  return {
    elapsedMs: round(Math.max(0, Number(elapsedMs) || 0)),
    reason,
    meaningful: Boolean(meaningful),
    changedFields: comparison.changedFields || [],
    viewportChanged: Boolean(comparison.viewportChanged),
    visualViewportChanged: Boolean(comparison.visualViewportChanged),
    safeAreaChanged: Boolean(comparison.safeAreaChanged),
    htmlBodyChanged: Boolean(comparison.htmlBodyChanged),
    rootChanged: Boolean(comparison.rootChanged),
    surfaceChanged: Boolean(comparison.surfaceChanged),
    innerWidth: geometry.innerWidth,
    innerHeight: geometry.innerHeight,
    documentElementClientWidth: geometry.documentElementClientWidth,
    documentElementClientHeight: geometry.documentElementClientHeight,
    visualViewportWidth: geometry.visualViewport?.width ?? null,
    visualViewportHeight: geometry.visualViewport?.height ?? null,
    visualViewportOffsetTop: geometry.visualViewport?.offsetTop ?? null,
    visualViewportOffsetLeft: geometry.visualViewport?.offsetLeft ?? null,
    safeTop: geometry.safeArea.safeTop,
    safeBottom: geometry.safeArea.safeBottom,
    safeLeft: geometry.safeArea.safeLeft,
    safeRight: geometry.safeArea.safeRight,
    visualViewport: geometry.visualViewport,
    safeArea: geometry.safeArea,
    htmlRect: geometry.htmlRect,
    bodyRect: geometry.bodyRect,
    rootRect: geometry.rootRect,
    loginSurfaceRect: geometry.loginSurfaceRect,
  };
}

const readPixelValue = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? round(parsed) : null;
};

const readRect = (element) => {
  if (!element?.getBoundingClientRect) return null;
  const rect = element.getBoundingClientRect();
  return {
    x: round(rect.x),
    y: round(rect.y),
    top: round(rect.top),
    right: round(rect.right),
    bottom: round(rect.bottom),
    left: round(rect.left),
    width: round(rect.width),
    height: round(rect.height),
  };
};

const readContentRect = (rect) => {
  if (!rect) return null;
  return {
    x: round(rect.x),
    y: round(rect.y),
    top: round(rect.top),
    right: round(rect.right),
    bottom: round(rect.bottom),
    left: round(rect.left),
    width: round(rect.width),
    height: round(rect.height),
  };
};

const readStandalone = (windowLike) => {
  const navigatorStandalone = typeof windowLike.navigator?.standalone === 'boolean'
    ? windowLike.navigator.standalone
    : null;
  let displayModeStandalone = null;
  try {
    displayModeStandalone = Boolean(windowLike.matchMedia?.('(display-mode: standalone)').matches);
  } catch {
    displayModeStandalone = null;
  }
  return { navigatorStandalone, displayModeStandalone };
};

const readImageRect = (image) => {
  if (!image?.getBoundingClientRect) return null;
  return readRect(image);
};

const findPublicHomeImage = (documentLike) => documentLike
  ?.querySelector?.('section[aria-label="Descubre Under Flashcards"] img') || null;

const getPerformanceNow = (windowLike) => {
  const performanceNow = windowLike.performance?.now?.();
  return Number.isFinite(Number(performanceNow)) ? Number(performanceNow) : Date.now();
};

const scheduleMicrotask = (windowLike, callback) => {
  if (typeof windowLike.queueMicrotask === 'function') {
    windowLike.queueMicrotask(callback);
    return;
  }
  Promise.resolve().then(callback);
};

const requestFrame = (windowLike, callback) => {
  if (typeof windowLike.requestAnimationFrame === 'function') {
    return { type: 'raf', id: windowLike.requestAnimationFrame(callback) };
  }
  return {
    type: 'timeout',
    id: windowLike.setTimeout(() => callback(getPerformanceNow(windowLike)), 16),
  };
};

const cancelFrame = (windowLike, handle) => {
  if (!handle) return;
  if (handle.type === 'raf') windowLike.cancelAnimationFrame?.(handle.id);
  else windowLike.clearTimeout?.(handle.id);
};

const pushLimited = (list, value, limit = MAX_HISTORY_ENTRIES) => {
  list.push(value);
  if (list.length > limit) list.splice(0, list.length - limit);
};

const createRunId = () => {
  const now = new Date();
  const pad = (value, size = 2) => String(value).padStart(size, '0');
  const stamp = [
    now.getUTCFullYear(),
    pad(now.getUTCMonth() + 1),
    pad(now.getUTCDate()),
  ].join('');
  const time = [
    pad(now.getUTCHours()),
    pad(now.getUTCMinutes()),
    pad(now.getUTCSeconds()),
  ].join('');
  const suffix = Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
  return `${stamp}-${time}-${suffix}`;
};

function createViewportDebug(windowLike, { startReason = 'initial-load' } = {}) {
  const documentLike = windowLike.document;
  const state = {
    enabled: true,
    version: 2,
    runId: null,
    startedAt: null,
    startedAtPerformance: null,
    startReason: null,
    runToken: 0,
    runActive: false,
    history: [],
    samples: [],
    events: [],
    firstResize: null,
    latest: null,
    mountMarks: 0,
    imageRecords: new WeakMap(),
    imageCleanups: [],
    observedResizeTargets: new WeakMap(),
    cleanup: [],
    timers: [],
    frameHandle: null,
    panel: null,
    panelReadout: null,
    panelHistory: null,
    safeAreaProbe: null,
    viewportUnitsProbe: null,
    resizeObserver: null,
    domObserver: null,
    bodyStyleObserver: null,
    lifecycle: {
      wasHidden: false,
      pageHidden: false,
    },
    eventTimings: {
      firstEventAtMs: null,
      firstGeometryEventAtMs: null,
    },
    geometry: {
      initialSnapshot: null,
      lastSnapshot: null,
      lastChangeSnapshot: null,
      mountGeometryPending: false,
      firstHtmlBodyChangeAtMs: null,
      firstVisualViewportChangeAtMs: null,
      visualViewportChangedAfterMount: false,
      geometryChangedDuringRun: false,
      viewportChangedDuringRun: false,
      safeAreaChangedDuringRun: false,
    },
    geometryChanges: [],
    stabilityTracker: null,
    reactTiming: {
      mountedAtMs: null,
      mountSource: null,
    },
  };

  const elapsed = () => round(
    Math.max(0, getPerformanceNow(windowLike) - (state.startedAtPerformance || 0)),
  );

  const ensureSafeAreaProbe = () => {
    if (state.safeAreaProbe?.isConnected) return state.safeAreaProbe;

    const probe = documentLike.createElement('div');
    probe.id = SAFE_AREA_PROBE_ID;
    probe.setAttribute('aria-hidden', 'true');
    probe.style.position = 'fixed';
    probe.style.left = '0';
    probe.style.top = '0';
    probe.style.width = '0';
    probe.style.height = '0';
    probe.style.visibility = 'hidden';
    probe.style.pointerEvents = 'none';
    probe.style.overflow = 'hidden';
    probe.style.paddingTop = 'env(safe-area-inset-top, 0px)';
    probe.style.paddingBottom = 'env(safe-area-inset-bottom, 0px)';
    probe.style.paddingLeft = 'env(safe-area-inset-left, 0px)';
    probe.style.paddingRight = 'env(safe-area-inset-right, 0px)';
    (documentLike.body || documentLike.documentElement).appendChild(probe);
    state.safeAreaProbe = probe;
    return probe;
  };

  const readSafeArea = () => {
    const probe = ensureSafeAreaProbe();
    const styles = windowLike.getComputedStyle(probe);
    return {
      safeTop: readPixelValue(styles.paddingTop),
      safeBottom: readPixelValue(styles.paddingBottom),
      safeLeft: readPixelValue(styles.paddingLeft),
      safeRight: readPixelValue(styles.paddingRight),
    };
  };

  const ensureViewportUnitsProbe = () => {
    if (state.viewportUnitsProbe?.isConnected) return state.viewportUnitsProbe;

    const probe = documentLike.createElement('div');
    probe.id = VIEWPORT_UNITS_PROBE_ID;
    probe.setAttribute('aria-hidden', 'true');
    probe.style.position = 'fixed';
    probe.style.left = '0';
    probe.style.top = '0';
    probe.style.width = '0';
    probe.style.visibility = 'hidden';
    probe.style.pointerEvents = 'none';
    probe.style.overflow = 'hidden';
    (documentLike.body || documentLike.documentElement).appendChild(probe);
    state.viewportUnitsProbe = probe;
    return probe;
  };

  const readViewportUnits = () => {
    const probe = ensureViewportUnitsProbe();
    const units = {};
    [
      ['vh', '100vh'],
      ['dvh', '100dvh'],
      ['svh', '100svh'],
      ['lvh', '100lvh'],
      ['fillAvailable', '-webkit-fill-available'],
    ].forEach(([name, value]) => {
      probe.style.height = value;
      const rectHeight = Number(probe.getBoundingClientRect?.().height);
      const computedHeight = windowLike.getComputedStyle(probe).height;
      units[name] = {
        rectHeight: Number.isFinite(rectHeight) ? round(rectHeight) : null,
        computedHeight,
      };
    });
    probe.style.height = '0px';
    return units;
  };

  const readImageState = () => {
    const image = findPublicHomeImage(documentLike);
    if (!image) return null;
    const record = state.imageRecords.get(image);
    return {
      present: true,
      complete: Boolean(image.complete),
      naturalWidth: Number.isFinite(Number(image.naturalWidth)) ? Number(image.naturalWidth) : null,
      naturalHeight: Number.isFinite(Number(image.naturalHeight)) ? Number(image.naturalHeight) : null,
      decodeSupported: typeof image.decode === 'function',
      decodeState: record?.decodeState || 'not-started',
      loadedAtMs: record?.loadedAtMs ?? null,
      errorAtMs: record?.errorAtMs ?? null,
      decodeStartedAtMs: record?.decodeStartedAtMs ?? null,
      decodeFinishedAtMs: record?.decodeFinishedAtMs ?? null,
      rect: readImageRect(image),
    };
  };

  const readGeometrySnapshot = () => {
    const html = documentLike.documentElement;
    const body = documentLike.body;
    const root = documentLike.getElementById('root');
    const visualViewport = windowLike.visualViewport;
    const safeArea = readSafeArea();

    return {
      innerWidth: round(windowLike.innerWidth),
      innerHeight: round(windowLike.innerHeight),
      documentElementClientWidth: round(html?.clientWidth),
      documentElementClientHeight: round(html?.clientHeight),
      htmlRect: readRect(html),
      bodyRect: readRect(body),
      rootRect: readRect(root),
      loginSurfaceRect: readRect(documentLike.querySelector?.('#root main')),
      visualViewport: visualViewport
        ? {
            width: round(visualViewport.width),
            height: round(visualViewport.height),
            offsetTop: round(visualViewport.offsetTop),
            offsetLeft: round(visualViewport.offsetLeft),
            scale: round(visualViewport.scale),
          }
        : null,
      safeTop: safeArea.safeTop,
      safeBottom: safeArea.safeBottom,
      safeArea,
    };
  };

  const readSnapshot = () => {
    const html = documentLike.documentElement;
    const body = documentLike.body;
    const standalone = readStandalone(windowLike);
    const geometry = readGeometrySnapshot();
    const htmlStyles = html ? windowLike.getComputedStyle(html) : null;
    const bodyStyles = body ? windowLike.getComputedStyle(body) : null;
    const viewportMetas = [...(documentLike.head?.querySelectorAll?.('meta[name="viewport"]') || [])];

    return {
      ...geometry,
      screen: {
        width: round(windowLike.screen?.width),
        height: round(windowLike.screen?.height),
      },
      devicePixelRatio: round(windowLike.devicePixelRatio),
      navigatorStandalone: standalone.navigatorStandalone,
      displayModeStandalone: standalone.displayModeStandalone,
      visibilityState: documentLike.visibilityState,
      computed: {
        htmlHeight: htmlStyles?.height || null,
        bodyHeight: bodyStyles?.height || null,
        bodyPaddingTop: bodyStyles?.paddingTop || null,
        bodyPaddingBottom: bodyStyles?.paddingBottom || null,
        bodyOverflow: bodyStyles?.overflow || null,
        bodyMinHeight: bodyStyles?.minHeight || null,
        bodyPosition: bodyStyles?.position || null,
      },
      bodyInline: body
        ? {
            paddingTop: body.style.paddingTop,
            paddingBottom: body.style.paddingBottom,
            overflow: body.style.overflow,
            overscrollBehavior: body.style.overscrollBehavior,
          }
        : null,
      scroll: {
        bodyScrollHeight: body?.scrollHeight ?? null,
        bodyClientHeight: body?.clientHeight ?? null,
        bodyScrollTop: body?.scrollTop ?? null,
        htmlScrollHeight: html?.scrollHeight ?? null,
        htmlClientHeight: html?.clientHeight ?? null,
        htmlScrollTop: html?.scrollTop ?? null,
      },
      viewportUnits: readViewportUnits(),
      viewportMeta: {
        count: viewportMetas.length,
        contents: viewportMetas.map((meta) => meta.getAttribute('content')),
      },
      image: readImageState(),
    };
  };

  const formatEventLine = (entry) => {
    const visualHeight = entry.visualViewport?.height;
    const image = entry.image;
    const imageState = image
      ? ` img=${image.complete ? 'complete' : 'pending'}/${image.naturalWidth || 0}px/${image.decodeState}`
      : '';
    const eventOrLabel = entry.kind === 'event' ? `EVENT ${entry.event}` : entry.label;
    return `[+${entry.elapsedMs}ms] ${eventOrLabel} ih=${entry.innerHeight ?? '—'} vv=${visualHeight ?? '—'} safe=${entry.safeTop ?? '—'}/${entry.safeBottom ?? '—'} vis=${entry.visibilityState ?? '—'}${imageState}`;
  };

  const isGeometryEvent = (label) => typeof label === 'string' && (
    label === 'resize'
    || label === 'orientationchange'
    || label === 'visualViewport.resize'
    || label === 'visualViewport.scroll'
    || label === 'body.style'
    || label.startsWith('ResizeObserver:')
  );

  const geometryReason = (label, { mountOnly = false } = {}) => {
    if (typeof label !== 'string') return 'unknown';
    if (mountOnly) return 'react-mount';
    if (label === 'resize') return 'window.resize';
    if (label === 'visualViewport.resize') return 'visualViewport.resize';
    if (label === 'visualViewport.scroll') return 'visualViewport.scroll';
    if (label === 'orientationchange') return 'orientationchange';
    if (label === 'body.style') return 'body.style';
    if (label.startsWith('ResizeObserver:')) {
      const target = label.slice('ResizeObserver:'.length);
      return target === 'html' || target === 'body' ? 'html-body-resize' : `${target}-resize`;
    }
    if (label === 'requestAnimationFrame') return 'requestAnimationFrame';
    return label;
  };

  const getStability = () => state.stabilityTracker?.getState(elapsed()) || {
    status: 'observing',
    isStable: false,
    stableFramesRequired: STABLE_FRAMES_REQUIRED,
    stableAfterFrames: STABLE_FRAMES_REQUIRED,
    minimumObservationMs: MIN_INITIAL_OBSERVATION_MS,
    observationWindowMs: STABILITY_OBSERVATION_WINDOW_MS,
    postConfirmationObservationMs: POST_CONFIRMATION_OBSERVATION_MS,
    firstGeometryChangeAtMs: null,
    firstMeaningfulGeometryChangeAtMs: null,
    lastGeometryChangeAtMs: null,
    lastMeaningfulGeometryChangeAtMs: null,
    stableAtMs: null,
    unstableWindowMs: null,
    confirmationAtMs: null,
    firstConfirmationAtMs: null,
    finalizedAtMs: null,
    stableFrameCount: 0,
    stableFramesAtConfirmation: null,
    confirmationCount: 0,
  };

  const observeGeometry = (
    snapshot,
    { elapsedMs = elapsed(), reason = 'unknown', isFrame = false } = {},
  ) => {
    const geometry = normalizeGeometrySnapshot(snapshot);
    if (state.geometry.initialSnapshot === null) {
      state.geometry.initialSnapshot = geometry;
      state.geometry.lastSnapshot = geometry;
      state.geometry.lastChangeSnapshot = geometry;
      state.stabilityTracker = createStabilityTracker({
        initialSnapshot: geometry,
        stableFramesRequired: STABLE_FRAMES_REQUIRED,
        minimumObservationMs: MIN_INITIAL_OBSERVATION_MS,
        observationWindowMs: STABILITY_OBSERVATION_WINDOW_MS,
      });
      pushLimited(
        state.geometryChanges,
        createGeometryChangeSummary(geometry, { elapsedMs: 0, reason: 'initial' }),
        MAX_GEOMETRY_CHANGES,
      );
      return { comparison: emptyComparison, changed: false, meaningful: false };
    }

    const comparison = compareGeometrySnapshots(state.geometry.lastSnapshot, geometry);
    const reactMountedInDom = Boolean(
      documentLike.getElementById?.('root')?.children?.length,
    );
    const mountOnly = comparison.changed
      && state.geometry.mountGeometryPending
      && (state.reactTiming.mountedAtMs !== null || reactMountedInDom)
      && !comparison.viewportChanged
      && !comparison.safeAreaChanged
      && !comparison.htmlBodyChanged
      && (comparison.rootChanged || comparison.surfaceChanged);
    const meaningful = comparison.changed && !mountOnly;
    // El montaje puede crear la superficie por primera vez sin cambiar el
    // viewport. Se conserva como cambio de layout, pero no se cuenta como una
    // apertura inestable; cualquier cambio posterior del root sí cuenta.
    const trackerResult = state.stabilityTracker.observe(geometry, {
      elapsedMs,
      isFrame,
      meaningful,
    });

    state.geometry.lastSnapshot = geometry;
    if (!comparison.changed) return trackerResult;

    state.geometry.geometryChangedDuringRun = true;
    state.geometry.viewportChangedDuringRun ||= comparison.viewportChanged;
    state.geometry.safeAreaChangedDuringRun ||= comparison.safeAreaChanged;
    if (comparison.htmlBodyChanged) {
      state.geometry.firstHtmlBodyChangeAtMs ??= round(elapsedMs);
    }
    if (comparison.visualViewportChanged) {
      state.geometry.firstVisualViewportChangeAtMs ??= round(elapsedMs);
      if (
        state.reactTiming.mountedAtMs !== null
        && elapsedMs > state.reactTiming.mountedAtMs
      ) {
        state.geometry.visualViewportChangedAfterMount = true;
      }
    }
    const lastChangeSnapshot = state.geometry.lastChangeSnapshot;
    if (
      !lastChangeSnapshot
      || !areGeometrySnapshotsEquivalent(lastChangeSnapshot, geometry)
    ) {
      pushLimited(
        state.geometryChanges,
        createGeometryChangeSummary(geometry, {
          elapsedMs,
          reason: geometryReason(reason, { mountOnly }),
          comparison,
          meaningful,
        }),
        MAX_GEOMETRY_CHANGES,
      );
      state.geometry.lastChangeSnapshot = geometry;
    }

    return trackerResult;
  };

  const updatePanel = () => {
    if (!state.panel || !state.panelReadout || !state.panelHistory) return;
    const latest = state.latest;
    if (!latest) return;
    const firstResize = state.firstResize
      ? `${state.firstResize.event} @ +${state.firstResize.elapsedMs}ms`
      : 'pendiente';
    const vv = latest.visualViewport;
    const units = latest.viewportUnits || {};
    const image = latest.image;
    const stability = getStability();
    state.panelReadout.textContent = [
      `run: ${state.runId} (${state.startReason})`,
      `innerHeight: ${latest.innerHeight ?? '—'} | clientHeight: ${latest.documentElementClientHeight ?? '—'}`,
      `visualViewport.height: ${vv?.height ?? '—'} | offset: ${vv?.offsetTop ?? '—'},${vv?.offsetLeft ?? '—'}`,
      `safeTop/bottom: ${latest.safeTop ?? '—'} / ${latest.safeBottom ?? '—'}`,
      `body height: ${latest.computed?.bodyHeight ?? '—'} | root rect: ${latest.rootRect?.height ?? '—'}`,
      `100vh/dvh: ${units.vh?.rectHeight ?? '—'} / ${units.dvh?.rectHeight ?? '—'}`,
      `standalone: nav=${latest.navigatorStandalone ?? '—'} mm=${latest.displayModeStandalone ?? '—'} | visibility: ${latest.visibilityState ?? '—'}`,
      `body: overflow=${latest.computed?.bodyOverflow ?? '—'} padding=${latest.computed?.bodyPaddingTop ?? '—'}/${latest.computed?.bodyPaddingBottom ?? '—'}`,
      `primer resize (legacy, no estabilidad): ${firstResize}`,
      `estabilidad: ${stability.status} unstable=${stability.unstableWindowMs ?? '—'}ms confirm=${stability.confirmationAtMs ?? '—'}ms`,
      `imagen: ${image ? `${image.complete ? 'complete' : 'pending'} natural=${image.naturalWidth ?? 0} decode=${image.decodeState}` : 'no encontrada'}`,
      `último: ${formatEventLine(latest)}`,
    ].join('\n');

    state.panelHistory.replaceChildren(...state.history.slice(-PANEL_HISTORY_ENTRIES).map((entry) => {
      const line = documentLike.createElement('div');
      line.textContent = formatEventLine(entry);
      return line;
    }));
  };

  const appendEntry = (kind, label, details = {}, snapshotOverride = null) => {
    if (!state.runActive) return null;
    const entry = {
      timestamp: new Date().toISOString(),
      elapsedMs: elapsed(),
      kind,
      ...(kind === 'sample' ? { label } : { event: label }),
      ...(snapshotOverride || readSnapshot()),
      ...details,
    };
    state.latest = entry;
    pushLimited(state.history, entry);
    if (kind === 'sample') pushLimited(state.samples, entry);
    if (kind === 'event') {
      pushLimited(state.events, entry);
      state.eventTimings.firstEventAtMs ??= entry.elapsedMs;
      if (isGeometryEvent(label)) state.eventTimings.firstGeometryEventAtMs ??= entry.elapsedMs;
      if (
        !state.firstResize
        && (label === 'resize' || label === 'visualViewport.resize')
      ) {
        state.firstResize = { event: label, elapsedMs: entry.elapsedMs };
      }
    }
    observeGeometry(entry, {
      elapsedMs: entry.elapsedMs,
      reason: label,
      isFrame: details.isFrame === true,
    });
    updatePanel();
    return entry;
  };

  const capture = (label, details = {}, snapshotOverride = null) => (
    appendEntry('sample', label, details, snapshotOverride)
  );

  const recordEvent = (event, details = {}) => appendEntry('event', event, details);

  const trackPublicHomeImage = () => {
    const image = findPublicHomeImage(documentLike);
    if (!image || state.imageRecords.has(image)) return;
    const runToken = state.runToken;

    const record = {
      runToken,
      decodeState: 'not-started',
      loadedAtMs: null,
      errorAtMs: null,
      decodeStartedAtMs: null,
      decodeFinishedAtMs: null,
    };
    state.imageRecords.set(image, record);

    const beginDecodeCheck = () => {
      if (runToken !== state.runToken || !state.runActive) return;
      if (record.decodeState !== 'not-started' && record.decodeState !== 'loaded') return;
      if (typeof image.decode !== 'function') return;

      record.decodeState = 'pending';
      record.decodeStartedAtMs = elapsed();
      capture('image.decode-start', { imageEvent: 'decode-start' });
      let decodePromise;
      try {
        decodePromise = image.decode();
      } catch {
        record.decodeState = 'decode-throw';
        record.decodeFinishedAtMs = elapsed();
        recordEvent('image.decode-throw', { imageEvent: 'decode-throw' });
        return;
      }
      Promise.resolve(decodePromise).then(
        () => {
          if (runToken !== state.runToken || !state.runActive) return;
          record.decodeState = 'decoded';
          record.decodeFinishedAtMs = elapsed();
          recordEvent('image.decode-resolved', { imageEvent: 'decode-resolved' });
        },
        () => {
          if (runToken !== state.runToken || !state.runActive) return;
          record.decodeState = 'decode-rejected';
          record.decodeFinishedAtMs = elapsed();
          recordEvent('image.decode-rejected', { imageEvent: 'decode-rejected' });
        },
      );
    };

    const onLoad = () => {
      if (runToken !== state.runToken || !state.runActive) return;
      record.decodeState = 'loaded';
      record.loadedAtMs = elapsed();
      recordEvent('image.load', { imageEvent: 'load' });
      beginDecodeCheck();
    };
    const onError = () => {
      if (runToken !== state.runToken || !state.runActive) return;
      record.decodeState = 'error';
      record.errorAtMs = elapsed();
      recordEvent('image.error', { imageEvent: 'error' });
    };
    image.addEventListener('load', onLoad, { once: true });
    image.addEventListener('error', onError, { once: true });
    state.imageCleanups.push(() => {
      image.removeEventListener('load', onLoad);
      image.removeEventListener('error', onError);
    });

    if (image.complete) beginDecodeCheck();
  };

  const attachResizeTargets = () => {
    if (!state.resizeObserver) return;
    const targets = [
      [documentLike.documentElement, 'html'],
      [documentLike.body, 'body'],
      [documentLike.getElementById('root'), 'root'],
      [documentLike.querySelector?.('#root main'), 'main'],
    ];
    targets.forEach(([target, name]) => {
      if (!target || state.observedResizeTargets.has(target)) return;
      state.observedResizeTargets.set(target, name);
      state.resizeObserver.observe(target);
    });
  };

  const cleanupImageTracking = () => {
    state.imageCleanups.splice(0).forEach((callback) => callback());
    state.imageRecords = new WeakMap();
  };

  const cancelMeasurementTasks = () => {
    state.timers.splice(0).forEach((timerId) => windowLike.clearTimeout?.(timerId));
    cancelFrame(windowLike, state.frameHandle);
    state.frameHandle = null;
  };

  const cleanup = () => {
    state.runActive = false;
    state.runToken += 1;
    cancelMeasurementTasks();
    cleanupImageTracking();
    state.cleanup.splice(0).forEach((callback) => callback());
    state.safeAreaProbe?.remove();
    state.viewportUnitsProbe?.remove();
    state.panel?.remove();
    state.panel = null;
    state.panelReadout = null;
    state.panelHistory = null;
  };

  const formatDimension = (value) => {
    const normalized = normalizeNumber(value);
    return normalized === null ? null : String(round(normalized));
  };

  const formatViewport = (geometry) => {
    if (!geometry) return null;
    const width = geometry.innerWidth ?? geometry.visualViewport?.width;
    const height = geometry.innerHeight ?? geometry.visualViewport?.height;
    const formattedWidth = formatDimension(width);
    const formattedHeight = formatDimension(height);
    return formattedWidth === null || formattedHeight === null
      ? null
      : `${formattedWidth}x${formattedHeight}`;
  };

  const readPaintTimings = () => {
    const getEntriesByType = windowLike.performance?.getEntriesByType;
    if (typeof getEntriesByType !== 'function') return { supported: false };

    let entries;
    try {
      entries = Array.from(getEntriesByType.call(windowLike.performance, 'paint') || []);
    } catch {
      return { supported: false };
    }

    const readPaint = (name) => {
      const entry = entries.find((candidate) => candidate?.name === name);
      if (!entry || !Number.isFinite(Number(entry.startTime))) return null;
      const relativeTime = Number(entry.startTime) - Number(state.startedAtPerformance);
      return relativeTime >= 0 ? round(relativeTime) : null;
    };

    return {
      supported: entries.length > 0,
      firstPaintMs: readPaint('first-paint'),
      firstContentfulPaintMs: readPaint('first-contentful-paint'),
      source: 'performance.getEntriesByType("paint")',
    };
  };

  const buildReactTiming = () => {
    const stability = getStability();
    const mountedAtMs = state.reactTiming.mountedAtMs;
    const stableAtMs = stability.stableAtMs;
    const hasMount = mountedAtMs !== null;
    const hasStableTime = stability.isStable && stableAtMs !== null;
    const stabilizedAfterMount = Boolean(
      hasMount
      && hasStableTime
      && stableAtMs > mountedAtMs,
    );

    return {
      mountedAtMs,
      mountSource: state.reactTiming.mountSource,
      mountMarks: state.mountMarks,
      viewportStableBeforeMount: Boolean(
        hasMount
        && hasStableTime
        && stableAtMs <= mountedAtMs,
      ),
      stabilizedAfterMount,
      stabilizedAfterMountByMs: stabilizedAfterMount
        ? round(stableAtMs - mountedAtMs)
        : hasStableTime && hasMount
          ? 0
          : null,
    };
  };

  const buildSummary = () => {
    const initialGeometry = state.geometry.initialSnapshot;
    const finalGeometry = state.geometry.lastSnapshot || initialGeometry;
    const initialFinalComparison = initialGeometry && finalGeometry
      ? compareGeometrySnapshots(initialGeometry, finalGeometry)
      : emptyComparison;
    const stability = getStability();
    const reactTiming = buildReactTiming();
    let classification = 'unknown';

    if (stability.isStable) {
      if (stability.firstMeaningfulGeometryChangeAtMs === null) {
        classification = 'stable-from-start';
      } else if (stability.firstMeaningfulGeometryChangeAtMs <= MIN_INITIAL_OBSERVATION_MS) {
        classification = 'unstable-start';
      } else {
        classification = 'late-geometry-change';
      }
    }

    return {
      initialViewport: formatViewport(initialGeometry),
      finalViewport: formatViewport(finalGeometry),
      viewportChanged: initialFinalComparison.viewportChanged,
      safeAreaChanged: initialFinalComparison.safeAreaChanged,
      geometryChanged: state.geometry.geometryChangedDuringRun,
      viewportChangedDuringRun: state.geometry.viewportChangedDuringRun,
      safeAreaChangedDuringRun: state.geometry.safeAreaChangedDuringRun,
      unstableWindowMs: stability.unstableWindowMs,
      stableAtMs: stability.stableAtMs,
      confirmationAtMs: stability.confirmationAtMs,
      stabilityStatus: stability.status,
      classification,
      reactTiming,
    };
  };

  const buildDiagnostics = (summary) => ({
    initialViewportDifferentFromFinal: Boolean(summary.viewportChanged),
    initialSafeAreaDifferentFromFinal: Boolean(summary.safeAreaChanged),
    htmlBodyChangedBeforeVisualViewport: Boolean(
      state.geometry.firstHtmlBodyChangeAtMs !== null
      && (
        state.geometry.firstVisualViewportChangeAtMs === null
        || state.geometry.firstHtmlBodyChangeAtMs < state.geometry.firstVisualViewportChangeAtMs
      ),
    ),
    visualViewportChangedAfterMount: state.geometry.visualViewportChangedAfterMount,
    geometryChangedDuringRun: state.geometry.geometryChangedDuringRun,
    firstHtmlBodyChangeAtMs: state.geometry.firstHtmlBodyChangeAtMs,
    firstVisualViewportChangeAtMs: state.geometry.firstVisualViewportChangeAtMs,
  });

  const toJSON = () => {
    const stability = getStability();
    const summary = buildSummary();
    return {
      enabled: state.enabled,
      version: state.version,
      runId: state.runId,
      startedAt: state.startedAt,
      startReason: state.startReason,
      firstResize: state.firstResize,
      stability: {
        ...stability,
        firstEventAtMs: state.eventTimings.firstEventAtMs,
        firstGeometryEventAtMs: state.eventTimings.firstGeometryEventAtMs,
      },
      geometryChanges: state.geometryChanges,
      summary,
      diagnostics: buildDiagnostics(summary),
      reactTiming: summary.reactTiming,
      paint: readPaintTimings(),
      samples: state.samples,
      events: state.events,
      history: state.history,
    };
  };

  const runStartLabel = (reason) => ({
    'initial-load': 'T0-before-react-mount',
    'debug-gesture': 'T0-debug-gesture',
    'visibilitychange-visible': 'T0-after-visibilitychange',
    'pageshow-bfcache': 'T0-after-pageshow-bfcache',
    'pageshow-after-pagehide': 'T0-after-pageshow',
  }[reason] || `T0-${reason}`);

  const scheduleRunMeasurements = () => {
    const runToken = state.runToken;
    let frameNumber = 0;

    const scheduleNextFrame = () => {
      if (!state.runActive || runToken !== state.runToken) return;
      state.frameHandle = requestFrame(windowLike, (rafTimestamp) => {
        if (!state.runActive || runToken !== state.runToken) return;
        frameNumber += 1;
        const frameElapsed = elapsed();

        if (frameElapsed <= HIGH_RESOLUTION_SAMPLE_WINDOW_MS) {
          const label = frameNumber === 1
            ? 'T2-requestAnimationFrame-1'
            : frameNumber === 2
              ? 'T3-requestAnimationFrame-2'
              : `RAF-${frameNumber}`;
          const highResolutionSnapshot = frameNumber <= 2
            ? readSnapshot()
            : readGeometrySnapshot();
          capture(
            label,
            {
              samplePhase: 'high-resolution',
              snapshotDetail: frameNumber <= 2 ? 'full' : 'geometry-only',
              frameNumber,
              isFrame: true,
              rafTimestamp: round(rafTimestamp),
            },
            highResolutionSnapshot,
          );
        } else {
          const result = observeGeometry(readGeometrySnapshot(), {
            elapsedMs: frameElapsed,
            reason: 'requestAnimationFrame',
            isFrame: true,
          });
          if (result.changed || result.confirmedNow) updatePanel();
        }

        if (frameElapsed < STABILITY_MONITOR_END_MS) {
          scheduleNextFrame();
        } else {
          state.frameHandle = null;
          updatePanel();
        }
      });
    };

    scheduleNextFrame();

    [
      [100, 'T4-100ms'],
      [500, 'T5-500ms'],
      [1000, 'T6-1000ms'],
    ].forEach(([delay, label]) => {
      const timerId = windowLike.setTimeout(() => {
        if (!state.runActive || runToken !== state.runToken) return;
        capture(label, { samplePhase: 'scheduled' });
      }, delay);
      state.timers.push(timerId);
    });
  };

  const startRun = (reason = 'initial-load') => {
    state.runToken += 1;
    cancelMeasurementTasks();
    cleanupImageTracking();

    state.runId = createRunId();
    state.startedAt = new Date().toISOString();
    state.startedAtPerformance = getPerformanceNow(windowLike);
    state.startReason = reason;
    state.runActive = true;
    state.history = [];
    state.samples = [];
    state.events = [];
    state.firstResize = null;
    state.latest = null;
    state.mountMarks = 0;
    state.eventTimings = {
      firstEventAtMs: null,
      firstGeometryEventAtMs: null,
    };
    state.geometry = {
      initialSnapshot: null,
      lastSnapshot: null,
      lastChangeSnapshot: null,
      mountGeometryPending: false,
      firstHtmlBodyChangeAtMs: null,
      firstVisualViewportChangeAtMs: null,
      visualViewportChangedAfterMount: false,
      geometryChangedDuringRun: false,
      viewportChangedDuringRun: false,
      safeAreaChangedDuringRun: false,
    };
    state.geometryChanges = [];
    state.stabilityTracker = null;

    const reactAlreadyMounted = Boolean(
      documentLike.getElementById?.('root')?.children?.length,
    );
    state.reactTiming = {
      mountedAtMs: reactAlreadyMounted ? 0 : null,
      mountSource: reactAlreadyMounted ? 'existing-document' : null,
    };
    state.geometry.mountGeometryPending = !reactAlreadyMounted;

    // La primera muestra de cada run es un nuevo T0; no se mezclan arrays ni
    // marcas temporales del arranque anterior o de una restauración BFCache.
    capture(runStartLabel(reason), { runStartReason: reason, isRunStart: true });
    if (reactAlreadyMounted) {
      capture('T1-react-already-mounted', {
        mountMark: 0,
        mountSource: 'existing-document',
      });
    }
    trackPublicHomeImage();
    scheduleRunMeasurements();
  };

  const copy = async () => {
    const text = JSON.stringify(toJSON(), null, 2);
    const writeText = windowLike.navigator?.clipboard?.writeText;
    try {
      if (typeof writeText === 'function') {
        await writeText.call(windowLike.navigator.clipboard, text);
        return true;
      }
    } catch {
      // Continuar con el fallback de selección manual.
    }

    const textarea = documentLike.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    documentLike.body?.appendChild(textarea);
    textarea.select();
    let copied = false;
    try {
      copied = Boolean(documentLike.execCommand?.('copy'));
    } catch {
      copied = false;
    }
    textarea.remove();
    return copied;
  };

  const api = {
    enabled: true,
    version: state.version,
    get runId() { return state.runId; },
    get startedAt() { return state.startedAt; },
    get startReason() { return state.startReason; },
    get latest() { return state.latest; },
    get history() { return state.history; },
    get samples() { return state.samples; },
    get events() { return state.events; },
    get firstResize() { return state.firstResize; },
    get stability() { return getStability(); },
    get geometryChanges() { return state.geometryChanges; },
    capture,
    recordEvent,
    markMounted: () => {
      if (!state.runActive) return;
      state.mountMarks += 1;
      const markNumber = state.mountMarks;
      const label = markNumber === 1
        ? 'T1-after-react-mount'
        : `T1-after-react-mount-strictmode-${markNumber}`;
      const runToken = state.runToken;
      scheduleMicrotask(windowLike, () => {
        if (!state.runActive || runToken !== state.runToken) return;
        state.reactTiming.mountedAtMs ??= elapsed();
        state.reactTiming.mountSource ??= 'react-mark';
        capture(label, { mountMark: markNumber });
        state.geometry.mountGeometryPending = false;
      });
    },
    toJSON,
    copy,
    stop: () => {
      removeDebugPreference(windowLike);
      cleanup();
      if (windowLike.__viewportDebug === api) delete windowLike.__viewportDebug;
    },
  };

  state.resizeObserver = typeof windowLike.ResizeObserver === 'function'
    ? new windowLike.ResizeObserver((entries) => {
        entries.forEach((entry) => {
          const targetName = state.observedResizeTargets.get(entry.target) || 'unknown';
          recordEvent(`ResizeObserver:${targetName}`, {
            observerTarget: targetName,
            observerRect: readContentRect(entry.contentRect),
          });
        });
      })
    : null;

  const eventTargets = [
    [windowLike, 'resize'],
    [windowLike, 'orientationchange'],
    [windowLike, 'focus'],
    [windowLike, 'blur'],
  ];
  eventTargets.forEach(([target, type]) => {
    const listener = (event) => recordEvent(type, {
      persisted: typeof event?.persisted === 'boolean' ? event.persisted : undefined,
    });
    target.addEventListener(type, listener);
    state.cleanup.push(() => target.removeEventListener(type, listener));
  });

  const onVisibilityChange = () => {
    const visibilityState = documentLike.visibilityState;
    if (visibilityState === 'visible' && state.lifecycle.wasHidden) {
      state.lifecycle.wasHidden = false;
      state.lifecycle.pageHidden = false;
      startRun('visibilitychange-visible');
      return;
    }
    recordEvent('visibilitychange');
    if (visibilityState === 'hidden') state.lifecycle.wasHidden = true;
  };
  documentLike.addEventListener('visibilitychange', onVisibilityChange);
  state.cleanup.push(() => documentLike.removeEventListener('visibilitychange', onVisibilityChange));

  const onPageHide = (event) => {
    recordEvent('pagehide', {
      persisted: typeof event?.persisted === 'boolean' ? event.persisted : undefined,
    });
    state.lifecycle.pageHidden = true;
  };
  windowLike.addEventListener('pagehide', onPageHide);
  state.cleanup.push(() => windowLike.removeEventListener('pagehide', onPageHide));

  const onPageShow = (event) => {
    if (state.lifecycle.pageHidden || event?.persisted === true) {
      const reason = event?.persisted === true
        ? 'pageshow-bfcache'
        : 'pageshow-after-pagehide';
      state.lifecycle.wasHidden = false;
      state.lifecycle.pageHidden = false;
      startRun(reason);
      return;
    }
    recordEvent('pageshow', {
      persisted: typeof event?.persisted === 'boolean' ? event.persisted : undefined,
    });
  };
  windowLike.addEventListener('pageshow', onPageShow);
  state.cleanup.push(() => windowLike.removeEventListener('pageshow', onPageShow));

  const visualViewport = windowLike.visualViewport;
  ['resize', 'scroll'].forEach((type) => {
    if (!visualViewport?.addEventListener) return;
    const listener = () => recordEvent(`visualViewport.${type}`);
    visualViewport.addEventListener(type, listener);
    state.cleanup.push(() => visualViewport.removeEventListener(type, listener));
  });

  if (state.resizeObserver) {
    attachResizeTargets();
    state.cleanup.push(() => state.resizeObserver.disconnect());
  }

  if (typeof windowLike.MutationObserver === 'function') {
    state.domObserver = new windowLike.MutationObserver((mutations) => {
      // El panel se actualiza a sí mismo. No debemos convertir sus propios
      // nodos de historial en una cascada de callbacks del observer.
      const panelMutation = (mutation) => {
        const belongsToPanel = (node) => Boolean(
          state.panel && (node === state.panel || state.panel.contains?.(node)),
        );
        return belongsToPanel(mutation.target)
          || [...mutation.addedNodes, ...mutation.removedNodes].some(belongsToPanel);
      };
      if (mutations.length > 0 && mutations.every(panelMutation)) return;
      attachResizeTargets();
      trackPublicHomeImage();
      updatePanel();
    });
    state.domObserver.observe(documentLike.documentElement, { childList: true, subtree: true });
    state.cleanup.push(() => state.domObserver.disconnect());

    if (documentLike.body) {
      state.bodyStyleObserver = new windowLike.MutationObserver((mutations) => {
        recordEvent('body.style', {
          previousInlineStyle: mutations[0]?.oldValue ?? null,
          currentInlineStyle: documentLike.body?.getAttribute('style') ?? null,
        });
      });
      state.bodyStyleObserver.observe(documentLike.body, {
        attributes: true,
        attributeOldValue: true,
        attributeFilter: ['style'],
      });
      state.cleanup.push(() => state.bodyStyleObserver.disconnect());
    }
  }

  state.cleanup.push(() => {
    state.observedResizeTargets = new WeakMap();
  });

  windowLike.__viewportDebug = api;
  startRun(startReason);

  const panel = documentLike.createElement('aside');
  panel.id = PANEL_ID;
  panel.setAttribute('aria-label', 'Diagnóstico temporal del viewport');
  panel.style.position = 'fixed';
  panel.style.top = 'calc(env(safe-area-inset-top, 0px) + 8px)';
  panel.style.left = '8px';
  panel.style.right = '8px';
  panel.style.zIndex = '2147483647';
  panel.style.maxWidth = '520px';
  panel.style.maxHeight = '48vh';
  panel.style.margin = '0 auto';
  panel.style.padding = '8px';
  panel.style.overflow = 'auto';
  panel.style.boxSizing = 'border-box';
  panel.style.border = '1px solid rgba(255,255,255,0.35)';
  panel.style.borderRadius = '8px';
  panel.style.background = 'rgba(15, 23, 42, 0.94)';
  panel.style.color = '#f8fafc';
  panel.style.font = '10px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace';
  panel.style.whiteSpace = 'pre-wrap';
  panel.style.pointerEvents = 'auto';

  const heading = documentLike.createElement('div');
  heading.textContent = 'viewportDebug=1';
  heading.style.fontWeight = '700';
  heading.style.marginBottom = '4px';
  panel.appendChild(heading);

  const readout = documentLike.createElement('pre');
  readout.style.margin = '0 0 6px';
  readout.style.font = 'inherit';
  panel.appendChild(readout);
  state.panelReadout = readout;

  const historyHeading = documentLike.createElement('div');
  historyHeading.textContent = 'Historial (más reciente al final)';
  historyHeading.style.fontWeight = '700';
  historyHeading.style.marginBottom = '2px';
  panel.appendChild(historyHeading);

  const history = documentLike.createElement('div');
  history.style.maxHeight = '24vh';
  history.style.overflow = 'auto';
  history.style.borderTop = '1px solid rgba(255,255,255,0.2)';
  history.style.paddingTop = '3px';
  panel.appendChild(history);
  state.panelHistory = history;

  const controls = documentLike.createElement('div');
  controls.style.display = 'flex';
  controls.style.gap = '6px';
  controls.style.marginTop = '6px';

  const copyButton = documentLike.createElement('button');
  copyButton.type = 'button';
  copyButton.textContent = 'Copiar JSON';
  copyButton.style.font = 'inherit';
  copyButton.style.padding = '3px 6px';
  copyButton.addEventListener('click', async () => {
    const copied = await api.copy();
    copyButton.textContent = copied ? 'Copiado' : 'Copia desde window.__viewportDebug';
    windowLike.setTimeout(() => { copyButton.textContent = 'Copiar JSON'; }, 1800);
  });
  controls.appendChild(copyButton);

  const stopButton = documentLike.createElement('button');
  stopButton.type = 'button';
  stopButton.textContent = 'Desactivar debug';
  stopButton.style.font = 'inherit';
  stopButton.style.padding = '3px 6px';
  stopButton.addEventListener('click', () => api.stop());
  controls.appendChild(stopButton);
  panel.appendChild(controls);

  (documentLike.body || documentLike.documentElement).appendChild(panel);
  state.panel = panel;
  updatePanel();
  return api;
}

export function startViewportDebug(windowLike = typeof window !== 'undefined' ? window : null) {
  if (!windowLike?.document) return null;

  const queryValue = readDebugQuery(windowLike);
  const storedPreference = persistDebugPreference(windowLike, queryValue);
  if (queryValue === '0') {
    windowLike.__viewportDebug?.stop?.();
    return null;
  }

  if (windowLike.__viewportDebug?.enabled) return windowLike.__viewportDebug;

  const enabled = queryValue === '1' || storedPreference === true;
  if (!enabled) return null;
  return createViewportDebug(windowLike, { startReason: 'initial-load' });
}

export function toggleViewportDebugFromGesture(
  windowLike = typeof window !== 'undefined' ? window : null,
) {
  if (!windowLike?.document) return false;

  if (windowLike.__viewportDebug?.enabled) {
    windowLike.__viewportDebug.stop?.();
    return false;
  }

  // El gesto se ejecuta dentro de la PWA, por lo que esta escritura usa el
  // almacenamiento propio de esa instalación y no el de Safari.
  if (readDebugQuery(windowLike) === '0') return false;
  setDebugPreference(windowLike);
  createViewportDebug(windowLike, { startReason: 'debug-gesture' });
  return Boolean(windowLike.__viewportDebug?.enabled);
}

export function markViewportDebugMounted(windowLike = typeof window !== 'undefined' ? window : null) {
  windowLike?.__viewportDebug?.markMounted?.();
}
