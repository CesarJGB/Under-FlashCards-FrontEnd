// FILE: frontend/tests/performance/library-browser/run-browser-profile.mjs
// Fase 2B — perfil real de navegador de Library y apertura de mazos.
//
// Ejecuta los componentes REALES de producción (build de Vite en modo
// productivo + Chromium headless controlado con Playwright) contra el backend
// autorizado y mide por separado red, recepción del cuerpo, JSON.parse,
// hidratación desde safeLocalStorage, procesamiento JavaScript, renders y
// commits de React, layout, paint, tareas largas, memoria y crecimiento del
// DOM, además del tiempo hasta que Library y los mazos quedan utilizables.
//
// Garantías:
// - Únicamente GET (las preflights OPTIONS del navegador se identifican
//   aparte y no se cuentan). Guardia fail-fast: cualquier solicitud hacia
//   superficies protegidas sin contract=indexed, la lista de mazos sin
//   cover=thumbnail, cualquier solicitud legacy o cualquier método distinto
//   de GET detiene la ejecución y marca el reporte como FAIL.
// - Los identificadores reales (usuario y mazos) viven sólo en memoria de
//   este proceso; los resultados persistidos se serializan con
//   sanitizeResults() tras redactar la URL del backend y los IDs de los paths,
//   y sólo contienen aliases y agregados.
// - No se implementan optimizaciones; el harness sólo observa.
//
// Configuración:
//   PERF_TEST_USER_ID        usuario real autorizado (obligatorio)
//   VITE_BACKEND_URL         URL base del backend (obligatoria)
//   PERF_BUILD_MODE          production | profiling (default production)
//   PERF_SAMPLES             repeticiones por escenario, 1..5 (default 5)
//   PERF_HARNESS_SHA         SHA completo del Commit A (harness) — se registra
//                            como harnessSha; default: git rev-parse HEAD
//   PERF_APPLICATION_BASE_SHA SHA de la aplicación medida (default: origin/main)
//   PERF_ALLOW_DIRTY=1       permite medir con cambios rastreados (sólo debug)
//   --out <path>             salida JSON sanitizada (default raw-results-2b.json)
//   --no-trace               omite la traza CDP (no recomendado)
//   --help                   esta ayuda
//
// Reproducibilidad (flujo de dos commits): los runs finales deben ejecutarse
// desde el Commit A con el árbol limpio (cambios rastreados); el runner se
// niega a medir en caso contrario. Los artefactos declaran por separado
// applicationBaseSha (aplicación productiva) y harnessSha (Commit A).
//
// Códigos de salida: 0 (PASS), 2 (argumentos), 3 (BLOCKED), 1 (fallo).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { build, preview } from 'vite';
import { chromium } from 'playwright';
import {
  assertRequestGuard,
  buildAliases,
  buildPageTimings,
  classifyContractValue,
  classifySurface,
  correlateCdpNetwork,
  countElements,
  groupEquivalentRequests,
  isProtectedSurface,
  normalizeRequestUrl,
  pathnameToPattern,
  redactUrlIds,
  redactUrlOrigin,
  sanitizeResults,
  selectBaselineDecks,
  summarizeCommits,
  summarizeLongTasks,
  summarizeNetworkSamples,
  summarizeValues,
} from './libraryBrowserProfileUtils.mjs';

const FRONTEND_ROOT = new URL('../../../', import.meta.url).pathname;
const HARNESS_PAGE = '/tests/performance/library-browser/index.html';
const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

function parseArgs(argv) {
  const args = { out: null, noTrace: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => { i += 1; return argv[i]; };
    if (arg === '--help') args.help = true;
    else if (arg === '--out') args.out = next();
    else if (arg === '--no-trace') args.noTrace = true;
    else if (arg.startsWith('-')) throw new Error(`Argumento desconocido: ${arg}`);
    else throw new Error(`Argumento posicional no permitido: ${arg}`);
  }
  return args;
}

const USAGE = `Uso:
  node tests/performance/library-browser/run-browser-profile.mjs [opciones]

Perfil real de navegador de Library y apertura de mazos (Fase 2B).
Obligatorio:
  PERF_TEST_USER_ID=<usuario-autorizado>
  VITE_BACKEND_URL=<https://dominio-backend>
Opciones:
  PERF_BUILD_MODE=production|profiling   build a medir (default production)
  PERF_SAMPLES=1..5                      repeticiones por escenario (default 5)
  PERF_HARNESS_SHA=<sha>                 SHA completo del Commit A (harnessSha)
  PERF_APPLICATION_BASE_SHA=<sha>        SHA de la aplicación medida
  --out <path>                           salida JSON sanitizada
  --no-trace                             omite la traza CDP
  --help                                 esta ayuda

Sólo emite GET; guardia fail-fast sobre el contrato indexado; resultados
persistidos sanitizados (aliases real-user-A, C20-real, C100-real, C500-real).
Reproducibilidad: el run exige árbol limpio (Commit A) salvo PERF_ALLOW_DIRTY=1.`;

function fatal(message) {
  console.error(message);
  process.exit(2);
}

/** Limita cualquier promesa: nunca deja una espera colgada. */function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`[timeout] ${label} tras ${ms}ms`)), ms);
    Promise.resolve(promise).then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

/** page.evaluate acotado: si la página/navegador murió, falla en vez de colgar. */
const ev = (page, fn, arg, ms = 60_000, label = 'page.evaluate') =>
  withTimeout(page.evaluate(fn, arg), ms, label);

// ---------------------------------------------------------------------------
// Estado global de la ejecución
// ---------------------------------------------------------------------------

const state = {
  buildMode: process.env.PERF_BUILD_MODE === 'profiling' ? 'profiling' : 'production',
  samples: Math.min(Math.max(Number(process.env.PERF_SAMPLES) || 5, 1), 5),
  userId: process.env.PERF_TEST_USER_ID || '',
  backendUrl: (process.env.VITE_BACKEND_URL || '').replace(/\/+$/, ''),
  currentWindow: null,
  currentEntry: null,
  currentPhase: null,       // 'first' | 'warm' | null (aperturas de mazos)
  pageCrashedAt: null,
  lastCrashWindow: null,
  traceEnabled: true,
  seqCounter: 0,            // secuencia causal de solicitudes observadas
  cdpSeqCounter: 0,         // secuencia causal de entradas CDP
  cdpPreflights: 0,         // preflights OPTIONS observadas por CDP (no son solicitudes de aplicación)
  requests: [],            // todas las solicitudes backend observadas
  violations: [],          // violaciones de la guardia (fatales)
  fatalViolation: null,
  cdpNetwork: new Map(),   // CDP Network domain: requestId -> metadatos reales
  payloads: {
    deckList: null,
    materias: null,
    temas: new Map(),
    subtemas: new Map(),
    deckCards: new Map(),
  },
  perRep: [],
};

// ---------------------------------------------------------------------------
// Configuración del build y servidor
// ---------------------------------------------------------------------------

async function setupBuildAndServer() {
  const temporaryBuildDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'under-flashcards-library-browser-'));
  // Bandera de investigación: sólo el build de profiling la define; el build
  // productivo queda sin instrumentación (perfLibraryProfile inerte).
  if (state.buildMode === 'profiling') process.env.VITE_PERF_LIBRARY_PROFILE = '1';
  else delete process.env.VITE_PERF_LIBRARY_PROFILE;
  // Instrumentación de la PÁGINA del harness (body/JSON.parse/transformación):
  // ambos builds de medición la definen; el build productivo normal de la
  // aplicación no incluye la página del harness.
  process.env.VITE_PERF_HARNESS_INSTRUMENT = '1';
  const viteConfig = {
    root: FRONTEND_ROOT,
    logLevel: 'error',
    build: {
      outDir: temporaryBuildDirectory,
      emptyOutDir: true,
      rollupOptions: {
        input: {
          app: path.join(FRONTEND_ROOT, 'index.html'),
          harness: path.join(FRONTEND_ROOT, 'tests/performance/library-browser/index.html'),
        },
      },
    },
  };
  if (state.buildMode === 'profiling') {
    // Build de profiling de React (react-dom/profiling): la única forma de
    // que Profiler.onRender se dispare en un build de producción. react-dom/
    // client reexporta desde 'react-dom', por lo que el alias único cubre
    // ambos. Construcción separada y claramente identificada; nunca mezclada
    // con el build productivo normal. Sin Strict Mode.
    viteConfig.resolve = {
      alias: [
        { find: /^react-dom$/, replacement: 'react-dom/profiling' },
      ],
    };
  }
  await build(viteConfig);
  const server = await preview({
    root: FRONTEND_ROOT,
    logLevel: 'error',
    build: { outDir: temporaryBuildDirectory },
    preview: { host: 'localhost', port: PORT, strictPort: true },
  });
  return { server, temporaryBuildDirectory };
}

// ---------------------------------------------------------------------------
// Guardia de solicitudes + captura de respuestas
// ---------------------------------------------------------------------------

function attachGuard(page) {
  page.route('**/*', async (route) => {
    const request = route.request();
    const url = request.url();
    if (!url.startsWith(state.backendUrl)) return route.continue();
    const { pathname, params, normalizedUrl } = normalizeRequestUrl(url);
    const surface = classifySurface(pathname);
    const contract = classifyContractValue(params.contract);
    const cover = params.cover;
    let classification;
    try {
      classification = assertRequestGuard({ method: request.method(), urlString: url, surface, params });
    } catch (err) {
      const violation = {
        code: err.code,
        detail: err.detail,
        pathPattern: pathnameToPattern(pathname),
        method: request.method(),
        surface,
        window: state.currentWindow,
      };
      state.violations.push(violation);
      if (!state.fatalViolation) state.fatalViolation = violation;
      await route.abort('blockedbyclient');
      return;
    }
    if (classification.kind !== 'preflight') {
      state.requests.push({
        seq: state.seqCounter++,
        phase: state.currentPhase,
        normalizedUrl,
        pathPattern: pathnameToPattern(pathname),
        method: request.method().toUpperCase(),
        surface,
        contract,
        cover: cover || null,
        window: state.currentWindow,
        start: Date.now(),
        end: null,
        status: undefined,
        transferSize: null,
        encodedBodySize: null,
        decodedBodySize: null,
        ttfbMs: null,
        downloadMs: null,
        durationMs: null,
        correlation: null,
        correlationBasis: null,
      });
    }
    return route.continue();
  });

  page.on('response', async (response) => {
    const url = response.url();
    if (!url.startsWith(state.backendUrl)) return;
    const { pathname, normalizedUrl } = normalizeRequestUrl(url);
    const surface = classifySurface(pathname);
    const match = state.requests
      .filter((r) => r.normalizedUrl === normalizedUrl && r.window === state.currentWindow && r.status === undefined)
      .at(-1);
    if (match) {
      match.status = response.status();
      match.end = Date.now();
    }
    if (response.status() !== 200) return;
    try {
      const payload = await withTimeout(response.json(), 30_000, 'response.json');
      if (surface === 'deck-list' && !state.payloads.deckList) {
        state.payloads.deckList = payload;
      } else if (surface === 'materias' && !state.payloads.materias) {
        state.payloads.materias = payload;
      } else if (surface === 'temas') {
        const materiaId = pathname.split('/').pop();
        if (!state.payloads.temas.has(materiaId)) state.payloads.temas.set(materiaId, payload);
      } else if (surface === 'subtemas') {
        const data = payload;
        const temaId = pathname.split('/').pop();
        if (!state.payloads.subtemas.has(temaId)) state.payloads.subtemas.set(temaId, data);
      } else if (surface === 'deck-cards') {
        const deckId = pathname.split('/').pop();
        if (!state.payloads.deckCards.has(deckId)) state.payloads.deckCards.set(deckId, payload);
      }
    } catch { /* captura best-effort; nunca afecta la medición */ }
  });
}

/** Fusiona Resource Timing de página (bytes/TTFB/descarga) en las solicitudes. */
function mergeResourceTiming(snapshot, windowLabel) {
  if (!snapshot || !Array.isArray(snapshot.resourceEntries)) return;
  for (const entry of snapshot.resourceEntries) {
    const match = state.requests
      .filter((r) => r.normalizedUrl === entry.name && r.window === windowLabel && r.status !== undefined)
      .at(-1);
    if (!match) continue;
    // Sin Timing-Allow-Origin, requestStart/responseStart/transferSize vienen
    // enmascarados (0); sólo se fusionan valores informativos (>0).
    if (entry.requestStart > 0 && entry.responseStart > 0 && match.ttfbMs === null) {
      match.ttfbMs = entry.responseStart - entry.requestStart;
      match.downloadMs = entry.responseEnd - entry.responseStart;
    }
    if (entry.transferSize > 0) {
      match.transferSize = entry.transferSize;
      match.encodedBodySize = entry.encodedBodySize;
      match.decodedBodySize = entry.decodedBodySize;
    }
  }
}

/**
 * CDP Network domain: tamaños reales, Content-Encoding y TTFB/descarga sin
 * depender de Timing-Allow-Origin (el backend no envía cabecera de timing, por
 * lo que Resource Timing viene enmascarado). Se activa por contexto.
 * Las preflights OPTIONS del navegador se identifican por tipo CDP
 * ('Preflight') y se descartan: no son solicitudes de aplicación y, si se
 * conservaran, romperían la correlación uno a uno (cada GET generaría una
 * entrada CDP extra).
 */
function attachCdpNetwork(client) {
  client.on('Network.responseReceived', (event) => {
    if (event.type === 'Preflight') {
      state.cdpPreflights += 1;
      return;
    }
    const req = event.response;
    if (!req || !req.url || !req.url.startsWith(state.backendUrl)) return;
    const { normalizedUrl } = normalizeRequestUrl(req.url);
    const timing = req.timing || {};
    const t0 = timing.requestTime ? timing.requestTime * 1000 : null;
    state.cdpNetwork.set(event.requestId, {
      seq: state.cdpSeqCounter++,
      window: state.currentWindow,
      normalizedUrl,
      status: req.status,
      contentEncoding: (req.headers && req.headers['content-encoding']) || null,
      sendStartMs: t0 !== null && timing.sendStart != null ? t0 + timing.sendStart : null,
      receiveHeadersEndMs: t0 !== null && timing.receiveHeadersEnd != null ? t0 + timing.receiveHeadersEnd : null,
      receivedAtMs: event.timestamp != null ? event.timestamp * 1000 : null,
      finishedAtMs: null,
      encoded: 0,
      decoded: 0,
      transfer: null,
    });
  });
  client.on('Network.dataReceived', (event) => {
    const entry = state.cdpNetwork.get(event.requestId);
    if (entry) {
      entry.encoded += event.encodedDataLength || 0;
      entry.decoded += event.dataLength || 0;
    }
  });
  client.on('Network.loadingFinished', (event) => {
    const entry = state.cdpNetwork.get(event.requestId);
    if (!entry) return;
    entry.transfer = event.transferSize != null ? event.transferSize : entry.encoded;
    entry.finishedAtMs = event.timestamp != null ? event.timestamp * 1000 : null;
  });
}

/**
 * Correlación CDP uno a uno (corrección de la Fase 2B): aplica los metadatos
 * CDP a las solicitudes observadas con `correlateCdpNetwork`, que garantiza
 * que cada solicitud consume como máximo una entrada CDP y que cada entrada
 * se asigna como máximo a una solicitud. El emparejamiento ordena por
 * COMPLETACIÓN (las solicitudes abortadas/sin respuesta van al final y no
 * consumen entradas). CDP es la fuente de verdad del status y de la duración
 * (deltas internos del mismo reloj). Las solicitudes sin correlación segura
 * quedan explícitamente como `unmatched` (nunca heredan métricas de otra) y
 * se excluyen de los agregados.
 */
function applyCdpCorrelation() {
  const entries = [...state.cdpNetwork.values()];
  const { byRequest, summary } = correlateCdpNetwork(state.requests, entries);
  // Las URLs de los grupos del resumen se redactan (IDs reales -> ':id');
  // el origen se redacta después con redactUrlOrigin antes de persistir.
  summary.groups = summary.groups.map((g) => ({
    ...g,
    normalizedUrl: g.normalizedUrl ? redactUrlIds(g.normalizedUrl) : g.normalizedUrl,
  }));
  state.correlation = summary;
  for (const req of state.requests) {
    const entry = byRequest.get(req);
    if (!entry) {
      req.correlation = 'unmatched';
      req.correlationBasis = null;
      continue;
    }
    req.correlation = 'matched';
    req.correlationBasis = 'order';
    if (entry.sendStartMs !== null && entry.receiveHeadersEndMs !== null) {
      req.ttfbMs = Math.max(0, entry.receiveHeadersEndMs - entry.sendStartMs);
    }
    if (entry.receivedAtMs !== null && entry.finishedAtMs !== null) {
      req.downloadMs = Math.max(0, entry.finishedAtMs - entry.receivedAtMs);
    }
    // Status y duración reales desde CDP (mismo reloj monotónico del
    // navegador): la marca `end` del listener puede estar intercambiada en
    // solicitudes equivalentes simultáneas y no se usa para duración.
    req.status = entry.status;
    if (entry.finishedAtMs !== null && entry.sendStartMs !== null) {
      req.durationMs = Math.max(0, entry.finishedAtMs - entry.sendStartMs);
    }
    req.contentEncoding = entry.contentEncoding || null;
    if (entry.transfer !== null) req.transferSize = entry.transfer;
    req.encodedBodySize = entry.encoded;
    req.decodedBodySize = entry.decoded;
  }
}

// ---------------------------------------------------------------------------
// Traza CDP (scripting/layout/paint/raster/GC)
// ---------------------------------------------------------------------------

const TRACE_CATEGORIES = [
  'devtools.timeline',
  'disabled-by-default-devtools.timeline.frame',
  'blink',
  'cc',
  'disabled-by-default-v8.gc',
];
const INTERESTING_TRACE_EVENTS = new Set([
  'RunTask',
  'FunctionCall',
  'EventDispatch',
  'UpdateLayoutTree',
  'Layout',
  'Paint',
  'CompositeLayers',
  'RasterTask',
  'Decode Image',
  'V8.GC_CUMULATIVE',
  'V8.GC',
]);

const TRACE_EVENT_CAP = 150_000;

async function startTrace(client) {
  const events = [];
  let droppedEvents = 0;
  client.on('Tracing.dataCollected', ({ value }) => {
    if (events.length >= TRACE_EVENT_CAP) {
      droppedEvents += Array.isArray(value) ? value.length : 1;
      return;
    }
    events.push(...value);
  });
  const complete = new Promise((resolve) => client.once('Tracing.tracingComplete', resolve));
  await withTimeout(client.send('Tracing.start', {
    categories: TRACE_CATEGORIES.join(','),
    options: 'sampling-frequency=10000',
    transferMode: 'ReportEvents',
  }), 30_000, 'Tracing.start');
  return { events, complete, droppedEvents };
}

function summarizeTraceEvents(events) {
  const totals = {};
  for (const event of events) {
    if (typeof event.dur !== 'number') continue;
    const name = String(event.name);
    if (!INTERESTING_TRACE_EVENTS.has(name) && !name.startsWith('V8.GC')) continue;
    const entry = totals[name] || { count: 0, durationMs: 0 };
    entry.count += 1;
    entry.durationMs += event.dur / 1000;
    totals[name] = entry;
  }
  return totals;
}

// ---------------------------------------------------------------------------
// Página del harness
// ---------------------------------------------------------------------------

async function openHarnessPage(browser, { seed = null, window: navWindow, trace = true } = {}) {
  const context = await withTimeout(browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  }), 60_000, 'browser.newContext');
  if (seed) {
    await withTimeout(context.addInitScript(({ decks, materias, userId }) => {
      try {
        if (Array.isArray(decks)) localStorage.setItem(`decks_${userId}`, JSON.stringify(decks));
        if (Array.isArray(materias)) localStorage.setItem(`materias_${userId}`, JSON.stringify(materias));
      } catch { /* siembra best-effort */ }
    }, { decks: seed.decks, materias: seed.materias, userId: state.userId }), 30_000, 'addInitScript');
  }
  const page = await withTimeout(context.newPage(), 60_000, 'context.newPage');
  page.on('crash', () => {
    state.pageCrashedAt = Date.now();
    state.lastCrashWindow = navWindow || 'unknown';
    console.error(`[2B] PÁGINA CRASHEADA en ventana ${state.lastCrashWindow}`);
  });
  await page.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, (route) => route.abort());
  attachGuard(page);
  const client = await withTimeout(context.newCDPSession(page), 30_000, 'newCDPSession');
  try {
    await withTimeout(client.send('Network.enable'), 15_000, 'Network.enable');
  } catch { /* CDP Network no disponible; se usan las marcas propias del runner */ }
  attachCdpNetwork(client);
  const traceSession = trace && state.traceEnabled ? await startTrace(client) : null;
  state.currentWindow = navWindow || 'default';
  await withTimeout(page.goto(`${BASE_URL}${HARNESS_PAGE}?userId=${encodeURIComponent(state.userId)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  }), 90_000, 'page.goto');
  const entry = { context, page, client, traceSession };
  state.currentEntry = entry;
  return entry;
}

async function closeHarnessPage(entry) {
  if (state.currentEntry === entry) state.currentEntry = null;
  let trace = null;
  if (entry.traceSession) {
    try {
      await withTimeout(entry.client.send('Tracing.end'), 20_000, 'Tracing.end');
      await withTimeout(entry.traceSession.complete, 20_000, 'Tracing.complete');
    } catch { /* traza parcial: se resume lo capturado y se continúa */ }
    trace = summarizeTraceEvents(entry.traceSession.events);
    trace.droppedEvents = entry.traceSession.droppedEvents;
    entry.traceSession.events.length = 0; // libera la memoria de eventos crudos
  }
  try { await withTimeout(entry.client.detach(), 10_000, 'client.detach'); } catch { /* ya separado */ }
  try { await withTimeout(entry.context.close(), 15_000, 'context.close'); } catch { /* contexto ya cerrado */ }
  return trace;
}

/** Cierre forzoso del contexto/página actual (nunca lanza). */
async function forceCloseEntry() {
  const entry = state.currentEntry;
  if (!entry) return;
  state.currentEntry = null;
  try { await withTimeout(entry.client.detach(), 5_000, 'force client.detach'); } catch { /* ignorado */ }
  try { await withTimeout(entry.context.close(), 10_000, 'force context.close'); } catch { /* ignorado */ }
}

// Utilidades de interacción ---------------------------------------------------

async function clickByRole(page, name, { exact = true } = {}) {
  await page.getByRole('button', { name, exact }).first().click({ timeout: 15_000 });
}

/** Clic en una carpeta por nombre (materias/temas/subtemas son botones o divs). */
async function clickFolderByText(page, name) {
  const target = page.getByText(name, { exact: true }).first();
  if (await target.count() === 0) {
    // Desplegar todas las carpetas si el objetivo está en el overflow de materias.
    const overflow = page.getByRole('button').filter({ hasText: 'Ver todas' }).first();
    if (await overflow.count() > 0) {
      await overflow.click({ timeout: 10_000 });
      await page.waitForTimeout(250);
    }
    const retry = page.getByText(name, { exact: true }).first();
    if (await retry.count() === 0) throw new Error('carpeta no encontrada en la jerarquía');
    await retry.click({ timeout: 15_000 });
    return;
  }
  await target.click({ timeout: 15_000 });
}

/** Cierra cualquier diálogo/hoja residual antes de la siguiente interacción. */
async function dismissDialogs(page) {
  const open = await page.locator('[role="dialog"]').count();
  if (open > 0) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
  }
}

async function clickDeckCard(page, title, count) {
  const target = await ev(page, ([t, c]) => window.__libraryBrowserHarness.findDeckCard(t, c), [title, count]);
  if (!target || !target.found) return { ok: false, reason: 'deck-card-not-found' };
  await page.mouse.click(target.x, target.y);
  return { ok: true };
}

async function openDeckCollection(page, expectedCount) {
  const target = await ev(page, () => window.__libraryBrowserHarness.findCollectionButton());
  if (!target || !target.found) return { ok: false, reason: 'collection-button-not-found' };
  await page.mouse.click(target.x, target.y);
  const usable = await ev(page, (n) => window.__libraryBrowserHarness.whenDeckUsable(n), expectedCount, 60_000, 'whenDeckUsable');
  return { ok: usable.ok, elapsedMs: usable.elapsedMs };
}

async function exitDeckToLibrary(page) {
  // En vista colección el botón vuelve al editor; luego "Volver a la biblioteca".
  const toEditor = await ev(page, () => window.__libraryBrowserHarness.findReturnToEditorButton());
  if (toEditor && toEditor.found) await page.mouse.click(toEditor.x, toEditor.y);
  await page.waitForTimeout(150);
  const toLibrary = await ev(page, () => window.__libraryBrowserHarness.findBackToLibraryButton());
  if (!toLibrary || !toLibrary.found) return { ok: false, reason: 'back-button-not-found' };
  await page.mouse.click(toLibrary.x, toLibrary.y);
  return { ok: true };
}

async function searchDeckAndOpen(page, deck) {
  // Nivel real del mazo según su jerarquía en la respuesta indexada.
  const level = deck.subtemaId ? 'subtemas-with-deck'
    : deck.temaId ? 'subtemas'
      : deck.parcialNumber ? 'temas'
        : deck.materiaId ? 'parciales'
          : 'root';
  // La búsqueda global sólo incluye mazos con materiaId; los mazos sin
  // clasificar son directamente visibles en la raíz ("Mazos sin clasificar").
  if (deck.materiaId) {
    await page.locator('input[aria-label="Buscar..."]').fill(deck.title);
    await page.getByText('Resultados (', { exact: false }).first().waitFor({ timeout: 15_000 });
    const target = await ev(page, (t) => window.__libraryBrowserHarness.findDeckSearchResult(t), deck.title, 30_000, 'findDeckSearchResult');
    if (target && target.found) {
      await page.mouse.click(target.x, target.y);
    } else {
      await page.getByText(deck.title, { exact: true }).first().click({ timeout: 15_000 });
    }
  }
  const levelWait = await ev(page, (l) => window.__libraryBrowserHarness.whenLibraryLevel(l), level, 60_000, 'whenLibraryLevel');
  if (!levelWait.ok) return { ok: false, reason: `level-not-reached:${level}`, dump: await dumpPage(page) };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Escenarios
// ---------------------------------------------------------------------------

async function runB1(browser) {
  const entry = await openHarnessPage(browser, { window: 'B1-cold-start' });
  const t0 = Date.now();
  const home = await ev(entry.page, () => window.__libraryBrowserHarness.whenHomeUsable(), undefined, 60_000, 'whenHomeUsable');
  const homeUsableMs = Date.now() - t0;
  if (!home.ok) throw new Error(`B1: Home no quedó estable (${home.elapsedMs}ms)`);
  const snapshot = await ev(entry.page, () => window.__libraryBrowserHarness.snapshot({ includeResource: true }));
  const hydration = await ev(entry.page, (n) => window.__libraryBrowserHarness.measureHydration({ samples: n }), state.samples);
  const storageWrites = await ev(entry.page, (n) => window.__libraryBrowserHarness.measureStorageWrites({ samples: n }), state.samples);
  const trace = await closeHarnessPage(entry);
  mergeResourceTiming(snapshot, 'B1-cold-start');
  return { homeUsableMs, snapshot, hydration, storageWrites, trace };
}

async function runB2(browser, seed) {
  const entry = await openHarnessPage(browser, { seed, window: 'B2-warm-start', trace: false });
  const hydration = await ev(entry.page, (n) => window.__libraryBrowserHarness.measureHydration({ samples: n }), state.samples);
  const t0 = Date.now();
  const home = await ev(entry.page, () => window.__libraryBrowserHarness.whenHomeUsable(), undefined, 60_000, 'whenHomeUsable');
  const homeUsableMs = Date.now() - t0;
  const snapshot = await ev(entry.page, () => window.__libraryBrowserHarness.snapshot({ includeResource: true }));
  const trace = await closeHarnessPage(entry);
  mergeResourceTiming(snapshot, 'B2-warm-start');
  return { homeUsableMs: home.ok ? homeUsableMs : null, snapshot, hydration, trace };
}

async function runB3(browser, { seed, warm }) {
  const windowLabel = warm ? 'B3-warm-entry' : 'B3-cold-entry';
  const entry = await openHarnessPage(browser, { seed, window: windowLabel });
  const home = await ev(entry.page, () => window.__libraryBrowserHarness.whenHomeUsable(), undefined, 60_000, 'whenHomeUsable');
  if (!home.ok) throw new Error(`B3(${warm ? 'warm' : 'cold'}): Home no estable`);
  const memoryBefore = await ev(entry.page, () => window.__libraryBrowserHarness.sampleMemory());

  const markStart = Date.now();
  await ev(entry.page, () => window.__libraryBrowserHarness.mark('library-entry'));
  await clickByRole(entry.page, 'Biblioteca');
  const interaction = await ev(entry.page, () => window.__libraryBrowserHarness.whenLibraryInteractionEnabled());
  const tInteraction = Date.now() - markStart;
  const content = await ev(entry.page, () => window.__libraryBrowserHarness.whenLibraryContentVisible());
  const tContent = Date.now() - markStart;
  const stable = await ev(entry.page, () => window.__libraryBrowserHarness.whenLibraryUsable(), undefined, 60_000, 'whenLibraryUsable');
  const tStable = Date.now() - markStart;
  await ev(entry.page, () => window.__libraryBrowserHarness.markEnd('library-entry'));

  const memoryAfter = await ev(entry.page, () => window.__libraryBrowserHarness.sampleMemory());
  const cdpMetrics = await withTimeout(entry.client.send('Performance.getMetrics'), 15_000, 'Performance.getMetrics').catch(() => null);
  const snapshot = await ev(entry.page, () => window.__libraryBrowserHarness.snapshot({ includeResource: true }));
  const trace = await closeHarnessPage(entry);
  mergeResourceTiming(snapshot, windowLabel);
  return {
    ok: Boolean(interaction.ok && content.ok && stable.ok),
    toInteractionMs: tInteraction,
    toContentMs: tContent,
    toStableMs: tStable,
    memoryBefore,
    memoryAfter,
    cdpMetrics,
    snapshot,
    trace,
  };
}

/** Diagnóstico de página (sólo para errores; se redacta antes de persistir). */
const dumpPage = (page) => ev(page, () => window.__libraryBrowserHarness.debugDump(), undefined, 15_000, 'debugDump').catch(() => null);

/**
 * Redacta un dump de diagnóstico para que pueda persistirse en resultados de
 * error sin filtrar nombres reales, la URL del backend o IDs reales.
 */
function buildKnownNames() {
  const names = new Set();
  for (const m of state.payloads.materias || []) if (m && m.name) names.add(String(m.name));
  for (const list of state.payloads.temas.values()) {
    if (Array.isArray(list)) for (const t of list) if (t && t.name) names.add(String(t.name));
  }
  for (const list of state.payloads.subtemas.values()) {
    if (Array.isArray(list)) for (const s of list) if (s && s.name) names.add(String(s.name));
  }
  for (const d of state.payloads.deckList || []) if (d && d.title) names.add(String(d.title));
  return names;
}

function redactDump(dump) {
  if (!dump) return null;
  let out = JSON.stringify(dump);
  for (const name of buildKnownNames()) {
    out = out.split(name).join('<nombre>');
  }
  if (state.backendUrl) out = out.split(state.backendUrl).join('<backend-url>');
  out = out.replace(/[0-9a-f]{24}/g, '<id>');
  return out.slice(0, 600);
}

async function runB4(browser, seed) {
  const entry = await openHarnessPage(browser, { seed, window: 'B4-library-processing' });
  const home = await ev(entry.page, () => window.__libraryBrowserHarness.whenHomeUsable(), undefined, 60_000, 'whenHomeUsable');
  if (!home.ok) throw new Error('B4: Home no estable');
  await clickByRole(entry.page, 'Biblioteca');
  const lib = await ev(entry.page, () => window.__libraryBrowserHarness.whenLibraryUsable(), undefined, 60_000, 'whenLibraryUsable');
  if (!lib.ok) throw new Error('B4: Library no utilizable');

  const deckList = state.payloads.deckList || [];
  const materias = state.payloads.materias || [];
  // Nombres reales conocidos (sólo memoria) para redactar errores persistidos.
  const knownNames = buildKnownNames();
  const redactError = (error) => {
    let message = String(error && error.stack ? error.stack : error);
    for (const name of knownNames) {
      message = message.split(name).join('<nombre>');
    }
    if (state.backendUrl) message = message.split(state.backendUrl).join('<backend-url>');
    message = message.replace(/[0-9a-f]{24}/g, '<id>');
    return message.slice(0, 200);
  };
  const opResults = [];
  const runOp = async (name, input, task) => {
    const t0 = Date.now();
    await ev(entry.page, (n) => window.__libraryBrowserHarness.mark(`op:${n}`), name);
    let outputCardinality = null;
    try {
      outputCardinality = await task();
    } catch (error) {
      await ev(entry.page, (n) => window.__libraryBrowserHarness.markEnd(`op:${n}`), name);
      opResults.push({ op: name, status: 'failed', error: redactError(error), durationMs: Date.now() - t0 });
      return;
    }
    await ev(entry.page, (n) => window.__libraryBrowserHarness.markEnd(`op:${n}`), name);
    opResults.push({
      op: name,
      status: 'ok',
      inputCardinality: input,
      outputCardinality,
      durationMs: Date.now() - t0,
      insideCommit: state.buildMode === 'profiling',
    });
  };
  const countH4 = () => ev(entry.page, () => document.querySelectorAll('[data-testid="library-section"] h4').length);

  // Path de referencia: primer mazo con subtema (fallback tema/parcial).
  const pathDeck = deckList.find((d) => d.subtemaId) || deckList.find((d) => d.temaId) || deckList.find((d) => d.parcialNumber) || null;
  const materia = pathDeck ? materias.find((m) => String(m._id || m.id) === String(pathDeck.materiaId)) : null;

  // 1. Filtro por path académico (materia → parcial → tema → subtema).
  if (pathDeck && materia) {
    const parcialLabel = { 1: 'Primer parcial', 2: 'Segundo parcial', 3: 'Tercer parcial' }[pathDeck.parcialNumber] || null;
    await runOp('path-filter-materia', materias.length, async () => {
      await clickFolderByText(entry.page, materia.name);
      const w = await ev(entry.page, () => window.__libraryBrowserHarness.whenLibraryLevel('parciales'));
      if (!w.ok) throw new Error(`nivel parciales no alcanzado: ${JSON.stringify(await dumpPage(entry.page))}`);
      return countH4();
    });

    if (parcialLabel) {
      await runOp('path-filter-parcial', 3, async () => {
        await entry.page.getByText(parcialLabel, { exact: true }).first().click({ timeout: 15_000 });
        const w = await ev(entry.page, () => window.__libraryBrowserHarness.whenLibraryLevel('temas'));
        if (!w.ok) throw new Error(`nivel temas no alcanzado: ${JSON.stringify(await dumpPage(entry.page))}`);
        return countH4();
      });

      const temasForMateria = state.payloads.temas.get(String(pathDeck.materiaId)) || [];
      const tema = pathDeck.temaId ? temasForMateria.find((t) => String(t._id) === String(pathDeck.temaId)) : null;
      if (tema) {
        await runOp('path-filter-tema', temasForMateria.length, async () => {
          await clickFolderByText(entry.page, tema.name);
          const w = await ev(entry.page, () => window.__libraryBrowserHarness.whenLibraryLevel('subtemas'));
          if (!w.ok) throw new Error(`nivel subtemas no alcanzado: ${JSON.stringify(await dumpPage(entry.page))}`);
          return countH4();
        });

        const subtemasForTema = state.payloads.subtemas.get(String(pathDeck.temaId)) || [];
        const subtema = pathDeck.subtemaId ? subtemasForTema.find((s) => String(s._id) === String(pathDeck.subtemaId)) : null;
        if (subtema) {
          await runOp('path-filter-subtema', subtemasForTema.length, async () => {
            await clickFolderByText(entry.page, subtema.name);
            const w = await ev(entry.page, () => window.__libraryBrowserHarness.whenLibraryLevel('subtemas-with-deck'));
            if (!w.ok) throw new Error(`nivel subtema con mazo no alcanzado: ${JSON.stringify(await dumpPage(entry.page))}`);
            return countH4();
          });
        }
      }
    }
  } else {
    opResults.push({ op: 'path-filter-*', status: 'not-run', reason: 'sin mazo con path académico completo en los datos' });
  }

  // Reset a raíz (breadcrumb "Biblioteca" dentro de la sección).
  await runOp('path-filter-reset', 1, async () => {
    await entry.page.locator('[data-testid="library-section"] button').filter({ hasText: 'Biblioteca' }).first().click({ timeout: 15_000 });
    const w = await ev(entry.page, () => window.__libraryBrowserHarness.whenLibraryLevel('root'));
    if (!w.ok) throw new Error(`raíz no alcanzada: ${JSON.stringify(await dumpPage(entry.page))}`);
    return countH4();
  });

  // 2. Búsquedas.
  const input = entry.page.locator('input[aria-label="Buscar..."]');
  await runOp('search-no-match', deckList.length, async () => {
    await input.fill('zzz-no-match-000');
    await entry.page.getByText('No se encontraron resultados.', { exact: false }).first().waitFor({ timeout: 15_000 });
    await input.fill('');
    return 0;
  });

  const probeDeck = deckList.find((d) => d.title && String(d.title).trim().length >= 4);
  if (probeDeck) {
    const probe = String(probeDeck.title).trim().slice(0, 4);
    await runOp('search-with-match', deckList.length, async () => {
      await input.fill(probe);
      const heading = entry.page.getByText(/^Resultados \(\d+\)$/).first();
      await heading.waitFor({ timeout: 15_000 });
      const text = await heading.innerText();
      const match = text.match(/\((\d+)\)/);
      const count = match ? Number(match[1]) : null;
      await input.fill('');
      return count;
    });
  } else {
    opResults.push({ op: 'search-with-match', status: 'not-run', reason: 'sin título utilizable' });
  }

  // 3. Ordenamientos.
  const sortLabels = [
    ['sort-recent', 'Más recientes'],
    ['sort-oldest', 'Más antiguos'],
    ['sort-alpha', 'Orden alfabético'],
    ['sort-cards-desc', 'Mayor número de tarjetas'],
    ['sort-cards-asc', 'Menor número de tarjetas'],
  ];
  for (const [name, label] of sortLabels) {
    await runOp(name, deckList.length, async () => {
      await dismissDialogs(entry.page);
      await clickByRole(entry.page, 'Abrir opciones de ordenamiento');
      const option = entry.page.getByRole('dialog').getByRole('button', { name: label, exact: true }).first();
      await option.click({ timeout: 15_000 });
      await entry.page.getByRole('dialog').waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {});
      await entry.page.waitForTimeout(250);
      return ev(entry.page, () => document.querySelectorAll('[data-testid="library-section"] button').length);
    });
  }

  // 4. Conteos por materia/tema/subtema (renders que los computan).
  await runOp('counts-materia', materias.length, async () => {
    const w = await ev(entry.page, () => window.__libraryBrowserHarness.whenLibraryLevel('root'));
    if (!w.ok) throw new Error(`raíz no alcanzada: ${JSON.stringify(await dumpPage(entry.page))}`);
    const badge = await ev(entry.page, () => {
      const m = document.body.innerText.match(/Tus Materias\s*\n?\s*(\d+)/i);
      return m ? Number(m[1]) : null;
    });
    return badge;
  });

  if (pathDeck && materia) {
    await runOp('counts-tema', materias.length, async () => {
      await clickFolderByText(entry.page, materia.name);
      const parcialLabel = { 1: 'Primer parcial', 2: 'Segundo parcial', 3: 'Tercer parcial' }[pathDeck.parcialNumber] || null;
      if (parcialLabel) {
        await entry.page.getByText(parcialLabel, { exact: true }).first().click({ timeout: 15_000 });
      }
      const w = await ev(entry.page, () => window.__libraryBrowserHarness.whenLibraryLevel('temas'));
      if (!w.ok) throw new Error(`nivel temas no alcanzado: ${JSON.stringify(await dumpPage(entry.page))}`);
      return ev(entry.page, () => {
        const m = document.body.innerText.match(/(\d+)\s+mazo/);
        return m ? Number(m[1]) : null;
      });
    });
  }

  if (pathDeck && pathDeck.temaId && state.payloads.subtemas.has(String(pathDeck.temaId))) {
    await runOp('counts-subtema', materias.length, async () => {
      const temasForMateria = state.payloads.temas.get(String(pathDeck.materiaId)) || [];
      const tema = temasForMateria.find((t) => String(t._id) === String(pathDeck.temaId));
      if (!tema) throw new Error('tema no encontrado');
      await clickFolderByText(entry.page, tema.name);
      const w = await ev(entry.page, () => window.__libraryBrowserHarness.whenLibraryLevel('subtemas'));
      if (!w.ok) throw new Error(`nivel subtemas no alcanzado: ${JSON.stringify(await dumpPage(entry.page))}`);
      return ev(entry.page, () => {
        const m = document.body.innerText.match(/(\d+)\s+mazo/);
        return m ? Number(m[1]) : null;
      });
    });
  }

  // 5. Enriquecimiento y conteos de Home.
  await runOp('home-enrichment', deckList.length, async () => {
    await clickByRole(entry.page, 'Inicio');
    const w = await ev(entry.page, () => window.__libraryBrowserHarness.whenHomeUsable(), undefined, 60_000, 'whenHomeUsable');
    if (!w.ok) throw new Error('Home no estable tras regresar');
    return null;
  });

  const memoryAfter = await ev(entry.page, () => window.__libraryBrowserHarness.sampleMemory());
  const snapshot = await ev(entry.page, () => window.__libraryBrowserHarness.snapshot({ includeResource: true }));
  const trace = await closeHarnessPage(entry);
  mergeResourceTiming(snapshot, 'B4-library-processing');
  return { opResults, memoryAfter, snapshot, trace };
}

async function runDeckScenario(browser, seed, { alias, target }) {
  const windowLabel = `B${target}-${alias}`;
  const entry = await openHarnessPage(browser, { seed, window: windowLabel });
  const home = await ev(entry.page, () => window.__libraryBrowserHarness.whenHomeUsable(), undefined, 60_000, 'whenHomeUsable');
  if (!home.ok) throw new Error(`${alias}: Home no estable`);
  await clickByRole(entry.page, 'Biblioteca');
  const lib = await ev(entry.page, () => window.__libraryBrowserHarness.whenLibraryUsable(), undefined, 60_000, 'whenLibraryUsable');
  if (!lib.ok) throw new Error(`${alias}: Library no utilizable`);

  const deck = (state.payloads.deckList || []).find((d) => String(d.id) === String(seed.selected[alias].deckId));
  if (!deck) throw new Error(`${alias}: mazo seleccionado no presente en la respuesta indexada`);

  const first = await openDeckOnce(entry, deck, target, 'first');
  if (!first.ok) throw new Error(`${alias}: apertura inicial fallida: ${first.reason}${first.dump ? ` (dump: ${first.dump})` : ''}`);

  // Cerrar (volver a la biblioteca) y reabrir en caliente: tras el regreso
  // quedamos en el mismo nivel de carpeta, donde la tarjeta del mazo sigue
  // visible; la reapertura caliente hace clic directo sobre ella (sin buscar).
  const back = await exitDeckToLibrary(entry.page);
  if (!back.ok) throw new Error(`${alias}: botón de regreso no encontrado`);
  const backUsable = await ev(entry.page, () => window.__libraryBrowserHarness.whenLibraryBackUsable(), undefined, 60_000, 'whenLibraryBackUsable');
  const warm = await openDeckOnce(entry, deck, target, 'warm', { skipSearch: true });

  // Memoria diagnóstica tras GC explícito (CDP; etiquetada como diagnóstica).
  let afterGc = null;
  try {
    await withTimeout(entry.client.send('HeapProfiler.enable'), 15_000, 'HeapProfiler.enable');
    await withTimeout(entry.client.send('HeapProfiler.collectGarbage'), 15_000, 'HeapProfiler.collectGarbage');
    afterGc = await ev(entry.page, () => window.__libraryBrowserHarness.sampleMemory());
  } catch { /* GC no disponible */ }

  const snapshot = await ev(entry.page, () => window.__libraryBrowserHarness.snapshot({ includeResource: true }));
  const trace = await closeHarnessPage(entry);
  mergeResourceTiming(snapshot, windowLabel);
  return { first, backUsable, warm, afterGc, snapshot, trace };
}

async function openDeckOnce(entry, deck, target, kind, { skipSearch = false } = {}) {
  const t0 = Date.now();
  state.currentPhase = kind;
  await ev(entry.page, (k) => window.__libraryBrowserHarness.mark(`deck-open:${k}`), kind);
  if (!skipSearch) {
    const searched = await searchDeckAndOpen(entry.page, deck);
    if (!searched.ok) {
      state.currentPhase = null;
      return { ok: false, reason: searched.reason, dump: redactDump(searched.dump) };
    }
  }
  const card = await clickDeckCard(entry.page, deck.title, target);
  if (!card.ok) {
    state.currentPhase = null;
    return { ok: false, reason: card.reason };
  }
  await entry.page.locator('[data-testid="deck-interior"]').waitFor({ timeout: 15_000 });
  const collection = await openDeckCollection(entry.page, target);
  if (!collection.ok) {
    state.currentPhase = null;
    return { ok: false, reason: collection.reason };
  }
  await ev(entry.page, (k) => window.__libraryBrowserHarness.markEnd(`deck-open:${k}`), kind);
  state.currentPhase = null;
  const durationMs = Date.now() - t0;

  // Verificación de cardinalidad exacta desde la respuesta indexada capturada.
  const payload = state.payloads.deckCards.get(deck.id);
  const elements = payload ? countElements(payload, 'deck-cards') : null;
  const memoryAfter = await ev(entry.page, () => window.__libraryBrowserHarness.sampleMemory());
  return {
    ok: true,
    kind,
    durationMs,
    collectionMs: collection.elapsedMs,
    verifiedElements: elements,
    cardinalityExact: elements === target,
    memoryAfter,
  };
}

// ---------------------------------------------------------------------------
// Orquestación
// ---------------------------------------------------------------------------

/** Métricas de red persistidas como `*Aggregate` (una muestra por solicitud). */
const NETWORK_METRICS = ['ttfbMs', 'downloadMs', 'durationMs', 'transferSize', 'encodedBodySize', 'decodedBodySize'];

/** Resumen por repetición de una medición de hidratación (agregados, sin crudos). */
function hydrationSummary(hydration) {
  if (!hydration) return null;
  const summarizeKey = (key) => {
    const runs = hydration[key];
    if (!Array.isArray(runs)) return { status: 'absent', runs: 0 };
    return {
      status: runs.every((r) => r.status === 'ok') ? 'ok' : [...new Set(runs.map((r) => r.status))].join(','),
      runs: runs.length,
      totalAggregate: summarizeValues(runs.map((r) => r.total)),
      getItemAggregate: summarizeValues(runs.map((r) => r.getItem)),
      parseAggregate: summarizeValues(runs.map((r) => r.parse)),
      sanitizeAggregate: summarizeValues(runs.map((r) => r.sanitize)),
    };
  };
  return { decks: summarizeKey('decks'), materias: summarizeKey('materias') };
}

/**
 * Registro por repetición persistido de un snapshot de página: DOM, memoria,
 * long tasks (con alcance de ventana), timings de body/parse/transformación y
 * React (sólo profiling). Nunca contiene URLs, IDs, contenido ni stacks.
 */
function buildSnapshotRecord(snapshot, { scope = null } = {}) {
  if (!snapshot) return null;
  const record = {
    dom: snapshot.dom || null,
    memory: snapshot.memory || null,
    longTasks: summarizeLongTasks(snapshot.longTasks, { scope, observed: snapshot.longTaskObserverActive !== false }),
    markIntervals: (snapshot.markIntervals || []).map((m) => ({
      // `mark`, no `name`: la serialización de resultados prohíbe la clave
      // `name` (nombres reales); los identificadores de marcas no son
      // sensibles pero se evita la colisión con la regla de sanitización.
      mark: m.name,
      start: Math.round(m.start),
      end: m.end == null ? null : Math.round(m.end),
    })),
  };
  const timings = buildPageTimings(snapshot.fetchRecords);
  if (Object.keys(timings).length > 0) record.pageTimings = timings;
  if (state.buildMode === 'profiling' && Array.isArray(snapshot.commits)) {
    record.react = {
      renderCounts: snapshot.perfProfile && snapshot.perfProfile.renderCounts ? snapshot.perfProfile.renderCounts : null,
      loaderInvocations: snapshot.perfProfile && snapshot.perfProfile.loaderInvocations ? snapshot.perfProfile.loaderInvocations : null,
      commitsSummary: summarizeCommits(snapshot.commits),
      commits: snapshot.commits.map((c) => ({
        id: c.id,
        phase: c.phase,
        actualDuration: c.actualDuration,
        baseDuration: c.baseDuration,
        startTime: c.startTime,
        commitTime: c.commitTime,
        bucket: c.bucket,
      })),
    };
  }
  return record;
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    return fatal(`Error: ${err.message}\n\n${USAGE}`);
  }
  if (args.help) {
    console.log(USAGE);
    process.exit(0);
  }
  state.traceEnabled = !args.noTrace;

  if (!state.userId || !/^[0-9a-f]{24}$/.test(state.userId)) {
    return fatal('PERF_TEST_USER_ID ausente o inválido (ObjectId de 24 hex obligatorio).');
  }
  if (!state.backendUrl || !/^https?:\/\//.test(state.backendUrl)) {
    return fatal('VITE_BACKEND_URL ausente o inválida (URL http(s) obligatoria).');
  }

  let appBaseSha = process.env.PERF_APPLICATION_BASE_SHA || 'UNKNOWN';
  try {
    appBaseSha = process.env.PERF_APPLICATION_BASE_SHA
      || execSync('git rev-parse origin/main', { encoding: 'utf8' }).trim()
      || execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch { /* sin git; se usa PERF_APPLICATION_BASE_SHA si está definido */ }
  let harnessSha = process.env.PERF_HARNESS_SHA || 'UNKNOWN';
  try {
    harnessSha = process.env.PERF_HARNESS_SHA || execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch { /* sin git; se usa PERF_HARNESS_SHA si está definido */ }

  // Reproducibilidad: los runs finales deben ejecutarse desde el Commit A con
  // el árbol limpio (cambios rastreados; los archivos sin seguimiento ajenos
  // no bloquean). PERF_ALLOW_DIRTY=1 desactiva la comprobación.
  if (process.env.PERF_ALLOW_DIRTY !== '1') {
    try {
      const dirty = execSync('git status --porcelain --untracked-files=no', { encoding: 'utf8' }).trim();
      if (dirty.length > 0) {
        return fatal(`Árbol con cambios rastreados sin commitear; los resultados no serían reproducibles.\n${dirty}\n(Commit A obligatorio antes de medir; PERF_ALLOW_DIRTY=1 sólo para depuración.)`);
      }
    } catch { /* sin git: no se puede comprobar */ }
  }

  console.log(`[2B] buildMode=${state.buildMode} samples=${state.samples} applicationBaseSha=${appBaseSha} harnessSha=${harnessSha}`);

  const { server, temporaryBuildDirectory } = await setupBuildAndServer();
  console.log(`[2B] servidor listo en ${BASE_URL} (build productivo + página de harness)`);

  let browser = null;
  let browserCrashes = 0;
  let intentionalBrowserClose = false;
  // Memoria precisa para performance.memory en headless (sólo medición).
  const LAUNCH_ARGS = ['--enable-precise-memory-info'];
  const launchBrowser = async () => {
    const launched = await withTimeout(chromium.launch({ headless: true, args: LAUNCH_ARGS }), 120_000, 'chromium.launch');
    launched.on('disconnected', () => {
      if (!intentionalBrowserClose) {
        browserCrashes += 1;
        console.error(`[2B] navegador desconectado (crash #${browserCrashes})`);
      }
    });
    return launched;
  };

  const results = {
    schemaVersion: '3.0.0',
    kind: 'under-flashcards-library-browser-profile',
    buildMode: state.buildMode,
    mode: state.buildMode,
    applicationBaseSha: appBaseSha,
    harnessSha,
    measuredAtUtc: new Date().toISOString(),
    user: 'real-user-A',
    samplesRequested: state.samples,
    samplesValid: 0,
    // Objetos con `samples` (los agregados no sobreviven en arrays JSON).
    scenarios: { B1: { samples: [] }, B2: { samples: [] }, B3: { cold: [], warm: [] }, B4: { ops: [], reps: [] }, B5: { samples: [] }, B6: { samples: [] }, B7: { samples: [] } },
    storage: {},
    pageTimings: {},
    longTasks: {},
    errors: [],
    notMeasured: [],
  };

  let firstSeed = null;
  let selected = null;

  const truncateError = (error) => String(error && error.stack ? error.stack : error).slice(0, 200);
  // Sonda de disponibilidad de Chromium (el bucle usa un navegador fresco por
  // escenario; aquí sólo se verifica que el binario arranca).
  try {
    const probe = await withTimeout(chromium.launch({ headless: true, args: LAUNCH_ARGS }), 120_000, 'chromium.launch-probe');
    await withTimeout(probe.close(), 30_000, 'probe.close');
  } catch (error) {
    await new Promise((resolve) => server.httpServer.close(resolve));
    console.error(`[2B] BLOCKED — binario Chromium no disponible: ${String(error).slice(0, 500)}`);
    process.exit(3);
  }
  const runScenario = async (rep, label, task) => {
    try {
      // Aislamiento: navegador fresco por escenario. Un crash o una traza
      // atascada en una ventana nunca contamina la siguiente; el cierre del
      // navegador también libera la memoria de la traza anterior.
      await forceCloseEntry();
      if (browser && browser.isConnected()) {
        intentionalBrowserClose = true;
        try { await withTimeout(browser.close(), 30_000, 'browser.close'); } catch { /* ya cerrado */ }
        intentionalBrowserClose = false;
      }
      browser = await launchBrowser();
      return await withTimeout(task(), 420_000, label);
    } catch (error) {
      const message = truncateError(error);
      results.errors.push(`[rep ${rep}] ${label}: ${message}`);
      console.error(`[2B] rep ${rep}: ${label} ERROR ${message}`);
      return null;
    }
  };

  for (let rep = 1; rep <= state.samples; rep += 1) {
    console.log(`[2B] repetición ${rep}/${state.samples}`);
    if (state.fatalViolation) break;
    const repResult = { rep };
    try {
      // B1 — arranque frío (también captura los datos reales para sembrar).
      const b1 = await runScenario(rep, 'B1', () => runB1(browser));
      if (!b1) throw new Error('B1 fallido (sin datos reales capturados)');
      repResult.b1 = b1;
      console.log(`[2B] rep ${rep}: B1 ok (${Math.round(b1.homeUsableMs)}ms)`);
      if (state.payloads.deckList && state.payloads.materias && !firstSeed) {
        firstSeed = {
          decks: state.payloads.deckList,
          materias: state.payloads.materias,
        };
        selected = selectBaselineDecks(
          state.payloads.deckList.map((d) => ({ id: String(d.id), cardCount: Number(d.cardCount) || 0 }))
        );
        console.log(`[2B] rep ${rep}: selección C20/C100/C500: ${(selected || []).map((s) => `${s.alias}=${s.cardCount}(d${s.distance})`).join(', ')}`);
      }
      if (!firstSeed) throw new Error('B1: no se capturó la lista indexada de mazos/materias');

      // B2 — arranque caliente.
      repResult.b2 = await runScenario(rep, 'B2', () => runB2(browser, firstSeed));
      if (repResult.b2) console.log(`[2B] rep ${rep}: B2 ok (${repResult.b2.homeUsableMs != null ? Math.round(repResult.b2.homeUsableMs) : 'n/a'}ms)`);

      // B3 — entrada a Library fría y caliente.
      repResult.b3cold = await runScenario(rep, 'B3-cold', () => runB3(browser, { seed: null, warm: false }));
      if (repResult.b3cold) console.log(`[2B] rep ${rep}: B3-cold ok (${Math.round(repResult.b3cold.toStableMs)}ms)`);
      repResult.b3warm = await runScenario(rep, 'B3-warm', () => runB3(browser, { seed: firstSeed, warm: true }));
      if (repResult.b3warm) console.log(`[2B] rep ${rep}: B3-warm ok (${Math.round(repResult.b3warm.toStableMs)}ms)`);

      // B4 — procesamiento de Library.
      repResult.b4 = await runScenario(rep, 'B4', () => runB4(browser, firstSeed));
      if (repResult.b4) {
        const statuses = repResult.b4.opResults.map((o) => `${o.op}:${o.status}`).join(' ');
        console.log(`[2B] rep ${rep}: B4 ok (${statuses})`);
      }

      // B5/B6/B7 — aperturas C20/C100/C500 (aisladas entre sí).
      const deckTargets = [
        { alias: 'C20-real', target: 20 },
        { alias: 'C100-real', target: 100 },
        { alias: 'C500-real', target: 500 },
      ];
      for (const { alias, target } of deckTargets) {
        const sel = (selected || []).find((s) => s.alias === alias);
        if (!sel || sel.cardCount !== target || sel.distance !== 0) {
          const reason = !sel ? 'no-seleccionado' : `cardinalidad ${sel.cardCount} != ${target} (distancia ${sel.distance})`;
          repResult[alias] = { blocked: true, reason };
          results.errors.push(`[${alias}] BLOCKED: ${reason}`);
          console.log(`[2B] rep ${rep}: ${alias} BLOCKED (${reason})`);
          continue;
        }
        const deckResult = await runScenario(rep, alias, () => runDeckScenario(
          browser,
          { ...firstSeed, selected: Object.fromEntries((selected || []).map((s) => [s.alias, s])) },
          { alias, target },
        ));
        if (!deckResult) {
          repResult[alias] = { blocked: true, reason: 'escenario fallido' };
          continue;
        }
        repResult[alias] = deckResult;
        const firstOk = deckResult.first && deckResult.first.ok && deckResult.first.cardinalityExact;
        console.log(`[2B] rep ${rep}: ${alias} ${firstOk ? 'ok' : 'fallo'} (first ${deckResult.first.durationMs}ms, warm ${deckResult.warm.ok ? `${deckResult.warm.durationMs}ms` : 'n/a'})`);
      }
    } catch (error) {
      const message = truncateError(error);
      repResult.error = message;
      results.errors.push(`[rep ${rep}] ${message}`);
      console.error(`[2B] rep ${rep}: ERROR ${message}`);
    } finally {
      await forceCloseEntry();
    }
    state.perRep.push(repResult);
  }

  intentionalBrowserClose = true;
  try { if (browser) await withTimeout(browser.close(), 30_000, 'browser.close'); } catch { /* ya cerrado */ }
  intentionalBrowserClose = false;
  await new Promise((resolve) => server.httpServer.close(resolve));
  fs.rmSync(temporaryBuildDirectory, { recursive: true, force: true });

  // -------------------------------------------------------------------------
  // Agregación
  // -------------------------------------------------------------------------

  const okReps = state.perRep.filter((r) => !r.error);
  const finiteSamples = (values) => values.filter((v) => Number.isFinite(v));
  const aliasToKey = { 'C20-real': 'B5', 'C100-real': 'B6', 'C500-real': 'B7' };

  for (const rep of okReps) {
    if (rep.b1) {
      results.scenarios.B1.samples.push({
        homeUsableMs: rep.b1.homeUsableMs,
        hydration: hydrationSummary(rep.b1.hydration),
        snapshot: buildSnapshotRecord(rep.b1.snapshot, { scope: 'B1-cold-start' }),
      });
    }
    if (rep.b2) {
      results.scenarios.B2.samples.push({
        homeUsableMs: rep.b2.homeUsableMs,
        hydration: hydrationSummary(rep.b2.hydration),
        snapshot: buildSnapshotRecord(rep.b2.snapshot, { scope: 'B2-warm-start' }),
      });
    }
    const pushB3 = (list, r, scope) => {
      if (!r) { list.push(null); return; }
      list.push({
        interactionMs: r.toInteractionMs,
        contentMs: r.toContentMs,
        stableMs: r.toStableMs,
        memoryBefore: r.memoryBefore,
        memoryAfter: r.memoryAfter,
        snapshot: buildSnapshotRecord(r.snapshot, { scope }),
      });
    };
    pushB3(results.scenarios.B3.cold, rep.b3cold, 'B3-cold-entry');
    pushB3(results.scenarios.B3.warm, rep.b3warm, 'B3-warm-entry');
    if (rep.b4) {
      results.scenarios.B4.reps.push({
        memoryAfter: rep.b4.memoryAfter,
        snapshot: buildSnapshotRecord(rep.b4.snapshot, { scope: 'B4-library-processing' }),
      });
      for (const op of rep.b4.opResults) {
        const entry = results.scenarios.B4.ops.find((e) => e.op === op.op);
        if (entry) entry.executions.push(op);
        else results.scenarios.B4.ops.push({ op: op.op, executions: [op] });
      }
    }
    for (const [alias, key] of Object.entries(aliasToKey)) {
      const r = rep[alias];
      if (!r) continue;
      if (r.blocked) {
        results.scenarios[key].samples.push({ blocked: true, reason: r.reason });
      } else {
        results.scenarios[key].samples.push({
          firstOpenMs: r.first.durationMs,
          firstCollectionMs: r.first.collectionMs,
          warmOpenMs: r.warm.ok ? r.warm.durationMs : null,
          verifiedElements: r.first.verifiedElements,
          cardinalityExact: r.first.cardinalityExact,
          backUsableMs: r.backUsable.ok ? r.backUsable.elapsedMs : null,
          memoryFirstOpen: r.first.memoryAfter,
          memoryWarmOpen: r.warm.ok ? r.warm.memoryAfter : null,
          afterGcDiagnostic: r.afterGc,
          snapshot: buildSnapshotRecord(r.snapshot, { scope: `B${key.slice(1)}-${alias}` }),
        });
      }
    }
  }

  results.scenarios.B1.aggregate = summarizeValues(finiteSamples(okReps.map((r) => r.b1 && r.b1.homeUsableMs)));
  results.scenarios.B2.aggregate = summarizeValues(finiteSamples(okReps.map((r) => r.b2 && r.b2.homeUsableMs)));
  const summarizeB3 = (label, list, key) => {
    const values = list.map((s) => s && s[key]).filter((v) => v !== undefined && v !== null);
    results.scenarios.B3[`${label}Aggregate`] = summarizeValues(finiteSamples(values));
  };
  summarizeB3('coldStable', results.scenarios.B3.cold, 'stableMs');
  summarizeB3('coldInteraction', results.scenarios.B3.cold, 'interactionMs');
  summarizeB3('coldContent', results.scenarios.B3.cold, 'contentMs');
  summarizeB3('warmStable', results.scenarios.B3.warm, 'stableMs');
  summarizeB3('warmInteraction', results.scenarios.B3.warm, 'interactionMs');
  summarizeB3('warmContent', results.scenarios.B3.warm, 'contentMs');
  for (const opEntry of results.scenarios.B4.ops) {
    const okExecutions = opEntry.executions.filter((e) => e.status === 'ok');
    opEntry.aggregate = summarizeValues(okExecutions.map((e) => e.durationMs));
    opEntry.executionsCount = opEntry.executions.length;
    opEntry.failedExecutions = opEntry.executions.filter((e) => e.status !== 'ok').length;
    opEntry.outputCardinality = opEntry.executions.map((e) => e.outputCardinality).filter((v) => v !== null && v !== undefined);
  }
  for (const key of ['B5', 'B6', 'B7']) {
    const samples = results.scenarios[key].samples;
    results.scenarios[key].aggregate = {
      firstOpenMs: summarizeValues(finiteSamples(samples.map((s) => s.firstOpenMs))),
      warmOpenMs: summarizeValues(finiteSamples(samples.map((s) => s.warmOpenMs))),
      samplesOk: samples.filter((s) => !s.blocked && s.cardinalityExact).length,
      blocked: samples.filter((s) => s.blocked).length,
    };
  }

  // Almacenamiento (hidratación y escrituras) — primera repetición válida;
  // los resúmenes por repetición viven en las muestras de B1/B2.
  const firstOkRep = okReps[0];
  if (firstOkRep && firstOkRep.b1) {
    results.storage = {
      cold: { hydration: firstOkRep.b1.hydration, writes: firstOkRep.b1.storageWrites },
      warm: firstOkRep.b2 ? { hydration: firstOkRep.b2.hydration } : null,
      api: 'safeLocalStorage (getItem/JSON.parse/JSON.stringify/setItem medidos en página con las funciones productivas)',
      note: 'El JSON.parse de la hidratación mide el parseo de localStorage, NO el de las respuestas de red; el parseo de red se mide aparte (pageTimings: parseMs).',
    };
  }

  // -------------------------------------------------------------------------
  // Red: correlación CDP uno a uno y agregados sin doble contabilización
  // -------------------------------------------------------------------------

  applyCdpCorrelation();
  const networkBySurface = {};
  const networkSample = (req) => ({
    contract: req.contract,
    window: req.window,
    phase: req.phase,
    status: req.status,
    durationMs: req.durationMs != null
      ? req.durationMs
      : req.end != null && req.start != null ? req.end - req.start : null,
    ttfbMs: req.ttfbMs,
    downloadMs: req.downloadMs,
    transferSize: req.transferSize,
    encodedBodySize: req.encodedBodySize,
    decodedBodySize: req.decodedBodySize,
    contentEncoding: req.contentEncoding ?? null,
    correlation: req.correlation,
    correlationBasis: req.correlationBasis,
  });
  for (const req of state.requests) {
    const entry = networkBySurface[req.surface] || { count: 0, samples: [] };
    entry.count += 1;
    entry.samples.push(networkSample(req));
    networkBySurface[req.surface] = entry;
  }
  for (const entry of Object.values(networkBySurface)) {
    // La clave `samples` del resumen es un conteo; se asignan campos
    // explícitos para no sobrescribir el array de muestras.
    const summary = summarizeNetworkSamples(entry.samples);
    entry.matched = summary.matched;
    entry.unmatched = summary.unmatched;
    for (const metric of NETWORK_METRICS) {
      entry[`${metric}Aggregate`] = summary[`${metric}Aggregate`];
    }
    entry.contentEncodings = [...new Set(entry.samples.map((s) => s.contentEncoding))];
  }
  // deck-cards por colección (C20/C100/C500) y por apertura (first/warm):
  // nunca se mezclan en un único agregado.
  const networkByCollection = {};
  for (const req of state.requests) {
    if (req.surface !== 'deck-cards') continue;
    const alias = req.window ? String(req.window).replace(/^B\d+-/, '') : null;
    if (!alias) continue;
    const phase = req.phase === 'warm' ? 'warm' : 'first';
    if (!networkByCollection[alias]) networkByCollection[alias] = { first: { samples: [] }, warm: { samples: [] } };
    networkByCollection[alias][phase].samples.push(networkSample(req));
  }
  for (const coll of Object.values(networkByCollection)) {
    for (const phase of ['first', 'warm']) {
      const summary = summarizeNetworkSamples(coll[phase].samples);
      coll[phase].matched = summary.matched;
      coll[phase].unmatched = summary.unmatched;
      for (const metric of NETWORK_METRICS) {
        coll[phase][`${metric}Aggregate`] = summary[`${metric}Aggregate`];
      }
    }
  }
  results.network = {
    bySurface: networkBySurface,
    byCollection: networkByCollection,
    correlation: state.correlation,
    source: 'CDP Network (tamaños/TTFB/Content-Encoding) + marcas del runner (duración); correlación uno a uno por (ventana, URL normalizada, orden causal)',
  };

  // Guardia y solicitudes.
  const backendRequests = state.requests;
  const protectedRequests = backendRequests.filter((r) => isProtectedSurface(r.surface));
  results.guard = {
    totalIndexedEvents: protectedRequests.filter((r) => r.contract === 'indexed').length,
    legacyEvents: protectedRequests.filter((r) => r.contract !== 'indexed').length,
    allCards: protectedRequests.filter((r) => r.surface === 'all-cards').length,
    protectedRequests: protectedRequests.length,
    otherRequests: backendRequests.filter((r) => !isProtectedSurface(r.surface)).length,
    totalRequests: backendRequests.length,
    writes: backendRequests.filter((r) => r.method !== 'GET').length + state.violations.filter((v) => v.code === 'non-get').length,
    cdpPreflights: state.cdpPreflights,
    violations: state.violations,
    methods: [...new Set(backendRequests.map((r) => r.method))],
    note: 'Las preflights OPTIONS se identifican aparte (por el guard y por CDP) y no se cuentan como solicitudes de aplicación.',
  };
  results.requests = groupEquivalentRequests(
    backendRequests.map((r) => ({
      normalizedUrl: r.normalizedUrl,
      pathPattern: r.pathPattern,
      method: r.method,
      surface: r.surface,
      contract: r.contract,
      cover: r.cover,
      window: r.window,
      phase: r.phase,
      initiator: r.window,
      start: r.start,
      end: r.end,
      status: r.status,
      transferSize: r.transferSize,
      encodedBodySize: r.encodedBodySize,
      decodedBodySize: r.decodedBodySize,
      ttfbMs: r.ttfbMs,
      downloadMs: r.downloadMs,
      contentEncoding: r.contentEncoding ?? null,
      correlation: r.correlation,
      correlationBasis: r.correlationBasis,
    }))
  );

  // Memoria (primera repetición válida; por repetición en las muestras).
  const memory = {};
  if (firstOkRep) {
    if (firstOkRep.b3cold) memory.libraryCold = { before: firstOkRep.b3cold.memoryBefore, after: firstOkRep.b3cold.memoryAfter };
    if (firstOkRep.b3warm) memory.libraryWarm = { before: firstOkRep.b3warm.memoryBefore, after: firstOkRep.b3warm.memoryAfter };
    if (firstOkRep.b4) memory.afterLibraryProcessing = firstOkRep.b4.memoryAfter;
    for (const alias of ['C20-real', 'C100-real', 'C500-real']) {
      const r = firstOkRep[alias];
      if (r && !r.blocked) memory[alias] = { afterOpen: r.first.memoryAfter, afterGcDiagnostic: r.afterGc };
    }
    if (firstOkRep.b3cold && firstOkRep.b3cold.cdpMetrics) {
      const js = firstOkRep.b3cold.cdpMetrics.metrics && firstOkRep.b3cold.cdpMetrics.metrics.find((m) => m.name === 'JSHeapUsedSize');
      memory.cdpDiagnostic = {
        jsHeapUsedSizeAfterLibraryCold: js ? js.value : null,
        api: 'CDP Performance.getMetrics (API distinta de performance.memory; no comparable directamente)',
      };
    }
    memory.api = 'performance.memory (usedJSHeapSize/totalJSHeapSize/jsHeapSizeLimit)';
  }
  results.memory = memory;

  // React (sólo build de profiling) — por escenario y repetición.
  if (state.buildMode === 'profiling') {
    const reactScenarios = {};
    const collectReact = (key, samples) => {
      const reps = (samples || []).filter((s) => s && s.snapshot && s.snapshot.react).map((s) => s.snapshot.react);
      if (reps.length > 0) reactScenarios[key] = { reps };
    };
    collectReact('B1', results.scenarios.B1.samples);
    collectReact('B2', results.scenarios.B2.samples);
    collectReact('B3cold', results.scenarios.B3.cold);
    collectReact('B3warm', results.scenarios.B3.warm);
    collectReact('B4', results.scenarios.B4.reps);
    collectReact('B5', results.scenarios.B5.samples);
    collectReact('B6', results.scenarios.B6.samples);
    collectReact('B7', results.scenarios.B7.samples);
    const commitCounts = Object.values(reactScenarios)
      .flatMap((s) => s.reps.map((r) => (r.commitsSummary ? r.commitsSummary.count : 0)));
    results.react = {
      aliasVerified: commitCounts.some((c) => c > 0),
      aliasEvidence: 'Profiler.onRender emitió commits; en un build productivo normal de React no se emiten. El alias react-dom -> react-dom/profiling se aplica ÚNICAMENTE en el build del harness (runner), nunca en vite.config.js ni en el build normal.',
      components: ['DashboardScreen', 'HomeSection', 'LibrarySection', 'DeckInterior', 'FlashcardCollection', 'FlashcardGrid'],
      scenarios: reactScenarios,
      note: 'renders, invocaciones de loaders y commits por escenario y repetición (build de profiling; no mezclado con el productivo). Los commits llevan bucket (first-open/warm-open/library-entry) según los marks del harness.',
    };
  }

  // Trazas CDP (atribución CPU) — primera repetición válida.
  const cpu = {};
  if (firstOkRep) {
    cpu.B1 = firstOkRep.b1 && firstOkRep.b1.trace;
    cpu.B3cold = firstOkRep.b3cold && firstOkRep.b3cold.trace;
    cpu.B3warm = firstOkRep.b3warm && firstOkRep.b3warm.trace;
    cpu.B4 = firstOkRep.b4 && firstOkRep.b4.trace;
    for (const alias of ['C20-real', 'C100-real', 'C500-real']) {
      const r = firstOkRep[alias];
      if (r && !r.blocked) cpu[alias] = r.trace;
    }
    // B4: si la traza no produjo eventos de interés, NOT MEASURED explícito;
    // nunca se infiere la atribución CPU de la duración total de las ops.
    const b4Interesting = cpu.B4 && Object.keys(cpu.B4).some((k) => k !== 'droppedEvents' && k !== 'notMeasured');
    if (firstOkRep.b4 && !b4Interesting) {
      cpu.B4 = {
        notMeasured: true,
        droppedEvents: cpu.B4 ? cpu.B4.droppedEvents : 0,
        reason: 'traza CDP sin eventos de interés en la ventana B4 (anomalía de captura headless); la atribución CPU de B4 no se infiere de la duración total de las operaciones',
      };
    }
  }
  results.cpuAttribution = {
    categories: [...INTERESTING_TRACE_EVENTS],
    traces: cpu,
    note: 'CDP tracing headless (primera repetición válida); las categorías ausentes se registran como NOT MEASURED, no cero.',
  };

  // DOM — resumen (primera repetición válida); por repetición en las muestras.
  results.dom = {
    summary: {
      b1Home: firstOkRep && firstOkRep.b1 ? {
        totalNodes: firstOkRep.b1.snapshot.dom.totalNodes,
        articleCount: firstOkRep.b1.snapshot.dom.articleCount,
        buttonCount: firstOkRep.b1.snapshot.dom.buttonCount,
        imageCount: firstOkRep.b1.snapshot.dom.imageCount,
      } : null,
      libraryCold: firstOkRep && firstOkRep.b3cold ? firstOkRep.b3cold.snapshot.dom : null,
      deckDelta: Object.fromEntries(['C20-real', 'C100-real', 'C500-real'].map((alias) => {
        const r = firstOkRep && firstOkRep[alias];
        return [alias, r && !r.blocked ? {
          deckNodes: r.snapshot.dom.deckNodes,
          deckArticleCount: r.snapshot.dom.deckArticleCount,
          totalNodes: r.snapshot.dom.totalNodes,
          inlineBackgroundImages: r.snapshot.dom.inlineBackgroundImages,
        } : null];
      })),
    },
    note: 'El detalle por repetición (dom) está en scenarios.*.samples[].snapshot.dom.',
  };

  // Tareas largas — por escenario y repetición + agregados.
  const longTaskScenarios = {};
  const collectLongTasks = (key, samples) => {
    const summaries = (samples || []).filter((s) => s && s.snapshot && s.snapshot.longTasks).map((s) => s.snapshot.longTasks);
    if (summaries.length === 0) return;
    longTaskScenarios[key] = {
      reps: summaries,
      aggregate: {
        count: summarizeValues(finiteSamples(summaries.map((s) => s.count))),
        totalMs: summarizeValues(finiteSamples(summaries.map((s) => s.totalMs))),
        maxMs: summarizeValues(finiteSamples(summaries.map((s) => s.maxMs))),
      },
    };
  };
  collectLongTasks('B1', results.scenarios.B1.samples);
  collectLongTasks('B2', results.scenarios.B2.samples);
  collectLongTasks('B3cold', results.scenarios.B3.cold);
  collectLongTasks('B3warm', results.scenarios.B3.warm);
  collectLongTasks('B4', results.scenarios.B4.reps);
  collectLongTasks('B5', results.scenarios.B5.samples);
  collectLongTasks('B6', results.scenarios.B6.samples);
  collectLongTasks('B7', results.scenarios.B7.samples);
  results.longTasks = {
    scenarios: longTaskScenarios,
    note: 'PerformanceObserver longtask en página; offsets relativos sanitizados (ms desde timeOrigin) por repetición; cero sólo si la observación estuvo activa (zeroValid); si no, NOT MEASURED. Nunca se persisten stacks ni URLs.',
  };

  // Tiempos de página (body/parse/transformación) — por escenario y repetición.
  results.pageTimings = {
    note: 'bodyReadMs = lectura/decodificación del body (text()); parseMs = JSON.parse puro; transformMs = transformación replicada. Red = CDP (network.bySurface); el parse de localStorage no sustituye al de red. Detalle: scenarios.*.samples[].snapshot.pageTimings.',
  };

  // Errores y estado.
  results.samplesCompleted = okReps.length;
  results.samplesValid = okReps.length;
  results.samplesFailed = state.samples - okReps.length;
  results.errors = results.errors.slice(0, 20);
  results.environment = {
    node: process.version,
    platform: `${os.platform()} ${os.release()} ${os.arch()}`,
    cpuModel: os.cpus()[0]?.model || 'unknown',
    logicalCpuCount: os.cpus().length,
    totalMemoryBytes: os.totalmem(),
    chromiumVersion: browser ? browser.version() : null,
    headless: true,
    viewport: '1280x900 dpr=1',
    reducedMotion: 'reduce',
    cpuThrottling: 'none',
    httpCache: 'controlada por contexto (nuevo por escenario; caché caliente sólo con siembra explícita)',
    browserCrashes: browserCrashes,
    pageCrashes: state.pageCrashedAt ? [{ window: state.lastCrashWindow }] : [],
    executionContext: 'contenedor Docker mcr.microsoft.com/playwright:v1.62.1-jammy (Chromium real de Playwright; host sin dependencias de navegador)',
  };
  results.limitations = [
    'Headless Chromium en esta máquina; no equivale a Safari/GPU/compositor de dispositivo físico.',
    'El overlay artificial de 2.500 ms de FlashcardsApp no participa (se monta DashboardScreen real, sin el retardo configurado).',
    'En el build productivo no hay Profiler: renders/commits provienen exclusivamente del build de profiling y nunca se mezclan.',
    'Las preflights OPTIONS del navegador se identifican aparte (guard y CDP) y no se cuentan como solicitudes de aplicación.',
    'Con 5 muestras, p95 = NOT MEASURED (regla del encargo).',
    'Los tiempos de las operaciones de B4 incluyen la interacción completa (UI, apertura/cierre del ActionSheet, espera de frames): no representan por sí solos el coste puro del filtrado/ordenamiento.',
    'Los tiempos de red se miden con CDP sobre el backend productivo desde la máquina local (R0); no representan redes degradadas (R1/R2 quedan para investigación posterior).',
  ];

  // Estado global del reporte: PASS sólo si el contrato completo se midió
  // válidamente; cualquier medición requerida legítimamente ausente (p95,
  // atribución CPU de B4) => PASS PARCIAL con lista explícita.
  const coreOk = Boolean(
    results.scenarios.B3.coldStableAggregate && results.scenarios.B3.coldStableAggregate.samples > 0
    && results.scenarios.B3.warmStableAggregate && results.scenarios.B3.warmStableAggregate.samples > 0
    && results.scenarios.B5.aggregate && results.scenarios.B5.aggregate.samplesOk > 0
    && results.scenarios.B6.aggregate && results.scenarios.B6.aggregate.samplesOk > 0
    && results.scenarios.B7.aggregate && results.scenarios.B7.aggregate.samplesOk > 0
  );
  const notMeasured = [
    { item: 'p95', reason: 'regla del encargo: con 5 muestras el p95 no se estima ni se presenta como dato estable' },
  ];
  if (cpu.B4 && cpu.B4.notMeasured) {
    notMeasured.push({ item: 'cpuAttribution.B4', reason: cpu.B4.reason });
  }
  if (state.buildMode === 'profiling' && results.react && !results.react.aliasVerified) {
    notMeasured.push({
      item: 'react.commits',
      reason: 'Profiler.onRender no emitió commits: el alias react-dom -> react-dom/profiling no se aplicó en este build; la evidencia de React no es válida',
    });
  }
  results.notMeasured = notMeasured;
  if (state.fatalViolation || state.violations.length > 0) results.status = 'FAIL';
  else if (!coreOk) results.status = 'BLOCKED';
  else if (notMeasured.length > 0 || results.samplesFailed > 0) results.status = 'PASS PARCIAL';
  else results.status = 'PASS';

  // Serialización segura: redacta el origen real, redacta IDs de URLs y
  // valida aliases/contenido. Los SHAs públicos del informe se permiten
  // explícitamente; cualquier otro 24-hex rechaza la escritura.
  const aliases = buildAliases(state.userId, selected || []);
  let safeJson;
  try {
    const redacted = redactUrlOrigin(results, state.backendUrl);
    safeJson = sanitizeResults(redacted, aliases, { allowedHexTokens: [appBaseSha, harnessSha] });
  } catch (error) {
    console.error(`[2B] Los resultados no pasan la serialización segura: ${error.message}`);
    console.error('No se escribió ningún archivo.');
    process.exitCode = 1;
    return;
  }

  const outPath = args.out || path.join(FRONTEND_ROOT, 'docs/performance-audit/research/library-scale/raw-results-2b.json');
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(outPath, `${safeJson}\n`, 'utf8');
  console.log(`[2B] resultados sanitizados escritos en ${outPath}`);
  console.log(`[2B] estado: ${results.status} | muestras ok ${results.samplesCompleted}/${state.samples}`);
  console.log(`[2B] guard 5A: indexadas ${results.guard.totalIndexedEvents} | legacy ${results.guard.legacyEvents} | all-cards ${results.guard.allCards} | métodos ${results.guard.methods.join(',')} | escrituras ${results.guard.writes} | violaciones ${state.violations.length} | preflights CDP ${results.guard.cdpPreflights}`);
  console.log(`[2B] correlación CDP: ${state.correlation.matched} emparejadas / ${state.correlation.unmatched} sin correlación / ${state.correlation.mismatchedGroups} grupos con conteo desigual`);
  if (notMeasured.length > 0) {
    for (const nm of notMeasured) console.log(`[2B] NOT MEASURED: ${nm.item} — ${nm.reason}`);
  }
  if (state.violations.length > 0) {
    console.error('[2B] VIOLACIÓN DE GUARDIA (FAIL):');
    for (const v of state.violations) console.error(`  [${v.code}] ${v.detail} (${v.pathPattern})`);
  }
  // Salida explícita: garantiza terminar aunque alguna promesa colgada del CDP
  // mantenga vivo el event loop (los resultados ya están escritos).
  process.exit(results.status === 'BLOCKED' ? 3 : results.status === 'FAIL' ? 1 : 0);
}

if (process.argv[1] && process.argv[1].endsWith('run-browser-profile.mjs')) {
  main().catch((error) => {
    console.error(`[2B] Fallo inesperado: ${String(error && error.stack ? error.stack : error).slice(0, 1000)}`);
    process.exit(1);
  });
}

export { main };
