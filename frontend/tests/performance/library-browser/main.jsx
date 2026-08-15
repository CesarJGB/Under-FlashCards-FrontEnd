// FILE: frontend/tests/performance/library-browser/main.jsx
// Harness de navegador de la Fase 2B. Monta los componentes REALES de
// producción (DashboardScreen desde App.jsx) y mide, sin modificar su
// comportamiento:
//   - red (fetch patch + Resource Timing);
//   - recepción del cuerpo y JSON.parse (patch de res.json);
//   - transformación (sanitizeDeckSummaries / extractAndResolveCards
//     replicadas con los mismos datos y las mismas funciones productivas);
//   - hidratación desde safeLocalStorage (getItem/parse/sanitize replicados);
//   - JSON.stringify + localStorage.setItem (replicados);
//   - long tasks, layout shifts y paint (PerformanceObserver);
//   - commits de React (Profiler, sólo en el build de profiling);
//   - memoria (performance.memory) y DOM.
//
// Todo el código de esta página pertenece al harness, no a producción.

import React, { Profiler } from 'react';
import { createRoot } from 'react-dom/client';
import { DashboardScreen } from '../../../src/App.jsx';
import { sanitizeDeckSummaries, extractAndResolveCards } from '../../../src/lib/imageDelivery';
import { perfLibraryProfile } from '../../../src/lib/perfLibraryProfile';
import '../../../src/index.css';

const PROFILE_MODE = import.meta.env.VITE_PERF_LIBRARY_PROFILE === '1';
// Instrumentación de timings de la página del harness (body/parse/transform).
// Sólo el runner la define (VITE_PERF_HARNESS_INSTRUMENT=1) para ambos builds
// de medición; el build productivo normal de la aplicación (index.html) no
// incluye esta página ni este código.
const HARNESS_INSTRUMENT = import.meta.env.VITE_PERF_HARNESS_INSTRUMENT === '1';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const params = new URLSearchParams(window.location.search);
const userId = params.get('userId') || '';

const harnessUser = {
  id: userId,
  email: 'perf-harness@localhost',
  isAdmin: false,
  authToken: '',
  hasAccess: true,
};

// ===========================================================================
// Observadores de rendimiento
// ===========================================================================

const longTasks = [];
const layoutShifts = [];
const paints = [];
const measures = [];
const observerStatus = { longtask: false, 'layout-shift': false, paint: false, measure: false };

if (typeof PerformanceObserver !== 'undefined') {
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) longTasks.push({ startTime: entry.startTime, duration: entry.duration });
    }).observe({ type: 'longtask', buffered: true });
    observerStatus.longtask = true;
  } catch { /* categoría no disponible */ }
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) layoutShifts.push({ startTime: entry.startTime, value: entry.value, hadRecentInput: entry.hadRecentInput });
    }).observe({ type: 'layout-shift', buffered: true });
    observerStatus['layout-shift'] = true;
  } catch { /* categoría no disponible */ }
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) paints.push({ name: entry.name, startTime: entry.startTime });
    }).observe({ type: 'paint', buffered: true });
    observerStatus.paint = true;
  } catch { /* categoría no disponible */ }
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) measures.push({ name: entry.name, startTime: entry.startTime, duration: entry.duration });
    }).observe({ type: 'measure', buffered: true });
    observerStatus.measure = true;
  } catch { /* categoría no disponible */ }
}

// ===========================================================================
// Patch de fetch (sólo observación; nunca altera solicitudes ni respuestas)
// ===========================================================================
//
// Intervalos medidos (documentados con precisión):
// - networkMs (aproximado, no autoritativo): desde el inicio de fetch hasta
//   recibir las cabeceras. El tiempo de red AUTORITATIVO proviene de CDP
//   Network (TTFB/descarga/tamaños) en el runner; este valor de página es una
//   aproximación del mismo tramo y se etiqueta como tal.
// - bodyReadMs: lectura y decodificación del body (`response.clone().text()`),
//   sin parseo.
// - parseMs: `JSON.parse(text)` PURO, sin lectura del body.
// - transformMs: transformación productiva replicada (sanitizeDeckSummaries /
//   extractAndResolveCards) con los mismos datos y las mismas funciones puras
//   que ejecuta el código real inmediatamente después del parseo.
// - Render/commit de React: Profiler (sólo build de profiling).
// - Layout/paint posteriores: PerformanceObserver de paint + traza CDP.
// - Tiempo total hasta utilizable: marcas del runner por escenario.
//
// La medición pura (text + JSON.parse) permanece detrás de la bandera de
// instrumentación del harness: con la bandera desactivada se conserva el
// comportamiento original (res.json() + parseDuration compuesto). La
// verificación de equivalencia semántica con res.json() se ejecuta una sola
// vez por URL única, en segundo plano, y nunca expone contenido: sólo
// registra 'verified' | 'mismatch'.

const fetchRecords = [];
const originalFetch = window.fetch.bind(window);
const verifiedEquivalenceUrls = new Set();

window.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : (input && input.url) || '';
  const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
  const isBackend = Boolean(BACKEND_URL) && url.startsWith(BACKEND_URL);
  const record = {
    url,
    method,
    isBackend,
    requestStart: performance.now(),
    status: null,
    networkMs: null,
    bodyReadMs: null,
    parseMs: null,
    transformMs: null,
    parseFallback: false,
    equivalence: null,
    responseEnd: null,
    error: null,
  };
  fetchRecords.push(record);
  if (!isBackend) return originalFetch(input, init);
  try {
    const res = await originalFetch(input, init);
    record.status = res.status;
    record.networkMs = performance.now() - record.requestStart;
    const origJson = res.json.bind(res);
    if (!HARNESS_INSTRUMENT) {
      // Comportamiento original (parseo compuesto body+parse, sin text()).
      res.json = async () => {
        record.parseStart = performance.now();
        const data = await origJson();
        record.parseMs = performance.now() - record.parseStart;
        record.responseEnd = performance.now();
        measureTransform(record, url, data);
        return data;
      };
      return res;
    }
    // Medición separada: lectura/decodificación del body y JSON.parse puro.
    // `text()` + `JSON.parse(text)` reproduce el resultado semántico de
    // `response.json()` (mismo decode UTF-8 y mismo parser del motor); si
    // falla, se cae a res.json() original (parseFallback) preservando el
    // comportamiento de la aplicación.
    let textClone = null;
    let verifyClone = null;
    try {
      textClone = res.clone();
      verifyClone = res.clone();
    } catch { /* body no clonable: se cae al comportamiento original */ }
    if (!textClone) {
      res.json = async () => {
        record.parseStart = performance.now();
        const data = await origJson();
        record.parseMs = performance.now() - record.parseStart;
        record.responseEnd = performance.now();
        measureTransform(record, url, data);
        return data;
      };
      return res;
    }
    res.json = async () => {
      const t0 = performance.now();
      const text = await textClone.text();
      record.bodyReadMs = performance.now() - t0;
      const t1 = performance.now();
      let data;
      try {
        data = JSON.parse(text);
        record.parseMs = performance.now() - t1;
      } catch (error) {
        record.parseMs = performance.now() - t1;
        record.parseFallback = true;
        record.error = String(error);
        data = await origJson();
      }
      record.responseEnd = performance.now();
      measureTransform(record, url, data);
      // Equivalencia semántica con response.json(): una vez por URL única,
      // en segundo plano (no bloquea la medición ni el flujo).
      const normalized = url.split('?')[0];
      if (verifyClone && !verifiedEquivalenceUrls.has(normalized)) {
        verifiedEquivalenceUrls.add(normalized);
        verifyClone.json().then((expected) => {
          try {
            record.equivalence = JSON.stringify(data) === JSON.stringify(expected) ? 'verified' : 'mismatch';
          } catch {
            record.equivalence = 'mismatch';
          }
        }).catch(() => { record.equivalence = 'skipped'; });
      } else if (record.equivalence === null) {
        record.equivalence = 'skipped';
      }
      return data;
    };
    return res;
  } catch (error) {
    record.error = String(error);
    throw error;
  }
};

/** Mide la transformación productiva replicada (nunca altera `data`). */
function measureTransform(record, url, data) {
  try {
    if (/\/api\/decks\/[^/?]+(\?|$)/.test(url) && !/all-cards/.test(url) && Array.isArray(data)) {
      const t0 = performance.now();
      sanitizeDeckSummaries(data);
      record.transformMs = performance.now() - t0;
    } else if (/\/api\/flashcards\/deck\//.test(url)) {
      const t0 = performance.now();
      extractAndResolveCards(data);
      record.transformMs = performance.now() - t0;
    }
  } catch { /* la transformación se mide, no se falla aquí */ }
}

// ===========================================================================
// Commits de React (sólo build de profiling)
// ===========================================================================

const commits = [];
// Intervalos de marcas del harness: permiten atribuir cada commit a la fase
// de la interacción (primera apertura, apertura caliente, entrada a Library).
const markIntervals = [];
function onRender(id, phase, actualDuration, baseDuration, startTime, commitTime) {
  commits.push({ id, phase, actualDuration, baseDuration, startTime, commitTime });
}

const MARK_BUCKET_LABELS = {
  'deck-open:first': 'first-open',
  'deck-open:warm': 'warm-open',
  'library-entry': 'library-entry',
};

/** Etiqueta el bucket de un commit según los intervalos de marca del harness. */
function bucketOf(commit) {
  let bucket = null;
  let latestStart = -Infinity;
  for (const interval of markIntervals) {
    const overlaps = interval.start <= commit.commitTime && commit.startTime <= interval.end;
    if (!overlaps) continue;
    if (interval.start >= latestStart) {
      latestStart = interval.start;
      bucket = MARK_BUCKET_LABELS[interval.name] || `mark:${interval.name}`;
    }
  }
  return bucket;
}

// ===========================================================================
// Utilidades de estado del harness
// ===========================================================================

function backendFetchPending() {
  return fetchRecords.some((r) => r.isBackend && r.status === null && !r.error);
}

function afterFrames(count = 2) {
  return new Promise((resolve) => {
    let remaining = count;
    const tick = () => { remaining -= 1; if (remaining <= 0) resolve(); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
}

async function settle(ms = 40) {
  await new Promise((resolve) => setTimeout(resolve, ms));
  await afterFrames(2);
}

/** Espera hasta que el predicado se cumple de forma estable (2 rAF). */
async function waitUsable(predicate, { timeoutMs = 60_000, intervalMs = 40, stabilityFrames = 2 } = {}) {
  const startedAt = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    if (predicate()) {
      await afterFrames(stabilityFrames);
      if (predicate()) {
        return { ok: true, elapsedMs: performance.now() - startedAt };
      }
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return { ok: false, elapsedMs: performance.now() - startedAt };
}

function homePredicate() {
  if (!document.querySelector('[data-testid="dashboard-screen"]')) return false;
  const inicio = document.querySelector('button[aria-current="page"]');
  const hasHome = Boolean(document.querySelector('[data-bottom-gap]'));
  if (!inicio || !hasHome) return false;
  const text = (inicio.textContent || '').trim();
  return text === 'Inicio' && !backendFetchPending();
}

function libraryPredicate() {
  if (!document.querySelector('[data-testid="library-section"]')) return false;
  if (!document.querySelector('input[aria-label="Buscar..."]')) return false;
  if (!document.querySelector('button[aria-label="Abrir opciones de ordenamiento"]')) return false;
  if (document.body.innerText.includes('Cargando asignaturas…')) return false;
  // Contenido esperado: carpetas de materia, mazos sin clasificar o vacío.
  const hasFolders = document.querySelectorAll('[data-testid="library-section"] button').length > 0;
  if (!hasFolders) return false;
  return !backendFetchPending();
}

function deckPredicate(expectedCount) {
  if (!document.querySelector('[data-testid="deck-interior"]')) return false;
  const section = document.querySelector('[aria-label="Colección de cartas del mazo"]');
  if (!section) return false;
  const articles = section.querySelectorAll('article').length;
  if (articles !== expectedCount) return false;
  return !backendFetchPending();
}

// ===========================================================================
// API del harness expuesta al runner
// ===========================================================================

const harness = {
  configuration: { userId: userId ? 'real-user-A' : null, profileMode: PROFILE_MODE },

  async whenHomeUsable() {
    return waitUsable(homePredicate);
  },

  async whenLibraryUsable() {
    return waitUsable(libraryPredicate);
  },

  async whenLibraryInteractionEnabled() {
    return waitUsable(() => {
      if (!document.querySelector('[data-testid="library-section"]')) return false;
      if (!document.querySelector('input[aria-label="Buscar..."]')) return false;
      if (!document.querySelector('button[aria-label="Abrir opciones de ordenamiento"]')) return false;
      return !backendFetchPending();
    });
  },

  async whenLibraryContentVisible() {
    return waitUsable(() => {
      if (!document.querySelector('[data-testid="library-section"]')) return false;
      if (document.body.innerText.includes('Cargando asignaturas…')) return false;
      const buttons = document.querySelectorAll('[data-testid="library-section"] button').length;
      return buttons > 0 && !backendFetchPending();
    });
  },

  /** Espera un nivel concreto de la jerarquía académica. */
  async whenLibraryLevel(level) {
    // innerText devuelve el texto RENDERIZADO: los títulos con
    // `text-transform: uppercase` aparecen en mayúsculas; por eso la
    // comparación es insensible a mayúsculas/minúsculas.
    const text = () => (document.body.innerText || '').toLowerCase();
    const markers = {
      root: () => text().includes('tus materias'),
      parciales: () => text().includes('información de la materia'),
      temas: () => text().includes('temas del parcial') && !text().includes('descargando temario…'),
      subtemas: () => text().includes('subtemas') || text().includes('mazos del subtema') || text().includes('todos los mazos de este tema'),
      'subtemas-with-deck': () => text().includes('mazos del subtema'),
    };
    const predicate = markers[level];
    if (!predicate) return { ok: false, elapsedMs: 0, reason: 'unknown-level' };
    return waitUsable(() => predicate() && !backendFetchPending());
  },

  /** Estado estable tras volver de un mazo (puede ser un nivel no raíz). */
  async whenLibraryBackUsable() {
    return waitUsable(() => {
      if (!document.querySelector('[data-testid="library-section"]')) return false;
      if (document.body.innerText.includes('Cargando asignaturas…')) return false;
      const hasRootToolbar = Boolean(document.querySelector('input[aria-label="Buscar..."]'));
      const hasBreadcrumb = Boolean(document.querySelector('[data-testid="library-section"] button'))
        && document.body.innerText.includes('Biblioteca');
      if (!hasRootToolbar && !hasBreadcrumb) return false;
      return !backendFetchPending();
    });
  },

  async whenDeckUsable(expectedCount) {
    return waitUsable(() => deckPredicate(expectedCount));
  },

  resetTransient() {
    longTasks.length = 0;
    layoutShifts.length = 0;
    paints.length = 0;
    measures.length = 0;
    performance.clearMarks();
    performance.clearMeasures();
  },

  mark(name) {
    performance.mark(`2b:${name}:start`);
    markIntervals.push({ name, start: performance.now(), end: null });
  },

  async markEnd(name) {
    performance.mark(`2b:${name}:end`);
    try {
      performance.measure(`2b:${name}`, `2b:${name}:start`, `2b:${name}:end`);
    } catch { /* sin marca de inicio */ }
    const interval = [...markIntervals].reverse().find((m) => m.name === name && m.end === null);
    if (interval) interval.end = performance.now();
  },

  /** Diagnóstico para fallos de espera: estado visible de la página. */
  debugDump() {
    const text = document.body.innerText || '';
    return {
      innerTextHead: text.slice(0, 400),
      pendingBackendFetches: fetchRecords.filter((r) => r.isBackend && r.status === null && !r.error).map((r) => r.url.replace(/t=\d+/, 't=..')),
      dialogs: [...document.querySelectorAll('[role="dialog"]')].map((d) => (d.getAttribute('aria-label') || d.getAttribute('aria-labelledby') || d.textContent || '').slice(0, 60)),
      libraryButtons: document.querySelectorAll('[data-testid="library-section"] button').length,
      deckInterior: Boolean(document.querySelector('[data-testid="deck-interior"]')),
      collectionSection: Boolean(document.querySelector('[aria-label="Colección de cartas del mazo"]')),
      articles: document.querySelectorAll('article').length,
      hasToolbar: Boolean(document.querySelector('input[aria-label="Buscar..."]')),
    };
  },

  sampleMemory() {
    return performance.memory
      ? {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
        }
      : null;
  },

  snapshot({ includeResource = false } = {}) {
    const librarySection = document.querySelector('[data-testid="library-section"]');
    const deckSection = document.querySelector('[aria-label="Colección de cartas del mazo"]');
    const resourceEntries = includeResource
      ? performance.getEntriesByType('resource')
          .filter((e) => e.name.startsWith(BACKEND_URL))
          .map((e) => ({
            name: e.name,
            initiatorType: e.initiatorType,
            startTime: e.startTime,
            duration: e.duration,
            requestStart: e.requestStart,
            responseStart: e.responseStart,
            responseEnd: e.responseEnd,
            transferSize: e.transferSize,
            encodedBodySize: e.encodedBodySize,
            decodedBodySize: e.decodedBodySize,
          }))
      : [];
    return {
      dom: {
        totalNodes: document.querySelectorAll('*').length,
        libraryNodes: librarySection ? librarySection.querySelectorAll('*').length : null,
        deckNodes: deckSection ? deckSection.querySelectorAll('*').length : null,
        articleCount: document.querySelectorAll('article').length,
        deckArticleCount: deckSection ? deckSection.querySelectorAll('article').length : null,
        buttonCount: document.querySelectorAll('button').length,
        imageCount: document.images.length,
        inlineBackgroundImages: [...document.querySelectorAll('[style]')].filter((el) => {
          const bg = el.style.backgroundImage || '';
          return bg.includes('data:image') || bg.includes('blob:');
        }).length,
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
      },
      memory: this.sampleMemory(),
      longTasks: longTasks.map((t) => ({ ...t })),
      longTaskObserverActive: observerStatus.longtask,
      layoutShifts: layoutShifts.map((s) => ({ ...s })),
      layoutShiftObserverActive: observerStatus['layout-shift'],
      paints: paints.map((p) => ({ ...p })),
      paintObserverActive: observerStatus.paint,
      measures: measures.map((m) => ({ ...m })),
      measureObserverActive: observerStatus.measure,
      resourceEntries,
      commits: PROFILE_MODE ? commits.map((c) => ({ ...c, bucket: bucketOf(c) })) : null,
      perfProfile: perfLibraryProfile.snapshot(),
      fetchRecords: fetchRecords.map((r) => ({ ...r })),
      markIntervals: markIntervals.map((m) => ({ ...m })),
    };
  },

  /**
   * Localiza la tarjeta de un mazo por título EXACTO (el <p> del título debe
   * coincidir por completo: "test" no debe casar con "test animaciones") y por
   * el conteo de tarjetas, dentro de un div[role="button"].
   */
  findDeckCard(title, count) {
    const cards = [...document.querySelectorAll('div[role="button"]')];
    const countRe = new RegExp(`\\b${count}\\s+tarjetas?\\b`);
    const match = cards.find((el) => {
      const hasExactTitle = [...el.querySelectorAll('p')].some((p) => (p.textContent || '').trim() === title);
      return hasExactTitle && countRe.test(el.innerText || '');
    });
    if (!match) return null;
    match.scrollIntoView({ block: 'center', inline: 'nearest' });
    const rect = match.getBoundingClientRect();
    return { found: true, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, textLength: (match.innerText || '').length };
  },

  /**
   * Fila del resultado de búsqueda de un mazo: título EXACTO + etiqueta
   * "Mazo". Nunca casa "test" con "test animaciones".
   */
  findDeckSearchResult(title) {
    const candidates = [...document.querySelectorAll('div')].filter((el) => {
      const hasExactTitle = [...el.querySelectorAll('p')].some((p) => (p.textContent || '').trim() === title);
      if (!hasExactTitle) return false;
      return [...el.querySelectorAll('span')].some((s) => (s.textContent || '').trim() === 'Mazo');
    });
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length);
    const match = candidates[0];
    match.scrollIntoView({ block: 'center', inline: 'nearest' });
    const rect = match.getBoundingClientRect();
    return { found: true, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, textLength: (match.innerText || '').length };
  },

  findCollectionButton() {
    const buttons = [...document.querySelectorAll('button[aria-label]')];
    const match = buttons.find((el) => /^Ver \d+ carta/.test(el.getAttribute('aria-label') || ''));
    if (!match) return null;
    match.scrollIntoView({ block: 'center', inline: 'nearest' });
    const rect = match.getBoundingClientRect();
    return { found: true, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  },

  findBackToLibraryButton() {
    const buttons = [...document.querySelectorAll('button[aria-label]')];
    const match = buttons.find((el) => (el.getAttribute('aria-label') || '') === 'Volver a la biblioteca');
    if (!match) return null;
    match.scrollIntoView({ block: 'center', inline: 'nearest' });
    const rect = match.getBoundingClientRect();
    return { found: true, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  },

  findReturnToEditorButton() {
    const buttons = [...document.querySelectorAll('button[aria-label]')];
    const match = buttons.find((el) => (el.getAttribute('aria-label') || '') === 'Volver al modo edición');
    if (!match) return null;
    match.scrollIntoView({ block: 'center', inline: 'nearest' });
    const rect = match.getBoundingClientRect();
    return { found: true, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  },

  /** Mide la hidratación replicando las llamadas productivas sobre la caché. */
  measureHydration({ samples = 5 } = {}) {
    const decksKey = `decks_${userId}`;
    const materiasKey = `materias_${userId}`;
    const results = { decks: null, materias: null };
    const measureKey = (key) => {
      const runs = [];
      for (let i = 0; i < samples; i += 1) {
        const run = { getItem: null, parse: null, sanitize: null, total: null, status: 'ok' };
        try {
          const t0 = performance.now();
          const t1 = performance.now();
          const raw = localStorage.getItem(key);
          run.getItem = performance.now() - t1;
          run.rawCharacters = raw ? raw.length : 0;
          if (!raw) {
            run.status = 'absent';
            run.total = performance.now() - t0;
            runs.push(run);
            continue;
          }
          const t2 = performance.now();
          const parsed = JSON.parse(raw);
          run.parse = performance.now() - t2;
          run.elements = Array.isArray(parsed) ? parsed.length : null;
          const t3 = performance.now();
          if (key.startsWith('decks_') && Array.isArray(parsed)) sanitizeDeckSummaries(parsed);
          run.sanitize = performance.now() - t3;
          run.total = performance.now() - t0;
        } catch (error) {
          run.status = 'error';
          run.error = String(error);
        }
        runs.push(run);
      }
      return runs;
    };
    results.decks = measureKey(decksKey);
    results.materias = measureKey(materiasKey);
    return results;
  },

  /** Mide stringify + setItem de las colecciones reales actualmente en caché. */
  measureStorageWrites({ samples = 5 } = {}) {
    const keys = [`decks_${userId}`, `materias_${userId}`];
    const results = {};
    for (const key of keys) {
      const runs = [];
      const raw = localStorage.getItem(key);
      if (!raw) {
        results[key] = { status: 'absent', runs: [] };
        continue;
      }
      const parsed = JSON.parse(raw);
      for (let i = 0; i < samples; i += 1) {
        const run = { stringify: null, setItem: null, total: null };
        const t0 = performance.now();
        const t1 = performance.now();
        const text = JSON.stringify(parsed);
        run.stringify = performance.now() - t1;
        run.characters = text.length;
        const t2 = performance.now();
        try {
          localStorage.setItem(`__perf_write_probe__`, text);
          run.setItem = performance.now() - t2;
          localStorage.removeItem('__perf_write_probe__');
        } catch (error) {
          run.setItem = null;
          run.error = String(error);
        }
        run.total = performance.now() - t0;
        runs.push(run);
      }
      results[key] = { status: 'ok', runs };
    }
    return results;
  },

  async close() {
    const before = this.snapshot();
    root.unmount();
    await afterFrames(2);
    const after = this.snapshot();
    return {
      beforeUnmount: { memory: before.memory, domNodes: before.dom.totalNodes },
      afterUnmount: { memory: after.memory, domNodes: after.dom.totalNodes },
    };
  },
};

window.__libraryBrowserHarness = harness;

// ===========================================================================
// Montaje de la superficie real de producción
// ===========================================================================

const startedAt = performance.now();
const root = createRoot(document.getElementById('root'));
const dashboard = (
  <DashboardScreen
    user={harnessUser}
    onLogout={() => {}}
    onInviteRequired={() => {}}
  />
);
root.render(PROFILE_MODE ? <Profiler id="DashboardScreen" onRender={onRender}>{dashboard}</Profiler> : dashboard);
