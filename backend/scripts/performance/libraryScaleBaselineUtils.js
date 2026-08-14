// FILE: backend/scripts/performance/libraryScaleBaselineUtils.js
// Fase 2A — baseline real de escala de Library y apertura de mazos.
// Utilidades PURAS del harness: deterministas, sin red, sin MongoDB y sin
// dependencias. Toda la lógica que las pruebas deben cubrir vive aquí.
//
// Reglas de seguridad (aplicadas también por el harness):
// - Sólo GET y operaciones de lectura; nunca save/update/insert/delete.
// - Los IDs reales se sustituyen por aliases (real-user-A, C20-real, ...).
// - Los resultados persistidos nunca contienen contenido de tarjetas,
//   Data URLs, credenciales ni tokens.
// - El contrato de petición es SIEMPRE indexado: contract=indexed y, en la
//   lista de mazos, cover=thumbnail. Cualquier otro valor se rechaza.

'use strict';

// ---------------------------------------------------------------------------
// Constantes de política
// ---------------------------------------------------------------------------

const INDEXED_CONTRACT = 'indexed';
const THUMBNAIL_COVER = 'thumbnail';
const ALLOWED_METHOD = 'GET';
// Máximo de solicitudes secuenciales por caso (regla del encargo).
const MAX_SAMPLES_PER_CASE = 5;
// Límite máximo de maxTimeMS para CUALQUIER consulta MongoDB del harness.
// Impuesto por construcción: ningún find/aggregate/explain recibe más de
// 5000 ms, aunque el wrapper local de la promesa pueda añadir un margen de
// cierre propio (ver withTimeout en el harness).
const MAX_TIME_MS = 5000;
// Alias públicos usados en cualquier resultado persistido.
const PERF_USER_ALIAS = 'real-user-A';
// Distancia relativa máxima para aceptar un mazo como C20/C100/C500-real
// (25% del objetivo). Fuera de ese radio el caso se reporta NOT RUN.
const BASELINE_RELATIVE_DISTANCE = 0.25;
// Tokens que jamás pueden aparecer en resultados persistidos.
const FORBIDDEN_RESULT_TOKENS = ['data:', 'MONGO_URI', 'MONGO_URL', 'Bearer '];
// Claves que jamás pueden aparecer como claves de hoja en un agregado
// persistido (contenido de tarjetas, imágenes o identidad).
const FORBIDDEN_RESULT_KEYS = [
  'question', 'answer', 'bgImage', 'contentImage', 'coverImage',
  'coverImageThumb', 'cardBackgrounds', 'title', 'name', 'email',
  'token', 'cookie', 'authorization', 'credential', 'password',
];
// Forma de un ID real del sistema (ObjectId de 24 hex).
const REAL_ID_PATTERN = /^[0-9a-f]{24}$/;

// ---------------------------------------------------------------------------
// Estadística de conteos (puras)
// ---------------------------------------------------------------------------

function percentileSorted(sorted, p) {
  if (!Array.isArray(sorted) || sorted.length === 0) return null;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return (sorted[lo] + sorted[hi]) / 2;
}

function medianSorted(sorted) {
  return percentileSorted(sorted, 50);
}

/**
 * Estadística agregada de tarjetas por mazo: mínimo, mediana, p95 y máximo.
 * Devuelve valores null cuando no hay mazos; nunca inventa resultados.
 */
function deckCountStats(counts) {
  const values = Array.isArray(counts) ? counts.filter((c) => Number.isFinite(c)) : [];
  const sorted = [...values].sort((a, b) => a - b);
  return {
    totalDecks: values.length,
    totalCards: values.reduce((sum, c) => sum + c, 0),
    min: sorted.length ? sorted[0] : null,
    median: medianSorted(sorted),
    p95: percentileSorted(sorted, 95),
    max: sorted.length ? sorted[sorted.length - 1] : null,
  };
}

// ---------------------------------------------------------------------------
// Rangos de cantidad de tarjetas (puros)
// ---------------------------------------------------------------------------

const DECK_BUCKETS = [
  { key: '0-20', min: 0, max: 20 },
  { key: '21-100', min: 21, max: 100 },
  { key: '101-499', min: 101, max: 499 },
  { key: '500+', min: 500, max: Infinity },
];

function bucketCardCounts(counts) {
  const values = Array.isArray(counts) ? counts.filter((c) => Number.isFinite(c)) : [];
  return DECK_BUCKETS.map((b) => ({
    range: b.key,
    count: values.filter((c) => c >= b.min && c <= b.max).length,
  }));
}

// ---------------------------------------------------------------------------
// Selección determinista de mazos C20/C100/C500
// ---------------------------------------------------------------------------

/**
 * Selecciona, para cada objetivo (20/100/500), el mazo propio más cercano
 * en cantidad de tarjetas dentro del radio relativo BASELINE_RELATIVE_DISTANCE.
 * Desempate determinista: menor distancia y, a igualdad, id lexicográfico.
 * Devuelve un array de { target, alias, deckId, cardCount }.
 */
function selectBaselineDecks(decks) {
  const input = Array.isArray(decks) ? decks : [];
  const targets = [20, 100, 500];
  const selected = [];

  for (const target of targets) {
    const candidates = input
      .filter((d) => d && Number.isInteger(d.cardCount) && d.cardCount >= 0 && String(d.id || '').length > 0)
      .map((d) => ({ d, distance: Math.abs(d.cardCount - target) }))
      .filter((c) => c.distance <= target * BASELINE_RELATIVE_DISTANCE)
      .sort((a, b) => a.distance - b.distance || String(a.d.id).localeCompare(String(b.d.id)));

    if (candidates.length === 0) continue;
    const best = candidates[0].d;
    selected.push({
      target,
      alias: `C${target}-real`,
      deckId: String(best.id),
      cardCount: best.cardCount,
      distance: candidates[0].distance,
    });
  }

  return selected;
}

// ---------------------------------------------------------------------------
// Aliases y reemplazo de IDs
// ---------------------------------------------------------------------------

/** Mapa de aliases por defecto: usuario real-user-A y C{target}-real. */
function buildAliases(userId, selectedDecks) {
  const aliases = {};
  if (userId && typeof userId === 'string' && userId.length) aliases[userId] = PERF_USER_ALIAS;
  for (const item of (Array.isArray(selectedDecks) ? selectedDecks : [])) {
    if (item && item.deckId) aliases[String(item.deckId)] = item.alias;
  }
  return aliases;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Reemplaza exactamente los IDs reales por sus aliases en un texto JSON. */
function applyAliases(text, aliases) {
  let out = String(text);
  for (const [realId, alias] of Object.entries(aliases || {})) {
    if (!realId || !alias) continue;
    out = out.replace(new RegExp(escapeRegExp(realId), 'g'), alias);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Serialización segura de raw-results
// ---------------------------------------------------------------------------

function collectLeaves(value, leaves, path) {
  if (Array.isArray(value)) {
    value.forEach((item, i) => collectLeaves(item, leaves, `${path}[${i}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      collectLeaves(child, leaves, path ? `${path}.${key}` : key);
    }
    return;
  }
  leaves.push({ path, value });
}

/**
 * Serializa un objeto de resultados agregados a JSON con garantías:
 * - ninguna clave de hoja coincide exactamente con una clave de contenido
 *   (question, answer, bgImage, contentImage, coverImage, cardBackgrounds,
 *   title, name, ...);
 * - ningún token prohibido (data:, MONGO_URI, ...) aparece en ningún valor;
 * - todos los IDs reales (24 hex) presentes deben estar en `aliases`;
 * - las cadenas de longitud > 256 se rechazan (posible contenido copiado).
 * Lanza BaselineSanitizationError si algo no es seguro.
 */
function serializeRawResults(results, aliases) {
  const leaves = [];
  collectLeaves(results, leaves, '');

  for (const { path, value } of leaves) {
    const key = String(path).split('.').pop().replace(/\[\d+\]$/, '');
    if (FORBIDDEN_RESULT_KEYS.includes(key)) {
      throw new BaselineSanitizationError(`clave prohibida en resultados: ${path}`);
    }
    if (typeof value === 'string' && FORBIDDEN_RESULT_TOKENS.some((t) => value.includes(t))) {
      throw new BaselineSanitizationError(`token prohibido en resultados en ${path}: ${value.slice(0, 32)}`);
    }
    if (typeof value === 'string' && value.length > 256 && !REAL_ID_PATTERN.test(value)) {
      throw new BaselineSanitizationError(`cadena larga sin alias en resultados (posible contenido): ${path}`);
    }
  }

  const rawJson = JSON.stringify(results, null, 2);
  const withAliases = applyAliases(rawJson, aliases);

  const idMatch = withAliases.match(/"[0-9a-f]{24}"/g) || [];
  for (const match of idMatch) {
    const realId = match.slice(1, -1);
    if (!aliases || !aliases[realId]) {
      throw new BaselineSanitizationError(`ID real sin alias en resultados: ${realId}`);
    }
  }

  return withAliases;
}

class BaselineSanitizationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BaselineSanitizationError';
  }
}

// ---------------------------------------------------------------------------
// Sanitización de errores
// ---------------------------------------------------------------------------

/**
 * Reduce un error a un mensaje seguro para reportes: elimina la base URL,
 * los IDs reales conocidos y cualquier URL; nunca expone credenciales.
 */
function sanitizeError(err, { baseUrl, ids = [] } = {}) {
  let message = err && typeof err.message === 'string' ? err.message : String(err);
  if (baseUrl) message = message.split(String(baseUrl)).join('<base-url>');
  for (const id of ids) {
    if (id) message = message.split(String(id)).join('<id>');
  }
  message = message.replace(/https?:\/\/[^\s"']+/g, '<url>');
  message = message.replace(/mongodb(\+srv)?:\/\/[^\s"']+/g, '<mongo-url>');
  return message;
}

// ---------------------------------------------------------------------------
// Construcción de URLs (contrato indexado obligatorio)
// ---------------------------------------------------------------------------

/**
 * Rechaza cualquier contrato distinto del exacto `indexed`. El baseline nunca
 * construye URLs legacy (ausencia de contract, vacío u otro valor).
 */
function assertIndexedContract(contract) {
  if (contract !== INDEXED_CONTRACT) {
    throw new Error(
      `Contrato legacy no permitido en el baseline: ${JSON.stringify(contract)} (sólo 'indexed')`
    );
  }
}

/**
 * URL de Library: GET /api/decks/:userId?contract=indexed&cover=thumbnail.
 * El timestamp `t` replica al cliente actual (App.jsx) y puede desactivarse
 * con includeTimestamp=false para pruebas deterministas.
 */
function buildLibraryUrl(baseUrl, userId, { contract = INDEXED_CONTRACT, cover = THUMBNAIL_COVER, includeTimestamp = true } = {}) {
  assertIndexedContract(contract);
  if (!baseUrl || !userId) throw new Error('baseUrl y userId son obligatorios para la URL de Library');
  const base = String(baseUrl).replace(/\/+$/, '');
  const t = includeTimestamp ? `&t=${Date.now()}` : '';
  return `${base}/api/decks/${encodeURIComponent(userId)}?contract=${encodeURIComponent(contract)}&cover=${encodeURIComponent(cover)}${t}`;
}

/**
 * URL de apertura de mazo: GET /api/flashcards/deck/:deckId?contract=indexed.
 */
function buildDeckCardsUrl(baseUrl, deckId, { contract = INDEXED_CONTRACT } = {}) {
  assertIndexedContract(contract);
  if (!baseUrl || !deckId) throw new Error('baseUrl y deckId son obligatorios para la URL de mazo');
  const base = String(baseUrl).replace(/\/+$/, '');
  return `${base}/api/flashcards/deck/${encodeURIComponent(deckId)}?contract=${encodeURIComponent(contract)}`;
}

/** Clasificación de un valor de contract, igual que la telemetría del 5A. */
function classifyContract(value) {
  if (value === INDEXED_CONTRACT) return 'indexed';
  if (value === undefined || value === null) return 'legacy-missing';
  return 'legacy-other';
}

// ---------------------------------------------------------------------------
// Política de peticiones
// ---------------------------------------------------------------------------

/**
 * Ajusta el número de muestras solicitado al límite de 5 por caso
 * (mínimo 1). Nunca devuelve más de MAX_SAMPLES_PER_CASE.
 */
function clampSamples(requested) {
  const n = Number(requested);
  if (!Number.isInteger(n) || n < 1) return 1;
  return Math.min(n, MAX_SAMPLES_PER_CASE);
}

/** Rechaza cualquier método que no sea GET: el baseline es read-only. */
function assertReadOnlyMethod(method) {
  if (method !== ALLOWED_METHOD) {
    throw new Error(`Método no permitido en el baseline: ${method} (sólo GET)`);
  }
}

// ---------------------------------------------------------------------------
// Timeout sin inventar resultados
// ---------------------------------------------------------------------------

class BaselineTimeoutError extends Error {
  constructor(ms) {
    super(`Timeout del baseline después de ${ms} ms`);
    this.name = 'BaselineTimeoutError';
    this.ms = ms;
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new BaselineTimeoutError(ms)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

// ---------------------------------------------------------------------------
// Ejecución secuencial
// ---------------------------------------------------------------------------

/**
 * Ejecuta tareas una tras otra, esperando cada una antes de la siguiente.
 * Cualquier rechazo detiene la secuencia (sin reintentos agresivos).
 */
async function runSequentially(tasks) {
  const results = [];
  for (const task of tasks) {
    results.push(await task());
  }
  return results;
}

// ---------------------------------------------------------------------------
// Interpretación de respuestas (pura)
// ---------------------------------------------------------------------------

/**
 * Cantidad de elementos de una respuesta según la superficie:
 * - deck-list: array de mazos;
 * - deck-cards: payload indexado { backgrounds, cards } => cards.length.
 */
function countElements(payload, surface) {
  if (surface === 'deck-list') {
    return Array.isArray(payload) ? payload.length : null;
  }
  if (surface === 'deck-cards') {
    return payload && Array.isArray(payload.cards) ? payload.cards.length : null;
  }
  return null;
}

/**
 * Resumen de latencia de un caso. Con 5 o menos muestras el p95 queda
 * NOT MEASURED por regla del encargo (no se presenta p95 con <10 muestras).
 */
function summarizeSamples(samples) {
  const times = (Array.isArray(samples) ? samples : [])
    .map((s) => s && s.totalMs)
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b);
  return {
    samples: times.length,
    medianMs: medianSorted(times),
    minMs: times.length ? times[0] : null,
    maxMs: times.length ? times[times.length - 1] : null,
    p95Ms: times.length > MAX_SAMPLES_PER_CASE ? percentileSorted(times, 95) : 'NOT MEASURED',
  };
}

/**
 * Valida un valor de maxTimeMS para consultas MongoDB: debe ser un entero
 * entre 1 y MAX_TIME_MS (5000). Devuelve el valor como Number o lanza un
 * Error. Cualquier consulta del harness (find/aggregate/explain) se ejecuta
 * con este límite; el margen adicional de cierre del wrapper de promesas es
 * local y nunca llega a MongoDB.
 */
function validateMaxTimeMs(value) {
  const ms = Number(value);
  if (!Number.isInteger(ms) || ms < 1 || ms > MAX_TIME_MS) {
    throw new Error(`maxTimeMS inválido: ${value} (entero entre 1 y ${MAX_TIME_MS} requerido)`);
  }
  return ms;
}

/**
 * Opciones de cursor para una agregación con límite de tiempo.
 * Mongoose 9 no expone Aggregate.maxTimeMS() y MongoDB Atlas rechaza la
 * etapa $maxTimeMS; la forma portátil es la opción del cursor
 * { maxTimeMS } vía Aggregate.option(). Rechaza valores fuera de
 * 1..MAX_TIME_MS (5000): ninguna consulta recibe más de 5000 ms.
 */
function buildAggregateOptions(maxTimeMS) {
  return { maxTimeMS: validateMaxTimeMs(maxTimeMS) };
}

// ---------------------------------------------------------------------------
// Estado de la sección api (puro)
// ---------------------------------------------------------------------------

// Casos que la sección api DEBE medir para declararse MEASURED por completo:
// la lista de mazos y la apertura de los tres mazos seleccionados.
const API_EXPECTED_CASES = ['deck-list', 'C20-real', 'C100-real', 'C500-real'];

/**
 * Clasifica el estado global de la sección api a partir de los casos
 * resueltos. La sección sólo es MEASURED cuando TODOS los casos esperados
 * (deck-list + C20/C100/C500-real) tienen al menos una muestra correcta
 * (samplesOk > 0). Cualquier caso esperado ausente o sin muestras degrada
 * la sección a BLOCKED; si hubo éxito parcial se marca partialResults: true
 * para no presentar la sección como completamente medida. Nunca inventa
 * resultados.
 *
 * `cases` replica la forma de runApi(): `deck-list` plano y `deck-cards`
 * anidado por alias (o { status: 'NOT RUN' } cuando no hubo selección).
 */
function classifyApiSectionStatus(cases) {
  const flat = {};
  if (cases && cases['deck-list'] && typeof cases['deck-list'] === 'object') {
    flat['deck-list'] = cases['deck-list'];
  }
  const deckCards = cases && cases['deck-cards'];
  if (deckCards && typeof deckCards === 'object' && !deckCards.status) {
    for (const alias of ['C20-real', 'C100-real', 'C500-real']) {
      const c = deckCards[alias];
      if (c && typeof c === 'object') flat[alias] = c;
    }
  }

  const present = API_EXPECTED_CASES.filter((name) => flat[name]);
  const ok = present.filter((name) => Number(flat[name].samplesOk) > 0);

  if (present.length === 0) {
    return { status: 'BLOCKED', reason: 'sin casos de API resueltos (configuración o selección ausente)' };
  }
  if (present.length === API_EXPECTED_CASES.length && ok.length === present.length) {
    return { status: 'MEASURED' };
  }
  if (ok.length > 0) {
    return {
      status: 'BLOCKED',
      partialResults: true,
      reason: `éxito parcial: ${ok.length} de ${API_EXPECTED_CASES.length} casos esperados con muestras correctas`,
    };
  }
  return { status: 'BLOCKED', reason: 'ningún caso esperado con muestras correctas (sin resultados inventados)' };
}

// ---------------------------------------------------------------------------
// Resumen genérico del plan MongoDB (nunca valores de filtro)
// ---------------------------------------------------------------------------

/**
 * Convierte un winningPlan de MongoDB en un resumen GENÉRICO y seguro:
 * nombres de etapas, nombre del índice, keyPattern y sortPattern.
 *
 * Por qué es necesario: el winningPlan crudo puede contener VALORES reales
 * (el `filter` de un COLLSCAN o los `indexBounds` de un IXSCAN incluyen el
 * ObjectId del usuario o de los mazos consultados). Este resumen descarta
 * cualquier valor: sólo conserva nombres de campos y de etapas, que son
 * genéricos y no sensibles.
 */
function summarizeWinningPlan(winningPlan) {
  if (!winningPlan || typeof winningPlan !== 'object') return null;

  const stages = [];
  const collect = (node) => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.stage === 'string') stages.push(node.stage);
    for (const value of Object.values(node)) {
      if (value && typeof value === 'object') collect(value);
    }
  };
  collect(winningPlan);

  let indexName = null;
  let keyPattern = null;
  let sortPattern = null;
  const collectIndex = (node) => {
    if (!node || typeof node !== 'object') return;
    if (indexName === null && typeof node.indexName === 'string') indexName = node.indexName;
    if (keyPattern === null && node.keyPattern && typeof node.keyPattern === 'object') {
      keyPattern = JSON.stringify(node.keyPattern);
    }
    if (sortPattern === null && node.sortPattern && typeof node.sortPattern === 'object') {
      sortPattern = JSON.stringify(node.sortPattern);
    }
    for (const value of Object.values(node)) {
      if (value && typeof value === 'object') collectIndex(value);
    }
  };
  collectIndex(winningPlan);

  return {
    stages: [...new Set(stages)],
    indexName,
    keyPattern,
    sortPattern,
  };
}

// ---------------------------------------------------------------------------
// Agregados de longitud de campos de imagen (puros)
// ---------------------------------------------------------------------------

function sumStringLengths(values) {
  return (Array.isArray(values) ? values : [])
    .filter((v) => typeof v === 'string')
    .reduce((sum, v) => sum + v.length, 0);
}

function countNonEmptyStrings(values) {
  return (Array.isArray(values) ? values : [])
    .filter((v) => typeof v === 'string' && v.length > 0).length;
}

module.exports = {
  INDEXED_CONTRACT,
  THUMBNAIL_COVER,
  ALLOWED_METHOD,
  MAX_SAMPLES_PER_CASE,
  MAX_TIME_MS,
  PERF_USER_ALIAS,
  BASELINE_RELATIVE_DISTANCE,
  percentileSorted,
  medianSorted,
  deckCountStats,
  DECK_BUCKETS,
  bucketCardCounts,
  selectBaselineDecks,
  buildAliases,
  applyAliases,
  serializeRawResults,
  BaselineSanitizationError,
  sanitizeError,
  assertIndexedContract,
  buildLibraryUrl,
  buildDeckCardsUrl,
  classifyContract,
  clampSamples,
  assertReadOnlyMethod,
  BaselineTimeoutError,
  withTimeout,
  runSequentially,
  countElements,
  summarizeSamples,
  summarizeWinningPlan,
  buildAggregateOptions,
  validateMaxTimeMs,
  API_EXPECTED_CASES,
  classifyApiSectionStatus,
  sumStringLengths,
  countNonEmptyStrings,
};
