// FILE: frontend/tests/performance/library-browser/libraryBrowserProfileUtils.mjs
// Fase 2B — perfil real de navegador de Library.
// Utilidades PURAS del harness: deterministas, sin red, sin navegador y sin
// dependencias. Toda la lógica que las pruebas deben cubrir vive aquí.
//
// Reglas de seguridad (aplicadas también por el runner):
// - Sólo GET hacia el backend (las preflights OPTIONS del navegador se
//   identifican aparte y no se cuentan como solicitudes de aplicación).
// - Toda solicitud hacia superficies protegidas (lista de mazos, apertura de
//   mazo, all-cards) lleva obligatoriamente contract=indexed; la lista de
//   mazos lleva además cover=thumbnail. Cualquier otra combinación es legacy
//   y la guardia falla inmediatamente.
// - Las superficies que no participan en el contrato de imágenes (materias,
//   temas, subtemas, preferencias, balance, health) se identifican por
//   separado y NUNCA se clasifican falsamente como legacy.
// - Los resultados persistidos jamás contienen IDs reales, contenido,
//   Data URLs, cuerpos ni tokens: se serializan con aliases y se rechaza
//   cualquier hoja sospechosa.

const INDEXED_CONTRACT = 'indexed';
const THUMBNAIL_COVER = 'thumbnail';
const ALLOWED_METHOD = 'GET';
const VOLATILE_PARAMS = ['t'];
const MAX_SAMPLES_PER_CASE = 5;
const BASELINE_RELATIVE_DISTANCE = 0.25;
const PERF_USER_ALIAS = 'real-user-A';
const FORBIDDEN_RESULT_TOKENS = ['data:', 'MONGO_URI', 'MONGO_URL', 'Bearer '];
const FORBIDDEN_RESULT_KEYS = [
  'question', 'answer', 'bgImage', 'contentImage', 'coverImage',
  'coverImageThumb', 'cardBackgrounds', 'title', 'name', 'email',
  'token', 'cookie', 'authorization', 'credential', 'password',
];
const REAL_ID_PATTERN = /^[0-9a-f]{24}$/;

// ---------------------------------------------------------------------------
// Clasificación de superficies
// ---------------------------------------------------------------------------

/** Clasifica una ruta de API en superficie conocida (o 'other'). */
export function classifySurface(pathname) {
  const p = String(pathname || '');
  if (p === '/api/health') return 'health';
  if (/^\/api\/decks\/[^/]+\/all-cards$/.test(p)) return 'all-cards';
  if (/^\/api\/decks\/[^/]+\/export$/.test(p)) return 'deck-export';
  if (/^\/api\/decks\/[^/]+$/.test(p)) return 'deck-list';
  if (/^\/api\/flashcards\/deck\/[^/]+$/.test(p)) return 'deck-cards';
  if (/^\/api\/flashcards\/[^/]+$/.test(p)) return 'flashcard-single';
  if (/^\/api\/academic\/materias\/[^/]+\/domain-preview$/.test(p)) return 'materia-domain-preview';
  if (/^\/api\/academic\/materias\/[^/]+\/metrics-history$/.test(p)) return 'materia-metrics-history';
  if (/^\/api\/academic\/materias\/[^/]+$/.test(p)) return 'materias';
  if (/^\/api\/academic\/temas\/[^/]+$/.test(p)) return 'temas';
  if (/^\/api\/academic\/subtemas\/[^/]+$/.test(p)) return 'subtemas';
  if (/^\/api\/users\/[^/]+\/preferences$/.test(p)) return 'preferences';
  if (/^\/api\/user\/[^/]+\/balance$/.test(p)) return 'balance';
  return 'other';
}

/** Superficies obligadas al contrato indexado (Corte 5A). */
export function isProtectedSurface(surface) {
  return surface === 'deck-list' || surface === 'deck-cards' || surface === 'all-cards';
}

/** Clasificación del valor de contract, igual que la telemetría del 5A. */
export function classifyContractValue(value) {
  if (value === INDEXED_CONTRACT) return 'indexed';
  if (value === undefined || value === null || value === '') return 'legacy-missing';
  return 'legacy-other';
}

// ---------------------------------------------------------------------------
// Normalización de URLs de solicitudes
// ---------------------------------------------------------------------------

/** Separa URL en partes y normaliza eliminando sólo parámetros volátiles. */
export function normalizeRequestUrl(urlString, { volatileParams = VOLATILE_PARAMS } = {}) {
  let url;
  try {
    url = new URL(String(urlString));
  } catch {
    return { origin: null, pathname: String(urlString), params: {}, normalizedUrl: String(urlString), volatile: {} };
  }
  const params = {};
  const volatile = {};
  for (const [key, value] of url.searchParams.entries()) {
    if (volatileParams.includes(key)) volatile[key] = value;
    else params[key] = value;
  }
  const sortedParams = Object.keys(params).sort();
  const query = sortedParams.map((k) => `${k}=${params[k]}`).join('&');
  const normalizedUrl = `${url.origin}${url.pathname}${query ? `?${query}` : ''}`;
  return { origin: url.origin, pathname: url.pathname, params, volatile, normalizedUrl };
}

/**
 * Clave de grupo para solicitudes equivalentes: método + endpoint
 * normalizado + contrato + cover + superficie + ventana de navegación.
 */
export function requestGroupKey({ method, pathname, contract, cover, surface, window: navWindow }) {
  return JSON.stringify([String(method || '').toUpperCase(), pathname, contract || null, cover || null, surface || null, navWindow || null]);
}

/** Inspecciona una solicitud antes de enviarla; lanza GuardViolation si no pasa. */
export function assertRequestGuard({ method, urlString, surface, params }) {
  const methodUp = String(method || '').toUpperCase();
  if (methodUp === 'OPTIONS') {
    // Preflight CORS del navegador: no es una solicitud de aplicación.
    return { ok: true, kind: 'preflight', method: methodUp, surface: surface || 'preflight' };
  }
  if (methodUp !== ALLOWED_METHOD) {
    throw new GuardViolation('non-get', `método ${methodUp} no permitido (sólo GET)`);
  }
  const contract = classifyContractValue(params ? params.contract : undefined);
  const cover = params ? params.cover : undefined;

  if (surface === 'deck-list') {
    if (contract !== 'indexed') {
      throw new GuardViolation('legacy', `lista de mazos sin contract=indexed (${contract})`);
    }
    if (cover !== THUMBNAIL_COVER) {
      throw new GuardViolation('cover-missing', `lista de mazos sin cover=thumbnail (${String(cover)})`);
    }
    return { ok: true, kind: 'protected', surface, contract, cover };
  }
  if (surface === 'deck-cards' || surface === 'all-cards') {
    if (contract !== 'indexed') {
      throw new GuardViolation('legacy', `superficie ${surface} sin contract=indexed (${contract})`);
    }
    return { ok: true, kind: 'protected', surface, contract, cover };
  }
  // Superficies no protegidas: se identifican por separado; nunca legacy.
  return { ok: true, kind: 'other', surface, contract, cover };
}

export class GuardViolation extends Error {
  constructor(code, detail) {
    super(`GuardViolation[${code}]: ${detail}`);
    this.name = 'GuardViolation';
    this.code = code;
    this.detail = detail;
  }
}

// ---------------------------------------------------------------------------
// Solicitudes equivalentes o duplicadas
// ---------------------------------------------------------------------------

/** Intervalos [start, end] en ms (misma escala por ventana). */
function intervalsOverlap(a, b) {
  return a.start <= b.end && b.start <= a.end;
}

/** Clasifica un par de solicitudes del mismo grupo. */
export function classifyDuplicatePair(first, second) {
  if (!first || !second) return { duplicate: false, reason: 'missing-member' };
  const sameUrl = first.normalizedUrl === second.normalizedUrl;
  const sameMethod = String(first.method).toUpperCase() === String(second.method).toUpperCase();
  const simultaneous = intervalsOverlap(first, second);
  if (!sameUrl) return { duplicate: false, reason: 'different-url', simultaneous };
  if (!sameMethod) return { duplicate: false, reason: 'different-method', simultaneous };
  if (simultaneous) return { duplicate: true, reason: 'simultaneous-equivalent', simultaneous };
  return { duplicate: true, reason: 'sequential-equivalent', simultaneous: false };
}

/**
 * Redacta IDs reales (24 hex) incrustados en URLs: cada segmento de path que
 * sea un ID se convierte en ':id'. El origen se conserva tal cual (se redacta
 * después con redactUrlOrigin).
 */
export function redactUrlIds(urlString) {
  let url;
  try {
    url = new URL(String(urlString));
  } catch {
    return String(urlString).replace(REAL_ID_PATTERN, ':id');
  }
  const path = url.pathname
    .split('/')
    .map((segment) => (REAL_ID_PATTERN.test(segment) ? ':id' : segment))
    .join('/');
  return `${url.origin}${path}${url.search}`;
}

/**
 * Agrupa solicitudes equivalentes (misma URL normalizada) y reporta por
 * grupo: conteo, solapamiento, bytes, status, iniciadores y ventana.
 * La URL del grupo se redacta (IDs reales → ':id') para poder persistirse;
 * la agrupación en sí se hace sobre la URL real normalizada.
 */
export function groupEquivalentRequests(requests) {
  const byUrl = new Map();
  for (const req of Array.isArray(requests) ? requests : []) {
    const key = req.normalizedUrl;
    if (!byUrl.has(key)) byUrl.set(key, []);
    byUrl.get(key).push(req);
  }
  const groups = [];
  for (const [normalizedUrl, members] of byUrl.entries()) {
    const sorted = [...members].sort((a, b) => a.start - b.start);
    let overlaps = 0;
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        if (intervalsOverlap(sorted[i], sorted[j])) overlaps += 1;
      }
    }
    groups.push({
      normalizedUrl: redactUrlIds(normalizedUrl),
      method: sorted[0]?.method || null,
      surface: sorted[0]?.surface || null,
      contract: sorted[0]?.contract || null,
      cover: sorted[0]?.cover || null,
      window: sorted[0]?.window || null,
      count: sorted.length,
      overlappingPairs: overlaps,
      statuses: sorted.map((r) => r.status).filter((v) => v !== undefined),
      transferBytes: sorted.map((r) => r.transferSize).filter((v) => Number.isFinite(v)),
      initiators: [...new Set(sorted.map((r) => r.initiator).filter(Boolean))],
      samples: sorted.map((r) => ({
        start: r.start,
        end: r.end,
        status: r.status,
        initiator: r.initiator || null,
        transferSize: r.transferSize ?? null,
        encodedBodySize: r.encodedBodySize ?? null,
        decodedBodySize: r.decodedBodySize ?? null,
      })),
    });
  }
  return groups.sort((a, b) => a.count - b.count || a.normalizedUrl.localeCompare(b.normalizedUrl));
}

// ---------------------------------------------------------------------------
// Estadísticas
// ---------------------------------------------------------------------------

function medianSorted(sorted) {
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Resumen min/mediana/max. Con ≤5 muestras el p95 queda NOT MEASURED. */
export function summarizeValues(values) {
  const finite = (Array.isArray(values) ? values : []).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  return {
    samples: finite.length,
    min: finite.length ? finite[0] : null,
    median: medianSorted(finite),
    max: finite.length ? finite[finite.length - 1] : null,
    p95: finite.length > MAX_SAMPLES_PER_CASE ? finite[Math.min(finite.length - 1, Math.floor((95 / 100) * (finite.length - 1)))] : 'NOT MEASURED',
  };
}

// ---------------------------------------------------------------------------
// Selección determinista de mazos C20/C100/C500 (misma regla que la Fase 2A)
// ---------------------------------------------------------------------------

/**
 * Selecciona, para cada objetivo (20/100/500), el mazo propio más cercano
 * dentro del radio relativo BASELINE_RELATIVE_DISTANCE (25%).
 * Desempate: menor distancia y, a igualdad, id lexicográfico.
 */
export function selectBaselineDecks(decks) {
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

/** Conteo de elementos de una respuesta según la superficie (igual que 2A). */
export function countElements(payload, surface) {
  if (surface === 'deck-list') return Array.isArray(payload) ? payload.length : null;
  if (surface === 'deck-cards' || surface === 'all-cards') {
    return payload && Array.isArray(payload.cards) ? payload.cards.length : null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Redacción de URLs para resultados persistidos
// ---------------------------------------------------------------------------

/**
 * Convierte un pathname en un patrón genérico: los segmentos que son IDs reales
 * (24 hex) se reemplazan por ':id' para que los resultados persistidos nunca
 * contengan identificadores reales.
 */
export function pathnameToPattern(pathname) {
  return String(pathname || '')
    .split('/')
    .map((segment) => (REAL_ID_PATTERN.test(segment) ? ':id' : segment))
    .join('/');
}

/**
 * Redacta el origen real del backend en cualquier valor persistible. Nunca
 * deja la URL del backend productivo en los resultados.
 */
export function redactUrlOrigin(value, origin) {
  if (!origin) return value;
  if (typeof value === 'string') {
    return value.split(String(origin)).join('<backend-url>');
  }
  if (Array.isArray(value)) return value.map((v) => redactUrlOrigin(v, origin));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, child] of Object.entries(value)) out[key] = redactUrlOrigin(child, origin);
    return out;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Sanitización de resultados persistidos
// ---------------------------------------------------------------------------

/** Mapa de aliases por defecto: usuario real-user-A y C{target}-real. */
export function buildAliases(userId, selectedDecks) {
  const aliases = {};
  if (userId && typeof userId === 'string' && userId.length) aliases[userId] = PERF_USER_ALIAS;
  for (const item of Array.isArray(selectedDecks) ? selectedDecks : []) {
    if (item && item.deckId) aliases[String(item.deckId)] = item.alias;
  }
  return aliases;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Reemplaza exactamente los IDs reales por sus aliases en un texto JSON. */
export function applyAliases(text, aliases) {
  let out = String(text);
  for (const [realId, alias] of Object.entries(aliases || {})) {
    if (!realId || !alias) continue;
    out = out.replace(new RegExp(escapeRegExp(realId), 'g'), alias);
  }
  return out;
}

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

export class SanitizationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SanitizationError';
  }
}

/**
 * Serializa resultados a JSON con las mismas garantías que la Fase 2A:
 * - ninguna clave de hoja coincide con claves de contenido;
 * - ningún token prohibido aparece en valores;
 * - ningún ID real (24 hex) queda presente en NINGÚN punto del texto
 *   (incluso incrustado dentro de cadenas más largas, p. ej. URLs), salvo
 *   que esté alineado con `aliases` o contenido en `allowedHexTokens`
 *   (p. ej. los SHAs públicos del informe);
 * - ninguna cadena larga (>256) sin alias (posible contenido copiado).
 */
export function sanitizeResults(results, aliases, { allowedHexTokens = [] } = {}) {
  const leaves = [];
  collectLeaves(results, leaves, '');
  for (const { path, value } of leaves) {
    const key = String(path).split('.').pop().replace(/\[\d+\]$/, '');
    if (FORBIDDEN_RESULT_KEYS.includes(key)) {
      throw new SanitizationError(`clave prohibida en resultados: ${path}`);
    }
    if (typeof value === 'string' && FORBIDDEN_RESULT_TOKENS.some((t) => value.includes(t))) {
      throw new SanitizationError(`token prohibido en resultados en ${path}`);
    }
    if (typeof value === 'string' && value.length > 256 && !REAL_ID_PATTERN.test(value)) {
      throw new SanitizationError(`cadena larga sin alias en resultados (posible contenido): ${path}`);
    }
  }
  const rawJson = JSON.stringify(results, null, 2);
  const withAliases = applyAliases(rawJson, aliases);
  const idMatch = withAliases.match(/[0-9a-f]{24}/g) || [];
  for (const token of idMatch) {
    const allowed = (aliases && aliases[token]) || allowedHexTokens.some((t) => String(t).includes(token));
    if (!allowed) {
      throw new SanitizationError(`ID real sin alias en resultados: ${token}`);
    }
  }
  return withAliases;
}

export const CONSTANTS = {
  INDEXED_CONTRACT,
  THUMBNAIL_COVER,
  ALLOWED_METHOD,
  VOLATILE_PARAMS,
  MAX_SAMPLES_PER_CASE,
  BASELINE_RELATIVE_DISTANCE,
  PERF_USER_ALIAS,
};
