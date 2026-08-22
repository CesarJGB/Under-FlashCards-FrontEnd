// INSTRUMENTACIÓN TEMPORAL: retirar este archivo y sus dos puntos de llamada
// cuando termine la investigación del arranque de la PWA en iOS.
const DEBUG_QUERY_PARAM = 'viewportDebug';
const MAX_HISTORY_ENTRIES = 240;
const PANEL_HISTORY_ENTRIES = 24;
const SAFE_AREA_PROBE_ID = '__under_flashcards_viewport_debug_safe_area';
const VIEWPORT_UNITS_PROBE_ID = '__under_flashcards_viewport_debug_units';
const PANEL_ID = '__under_flashcards_viewport_debug_panel';

const readDebugQuery = (windowLike) => {
  try {
    return new URLSearchParams(windowLike.location?.search || '').get(DEBUG_QUERY_PARAM);
  } catch {
    return null;
  }
};

const persistDebugPreference = (windowLike, queryValue) => {
  try {
    const storage = windowLike.localStorage;
    if (queryValue === '1') storage.setItem(DEBUG_QUERY_PARAM, '1');
    if (queryValue === '0') storage.removeItem(DEBUG_QUERY_PARAM);
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

const getPerformanceNow = (windowLike) => (
  Number.isFinite(Number(windowLike.performance?.now?.()))
    ? Number(windowLike.performance.now())
    : Date.now()
);

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

function createViewportDebug(windowLike) {
  const documentLike = windowLike.document;
  const startedAtPerformance = getPerformanceNow(windowLike);
  const state = {
    enabled: true,
    version: 1,
    startedAt: new Date().toISOString(),
    startedAtPerformance,
    history: [],
    samples: [],
    events: [],
    firstResize: null,
    latest: null,
    mountMarks: 0,
    imageRecords: new WeakMap(),
    observedResizeTargets: new WeakMap(),
    cleanup: [],
    timers: [],
    frameHandles: [],
    panel: null,
    panelReadout: null,
    panelHistory: null,
    safeAreaProbe: null,
    viewportUnitsProbe: null,
    resizeObserver: null,
    domObserver: null,
    bodyStyleObserver: null,
  };

  const elapsed = () => round(getPerformanceNow(windowLike) - startedAtPerformance);

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

  const readSnapshot = () => {
    const html = documentLike.documentElement;
    const body = documentLike.body;
    const root = documentLike.getElementById('root');
    const visualViewport = windowLike.visualViewport;
    const standalone = readStandalone(windowLike);
    const safeArea = readSafeArea();
    const htmlStyles = html ? windowLike.getComputedStyle(html) : null;
    const bodyStyles = body ? windowLike.getComputedStyle(body) : null;
    const viewportMetas = [...(documentLike.head?.querySelectorAll?.('meta[name="viewport"]') || [])];

    return {
      innerWidth: round(windowLike.innerWidth),
      innerHeight: round(windowLike.innerHeight),
      documentElementClientWidth: round(html?.clientWidth),
      documentElementClientHeight: round(html?.clientHeight),
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
      screen: {
        width: round(windowLike.screen?.width),
        height: round(windowLike.screen?.height),
      },
      devicePixelRatio: round(windowLike.devicePixelRatio),
      navigatorStandalone: standalone.navigatorStandalone,
      displayModeStandalone: standalone.displayModeStandalone,
      visibilityState: documentLike.visibilityState,
      safeTop: safeArea.safeTop,
      safeBottom: safeArea.safeBottom,
      safeArea,
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
    state.panelReadout.textContent = [
      `innerHeight: ${latest.innerHeight ?? '—'} | clientHeight: ${latest.documentElementClientHeight ?? '—'}`,
      `visualViewport.height: ${vv?.height ?? '—'} | offset: ${vv?.offsetTop ?? '—'},${vv?.offsetLeft ?? '—'}`,
      `safeTop/bottom: ${latest.safeTop ?? '—'} / ${latest.safeBottom ?? '—'}`,
      `body height: ${latest.computed?.bodyHeight ?? '—'} | root rect: ${latest.rootRect?.height ?? '—'}`,
      `100vh/dvh: ${units.vh?.rectHeight ?? '—'} / ${units.dvh?.rectHeight ?? '—'}`,
      `standalone: nav=${latest.navigatorStandalone ?? '—'} mm=${latest.displayModeStandalone ?? '—'} | visibility: ${latest.visibilityState ?? '—'}`,
      `body: overflow=${latest.computed?.bodyOverflow ?? '—'} padding=${latest.computed?.bodyPaddingTop ?? '—'}/${latest.computed?.bodyPaddingBottom ?? '—'}`,
      `primer resize: ${firstResize}`,
      `imagen: ${image ? `${image.complete ? 'complete' : 'pending'} natural=${image.naturalWidth ?? 0} decode=${image.decodeState}` : 'no encontrada'}`,
      `último: ${formatEventLine(latest)}`,
    ].join('\n');

    state.panelHistory.replaceChildren(...state.history.slice(-PANEL_HISTORY_ENTRIES).map((entry) => {
      const line = documentLike.createElement('div');
      line.textContent = formatEventLine(entry);
      return line;
    }));
  };

  const appendEntry = (kind, label, details = {}) => {
    const entry = {
      timestamp: new Date().toISOString(),
      elapsedMs: elapsed(),
      kind,
      ...(kind === 'sample' ? { label } : { event: label }),
      ...readSnapshot(),
      ...details,
    };
    state.latest = entry;
    pushLimited(state.history, entry);
    if (kind === 'sample') pushLimited(state.samples, entry);
    if (kind === 'event') {
      pushLimited(state.events, entry);
      if (
        !state.firstResize
        && (label === 'resize' || label === 'visualViewport.resize')
      ) {
        state.firstResize = { event: label, elapsedMs: entry.elapsedMs };
      }
    }
    updatePanel();
    return entry;
  };

  const capture = (label, details = {}) => appendEntry('sample', label, details);

  const recordEvent = (event, details = {}) => appendEntry('event', event, details);

  const trackPublicHomeImage = () => {
    const image = findPublicHomeImage(documentLike);
    if (!image || state.imageRecords.has(image)) return;

    const record = {
      decodeState: 'not-started',
      loadedAtMs: null,
      errorAtMs: null,
      decodeStartedAtMs: null,
      decodeFinishedAtMs: null,
    };
    state.imageRecords.set(image, record);

    const beginDecodeCheck = () => {
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
          record.decodeState = 'decoded';
          record.decodeFinishedAtMs = elapsed();
          recordEvent('image.decode-resolved', { imageEvent: 'decode-resolved' });
        },
        () => {
          record.decodeState = 'decode-rejected';
          record.decodeFinishedAtMs = elapsed();
          recordEvent('image.decode-rejected', { imageEvent: 'decode-rejected' });
        },
      );
    };

    image.addEventListener('load', () => {
      record.decodeState = 'loaded';
      record.loadedAtMs = elapsed();
      recordEvent('image.load', { imageEvent: 'load' });
      beginDecodeCheck();
    }, { once: true });
    image.addEventListener('error', () => {
      record.decodeState = 'error';
      record.errorAtMs = elapsed();
      recordEvent('image.error', { imageEvent: 'error' });
    }, { once: true });

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

  const cleanup = () => {
    state.cleanup.splice(0).forEach((callback) => callback());
    state.timers.splice(0).forEach((timerId) => windowLike.clearTimeout?.(timerId));
    state.frameHandles.splice(0).forEach((handle) => cancelFrame(windowLike, handle));
    state.safeAreaProbe?.remove();
    state.viewportUnitsProbe?.remove();
    state.panel?.remove();
    state.panel = null;
  };

  const toJSON = () => ({
    enabled: state.enabled,
    version: state.version,
    startedAt: state.startedAt,
    firstResize: state.firstResize,
    samples: state.samples,
    events: state.events,
    history: state.history,
  });

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
    startedAt: state.startedAt,
    get latest() { return state.latest; },
    get history() { return state.history; },
    get samples() { return state.samples; },
    get events() { return state.events; },
    get firstResize() { return state.firstResize; },
    capture,
    recordEvent,
    markMounted: () => {
      state.mountMarks += 1;
      const markNumber = state.mountMarks;
      const label = markNumber === 1
        ? 'T1-after-react-mount'
        : `T1-after-react-mount-strictmode-${markNumber}`;
      scheduleMicrotask(windowLike, () => capture(label, { mountMark: markNumber }));
    },
    toJSON,
    copy,
    stop: () => {
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
    [documentLike, 'visibilitychange'],
    [windowLike, 'pageshow'],
    [windowLike, 'pagehide'],
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
    state.imageRecords = new WeakMap();
    state.observedResizeTargets = new WeakMap();
  });

  windowLike.__viewportDebug = api;

  // T0 se captura antes de que main.jsx llame a ReactDOM.createRoot().
  trackPublicHomeImage();
  capture('T0-before-react-mount');

  const firstFrame = requestFrame(windowLike, () => {
    capture('T2-requestAnimationFrame-1');
    const secondFrame = requestFrame(windowLike, () => capture('T3-requestAnimationFrame-2'));
    state.frameHandles.push(secondFrame);
  });
  state.frameHandles.push(firstFrame);

  [
    [100, 'T4-100ms'],
    [500, 'T5-500ms'],
    [1000, 'T6-1000ms'],
  ].forEach(([delay, label]) => {
    state.timers.push(windowLike.setTimeout(() => capture(label), delay));
  });

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
  stopButton.textContent = 'Detener';
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
  return createViewportDebug(windowLike);
}

export function markViewportDebugMounted(windowLike = typeof window !== 'undefined' ? window : null) {
  windowLike?.__viewportDebug?.markMounted?.();
}
