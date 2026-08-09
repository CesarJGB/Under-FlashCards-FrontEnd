const DIAGNOSTICS_BUILD_ENABLED = Boolean(import.meta.env?.DEV);

const DEFAULT_MAX_EVENTS = 500;
const SAFE_TOKEN = /^[a-z0-9][a-z0-9:._-]{0,79}$/i;
const SAFE_STATE = new Set([
  'open',
  'closed',
  'opening',
  'closing',
  'unknown',
  'unavailable',
  'settling',
  'stable',
  'locked',
  'unlocked',
  'inert',
  'interactive',
  'scoped',
  'missing',
]);

const asFiniteNumber = (value) => (
  Number.isFinite(Number(value)) ? Number(value) : undefined
);

const asSafeToken = (value) => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return SAFE_TOKEN.test(normalized) ? normalized : undefined;
};

const copyRect = (rect) => {
  if (!rect) return undefined;
  const left = asFiniteNumber(rect.left ?? rect.x);
  const top = asFiniteNumber(rect.top ?? rect.y);
  const width = asFiniteNumber(rect.width);
  const height = asFiniteNumber(rect.height);
  if ([left, top, width, height].some((value) => value === undefined)) return undefined;
  return { left, top, width, height };
};

const copyTarget = (target) => {
  if (!target || typeof target !== 'object') return undefined;
  const tag = asSafeToken(target.tag);
  const testId = asSafeToken(target.testId);
  if (!tag && !testId) return undefined;
  return {
    ...(tag ? { tag } : {}),
    ...(testId ? { testId } : {}),
  };
};

const copyViewport = (viewport) => {
  if (!viewport || typeof viewport !== 'object') return undefined;
  const width = asFiniteNumber(viewport.width);
  const height = asFiniteNumber(viewport.height);
  const offsetLeft = asFiniteNumber(viewport.offsetLeft);
  const offsetTop = asFiniteNumber(viewport.offsetTop);
  const scale = asFiniteNumber(viewport.scale);
  if ([width, height, offsetLeft, offsetTop, scale].some((value) => value === undefined)) {
    return undefined;
  }
  return { width, height, offsetLeft, offsetTop, scale };
};

const copyListenerCount = (listenerCount) => {
  if (!listenerCount || typeof listenerCount !== 'object') return undefined;
  const total = asFiniteNumber(listenerCount.total);
  const byType = {};
  Object.entries(listenerCount.byType || {}).forEach(([type, count]) => {
    const safeType = asSafeToken(type);
    const safeCount = asFiniteNumber(count);
    if (safeType && safeCount !== undefined) byType[safeType] = safeCount;
  });
  if (total === undefined && Object.keys(byType).length === 0) return undefined;
  return {
    ...(total !== undefined ? { total } : {}),
    ...(Object.keys(byType).length ? { byType } : {}),
  };
};

const copyOffsets = (scrollOffsets) => {
  if (!scrollOffsets || typeof scrollOffsets !== 'object') return undefined;
  const result = {};
  Object.entries(scrollOffsets).forEach(([owner, offset]) => {
    const safeOwner = asSafeToken(owner);
    const x = asFiniteNumber(offset?.x);
    const y = asFiniteNumber(offset?.y);
    if (safeOwner && x !== undefined && y !== undefined) result[safeOwner] = { x, y };
  });
  return Object.keys(result).length ? result : undefined;
};

const copyTokenList = (items) => {
  if (!Array.isArray(items)) return undefined;
  const safeItems = [...new Set(items.map(asSafeToken).filter(Boolean))];
  return safeItems.length ? safeItems : undefined;
};

const copyGeometry = (geometry) => {
  if (!geometry || typeof geometry !== 'object') return undefined;
  const revision = asFiniteNumber(geometry.revision);
  const epoch = asFiniteNumber(geometry.epoch);
  const phase = ['unavailable', 'settling', 'stable'].includes(geometry.phase)
    ? geometry.phase
    : undefined;
  const source = ['visual-viewport', 'layout-fallback'].includes(geometry.source)
    ? geometry.source
    : undefined;
  const orientation = ['portrait', 'landscape', 'square'].includes(geometry.orientation)
    ? geometry.orientation
    : undefined;
  const layout = copyRect(geometry.layout);
  const visualRect = copyRect(geometry.visual);
  const scale = asFiniteNumber(geometry.visual?.scale);
  const occlusion = {};
  for (const edge of ['top', 'right', 'bottom', 'left']) {
    const value = asFiniteNumber(geometry.occlusion?.[edge]);
    if (value === undefined || value < 0) return undefined;
    occlusion[edge] = value;
  }
  if (
    revision === undefined
    || epoch === undefined
    || !phase
    || !source
    || !orientation
    || !layout
    || !visualRect
    || scale === undefined
    || scale <= 0
  ) return undefined;
  return {
    revision: Math.max(0, Math.trunc(revision)),
    epoch: Math.max(0, Math.trunc(epoch)),
    phase,
    source,
    orientation,
    layout,
    visual: { ...visualRect, scale },
    occlusion,
  };
};

const copyOverflow = (overflow) => {
  if (!overflow || typeof overflow !== 'object') return undefined;
  const result = {};
  Object.entries(overflow).forEach(([name, metrics]) => {
    const safeName = asSafeToken(name);
    const scrollWidth = asFiniteNumber(metrics?.scrollWidth);
    const clientWidth = asFiniteNumber(metrics?.clientWidth);
    if (!safeName || scrollWidth === undefined || clientWidth === undefined) return;
    result[safeName] = {
      horizontal: Boolean(metrics.horizontal),
      scrollWidth: Math.max(0, scrollWidth),
      clientWidth: Math.max(0, clientWidth),
    };
  });
  return Object.keys(result).length ? result : undefined;
};

/**
 * Copies only the diagnostic fields approved for the manual editor harness.
 * Unknown fields are discarded by construction, including values, filenames,
 * card/deck data, images, credentials and error messages/stacks.
 */
export function sanitizeManualEditorDiagnostic(input = {}) {
  const timestamp = asFiniteNumber(input.timestamp);
  const type = asSafeToken(input.type);
  if (timestamp === undefined || !type) return null;

  const output = { timestamp: Math.max(0, timestamp), type };
  const target = copyTarget(input.target);
  const activeElement = copyTarget(input.activeElement);
  const visualViewport = copyViewport(input.visualViewport);
  const orientation = ['portrait', 'landscape', 'square'].includes(input.orientation)
    ? input.orientation
    : undefined;
  const renderCount = asFiniteNumber(input.renderCount);
  const listenerCount = copyListenerCount(input.listenerCount);
  const scrollOffsets = copyOffsets(input.scrollOffsets);
  const layerIds = copyTokenList(input.layerIds);
  const owners = copyTokenList(input.owners);
  const geometry = copyGeometry(input.geometry);
  const overflow = copyOverflow(input.overflow);

  if (target) output.target = target;
  if (activeElement) output.activeElement = activeElement;
  if (visualViewport) output.visualViewport = visualViewport;
  if (orientation) output.orientation = orientation;
  if (renderCount !== undefined) output.renderCount = Math.max(0, Math.trunc(renderCount));
  if (listenerCount) output.listenerCount = listenerCount;
  if (scrollOffsets) output.scrollOffsets = scrollOffsets;
  if (layerIds) output.layerIds = layerIds;
  if (owners) output.owners = owners;
  if (geometry) output.geometry = geometry;
  if (overflow) output.overflow = overflow;

  const rects = {};
  Object.entries(input.rects || {}).forEach(([name, rect]) => {
    const safeName = asSafeToken(name);
    const safeRect = copyRect(rect);
    if (safeName && safeRect) rects[safeName] = safeRect;
  });
  if (Object.keys(rects).length) output.rects = rects;

  const state = {};
  Object.entries(input.state || {}).forEach(([name, value]) => {
    const safeName = asSafeToken(name);
    if (safeName && SAFE_STATE.has(value)) state[safeName] = value;
  });
  if (Object.keys(state).length) output.state = state;

  if (input.error && typeof input.error === 'object') {
    const name = asSafeToken(input.error.name);
    const code = asSafeToken(input.error.code);
    if (name || code) {
      output.error = {
        ...(name ? { name } : {}),
        ...(code ? { code } : {}),
      };
    }
  }

  return output;
}

export function describeManualEditorTarget(target, windowLike = globalThis.window) {
  if (!target) return undefined;
  if (target === windowLike) return { tag: 'window' };
  if (target === windowLike?.document) return { tag: 'document' };
  if (target === windowLike?.visualViewport) return { tag: 'visual-viewport' };
  const tag = target.tagName?.toLowerCase?.();
  const testId = target.dataset?.testid;
  return copyTarget({ tag, testId });
}

export function createManualEditorDiagnostics({
  enabled = DIAGNOSTICS_BUILD_ENABLED,
  maxEvents = DEFAULT_MAX_EVENTS,
  now = () => performance.now(),
} = {}) {
  if (!DIAGNOSTICS_BUILD_ENABLED || !enabled) {
    return {
      enabled: false,
      record() {},
      reset() {},
      read: () => [],
    };
  }

  const startedAt = now();
  const events = [];
  const limit = Math.max(1, Math.trunc(maxEvents));

  return {
    enabled: true,
    record(type, detail = {}) {
      const event = sanitizeManualEditorDiagnostic({
        ...detail,
        type,
        timestamp: Math.max(0, now() - startedAt),
      });
      if (!event) return;
      events.push(event);
      if (events.length > limit) events.splice(0, events.length - limit);
    },
    reset() {
      events.length = 0;
    },
    read() {
      return events.map((event) => structuredClone(event));
    },
  };
}

export function readManualEditorDiagnosticSnapshot({
  windowLike = window,
  documentLike = document,
  renderCount = 0,
  listenerCount,
} = {}) {
  const modal = documentLike.querySelector('[data-testid="manual-card-editor-modal"]');
  const textarea = modal?.querySelector('textarea');
  const editorMain = modal?.querySelector('main');
  const footer = modal?.querySelector('footer');
  const surface = modal?.querySelector('[data-testid="manual-card-editor-surface"]');
  const palette = documentLike.querySelector('[data-color-palette="true"]');
  const actionSheet = [...documentLike.querySelectorAll('section[role="dialog"]')]
    .find((node) => !modal?.contains(node));
  const appScrollRoot = documentLike.querySelector('[data-app-scroll-root]');
  const visualViewport = windowLike.visualViewport;
  const width = visualViewport?.width ?? windowLike.innerWidth;
  const height = visualViewport?.height ?? windowLike.innerHeight;
  const orientation = width === height ? 'square' : (width > height ? 'landscape' : 'portrait');

  const layerIds = [
    modal ? 'manual-editor' : null,
    actionSheet ? 'action-sheet' : null,
    ...[...documentLike.querySelectorAll('[data-editor-layer-id]')]
      .map((node) => node.dataset.editorLayerId),
  ].filter(Boolean);
  let geometry;
  try {
    geometry = JSON.parse(modal?.dataset.editorGeometry || 'null');
  } catch {
    geometry = undefined;
  }
  const overflowMetrics = (node) => ({
    horizontal: Boolean(node && node.scrollWidth > node.clientWidth),
    scrollWidth: node?.scrollWidth ?? 0,
    clientWidth: node?.clientWidth ?? 0,
  });

  return sanitizeManualEditorDiagnostic({
    timestamp: 0,
    type: 'snapshot',
    activeElement: describeManualEditorTarget(documentLike.activeElement, windowLike),
    rects: {
      modal: modal?.getBoundingClientRect(),
      surface: surface?.getBoundingClientRect(),
      textarea: textarea?.getBoundingClientRect(),
      editor: editorMain?.getBoundingClientRect(),
      footer: footer?.getBoundingClientRect(),
      palette: palette?.getBoundingClientRect(),
      'action-sheet': actionSheet?.getBoundingClientRect(),
      'app-scroll-root': appScrollRoot?.getBoundingClientRect(),
    },
    visualViewport: {
      width,
      height,
      offsetLeft: visualViewport?.offsetLeft ?? 0,
      offsetTop: visualViewport?.offsetTop ?? 0,
      scale: visualViewport?.scale ?? 1,
    },
    orientation,
    geometry,
    overflow: {
      surface: overflowMetrics(surface),
      editor: overflowMetrics(editorMain),
      footer: overflowMetrics(footer),
    },
    renderCount,
    listenerCount,
    scrollOffsets: {
      app: { x: appScrollRoot?.scrollLeft ?? 0, y: appScrollRoot?.scrollTop ?? 0 },
      editor: { x: editorMain?.scrollLeft ?? 0, y: editorMain?.scrollTop ?? 0 },
      textarea: { x: textarea?.scrollLeft ?? 0, y: textarea?.scrollTop ?? 0 },
      palette: { x: palette?.scrollLeft ?? 0, y: palette?.scrollTop ?? 0 },
      'action-sheet': { x: actionSheet?.scrollLeft ?? 0, y: actionSheet?.scrollTop ?? 0 },
    },
    layerIds,
    owners: [
      appScrollRoot?.style.overflow === 'hidden' ? 'app-scroll-lease' : null,
      documentLike.getElementById('root')?.hasAttribute('inert') ? 'root-inert' : null,
      documentLike.body.style.overflow === 'hidden' ? 'body-scroll-lock' : null,
    ].filter(Boolean),
    state: {
      modal: modal ? 'open' : 'closed',
      palette: palette ? 'open' : 'closed',
      'action-sheet': actionSheet ? 'open' : 'closed',
      scroll: appScrollRoot?.style.overflow === 'hidden' ? 'locked' : 'unlocked',
      shell: documentLike.getElementById('root')?.hasAttribute('inert') ? 'inert' : 'interactive',
      portal: palette?.parentElement?.matches?.('[data-editor-overlay-root="true"]') ? 'scoped' : 'missing',
    },
  });
}

export function installManualEditorListenerProbe(windowLike = window) {
  if (!DIAGNOSTICS_BUILD_ENABLED || !windowLike?.EventTarget) {
    return { snapshot: () => ({ total: 0, byType: {} }), restore() {} };
  }

  const prototype = windowLike.EventTarget.prototype;
  const originalAdd = prototype.addEventListener;
  const originalRemove = prototype.removeEventListener;
  const registrations = [];
  const getCapture = (options) => (typeof options === 'boolean' ? options : Boolean(options?.capture));

  prototype.addEventListener = function addEventListener(type, listener, options) {
    const capture = getCapture(options);
    const exists = registrations.some((entry) => (
      entry.target === this
      && entry.type === type
      && entry.listener === listener
      && entry.capture === capture
    ));
    if (!exists) registrations.push({ target: this, type, listener, capture });
    return originalAdd.call(this, type, listener, options);
  };

  prototype.removeEventListener = function removeEventListener(type, listener, options) {
    const capture = getCapture(options);
    const index = registrations.findIndex((entry) => (
      entry.target === this
      && entry.type === type
      && entry.listener === listener
      && entry.capture === capture
    ));
    if (index >= 0) registrations.splice(index, 1);
    return originalRemove.call(this, type, listener, options);
  };

  const NativeResizeObserver = windowLike.ResizeObserver;
  const activeResizeObservers = new Set();
  if (typeof NativeResizeObserver === 'function') {
    windowLike.ResizeObserver = class ManualEditorResizeObserverProbe {
      constructor(callback) {
        this.nativeObserver = new NativeResizeObserver(callback);
        this.targets = new Set();
        activeResizeObservers.add(this);
      }

      observe(target, options) {
        this.targets.add(target);
        return this.nativeObserver.observe(target, options);
      }

      unobserve(target) {
        this.targets.delete(target);
        return this.nativeObserver.unobserve(target);
      }

      disconnect() {
        this.targets.clear();
        activeResizeObservers.delete(this);
        return this.nativeObserver.disconnect();
      }

      takeRecords() {
        return this.nativeObserver.takeRecords();
      }
    };
  }

  return {
    snapshot() {
      const byType = {};
      registrations.forEach(({ type }) => {
        const safeType = asSafeToken(type);
        if (safeType) byType[safeType] = (byType[safeType] || 0) + 1;
      });
      if (activeResizeObservers.size) byType.ResizeObserver = activeResizeObservers.size;
      return {
        total: registrations.length + activeResizeObservers.size,
        byType,
      };
    },
    restore() {
      prototype.addEventListener = originalAdd;
      prototype.removeEventListener = originalRemove;
      if (typeof NativeResizeObserver === 'function') windowLike.ResizeObserver = NativeResizeObserver;
      registrations.length = 0;
      activeResizeObservers.clear();
    },
  };
}

export function observeManualEditorHarnessEvents(diagnostics, windowLike = window) {
  if (!diagnostics?.enabled) return () => {};
  const documentLike = windowLike.document;
  const domEvents = ['focusin', 'focusout', 'keydown', 'pointerdown', 'click', 'change', 'scroll'];
  const recordDomEvent = (event) => diagnostics.record(`dom:${event.type}`, {
    target: describeManualEditorTarget(event.target, windowLike),
    activeElement: describeManualEditorTarget(documentLike.activeElement, windowLike),
  });
  domEvents.forEach((type) => documentLike.addEventListener(type, recordDomEvent, true));

  const recordViewportEvent = (event) => diagnostics.record(`viewport:${event.type}`, {
    target: describeManualEditorTarget(event.currentTarget, windowLike),
    activeElement: describeManualEditorTarget(documentLike.activeElement, windowLike),
  });
  windowLike.addEventListener('resize', recordViewportEvent);
  windowLike.visualViewport?.addEventListener('resize', recordViewportEvent);
  windowLike.visualViewport?.addEventListener('scroll', recordViewportEvent);

  return () => {
    domEvents.forEach((type) => documentLike.removeEventListener(type, recordDomEvent, true));
    windowLike.removeEventListener('resize', recordViewportEvent);
    windowLike.visualViewport?.removeEventListener('resize', recordViewportEvent);
    windowLike.visualViewport?.removeEventListener('scroll', recordViewportEvent);
  };
}

export const manualEditorDiagnosticsBuildEnabled = DIAGNOSTICS_BUILD_ENABLED;
