// FILE: backend/test/libraryScaleBaseline.test.js
// Fase 2A — baseline real de escala de Library y apertura de mazos.
// Pruebas deterministas de las utilidades puras del harness
// (backend/scripts/performance/libraryScaleBaselineUtils.js).
// Sin MongoDB, sin red, sin credenciales y sin dependencias.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  INDEXED_CONTRACT,
  MAX_SAMPLES_PER_CASE,
  MAX_TIME_MS,
  PERF_USER_ALIAS,
  BASELINE_RELATIVE_DISTANCE,
  percentileSorted,
  medianSorted,
  deckCountStats,
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
  classifyApiSectionStatus,
  sumStringLengths,
  countNonEmptyStrings,
} = require('../scripts/performance/libraryScaleBaselineUtils');
const { validateArgs } = require('../scripts/performance/libraryScaleBaseline');

// ---------------------------------------------------------------------------
// Estadística: mínimo, mediana, p95 y máximo
// ---------------------------------------------------------------------------

test('stats: percentiles sobre lista ordenada y no ordenada', () => {
  const sorted = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  assert.equal(percentileSorted(sorted, 50), 55);
  assert.equal(percentileSorted(sorted, 95), 95);
  assert.equal(percentileSorted([10, 20, 30, 40, 50], 50), 30);
  assert.equal(percentileSorted([], 50), null);
});

test('stats: deckCountStats calcula min, mediana, p95 y max', () => {
  const stats = deckCountStats([10, 20, 30, 40, 50]);
  assert.equal(stats.totalDecks, 5);
  assert.equal(stats.totalCards, 150);
  assert.equal(stats.min, 10);
  assert.equal(stats.median, 30);
  assert.equal(stats.max, 50);
  assert.equal(stats.p95, 45);
});

test('stats: sin mazos devuelve null, nunca inventa valores', () => {
  const stats = deckCountStats([]);
  assert.equal(stats.totalDecks, 0);
  assert.equal(stats.totalCards, 0);
  assert.equal(stats.min, null);
  assert.equal(stats.median, null);
  assert.equal(stats.p95, null);
  assert.equal(stats.max, null);
});

test('stats: ignora valores no numéricos', () => {
  const stats = deckCountStats([5, 'x', null, undefined, 15]);
  assert.equal(stats.totalDecks, 2);
  assert.equal(stats.totalCards, 20);
  assert.equal(stats.min, 5);
  assert.equal(stats.max, 15);
});

// ---------------------------------------------------------------------------
// Rangos de cantidad de tarjetas
// ---------------------------------------------------------------------------

test('buckets: rangos 0-20, 21-100, 101-499 y 500+', () => {
  const buckets = bucketCardCounts([0, 20, 21, 100, 101, 499, 500, 1200]);
  assert.deepEqual(buckets, [
    { range: '0-20', count: 2 },
    { range: '21-100', count: 2 },
    { range: '101-499', count: 2 },
    { range: '500+', count: 2 },
  ]);
});

test('buckets: bordes exactos caen en el rango correcto', () => {
  const buckets = bucketCardCounts([20, 21, 100, 101, 499, 500]);
  assert.deepEqual(buckets.map((b) => b.count), [1, 2, 2, 1]);
});

// ---------------------------------------------------------------------------
// Selección determinista de C20/C100/C500
// ---------------------------------------------------------------------------

test('select: elige el mazo más cercano a cada objetivo', () => {
  const decks = [
    { id: 'a'.repeat(24), cardCount: 22 },
    { id: 'b'.repeat(24), cardCount: 98 },
    { id: 'c'.repeat(24), cardCount: 480 },
  ];
  const selected = selectBaselineDecks(decks);
  assert.equal(selected.length, 3);
  assert.deepEqual(selected.map((s) => s.alias), ['C20-real', 'C100-real', 'C500-real']);
  assert.equal(selected[0].deckId, 'a'.repeat(24));
  assert.equal(selected[1].deckId, 'b'.repeat(24));
  assert.equal(selected[2].deckId, 'c'.repeat(24));
});

test('select: desempate determinista por id lexicográfico', () => {
  const zDeck = { id: 'f'.repeat(24), cardCount: 19 };
  const aDeck = { id: 'a'.repeat(24), cardCount: 19 };
  const selected = selectBaselineDecks([zDeck, aDeck]);
  assert.equal(selected[0].deckId, 'a'.repeat(24));
});

test('select: respeta el radio relativo (25%) y omite mazos lejanos', () => {
  const selected = selectBaselineDecks([
    { id: 'a'.repeat(24), cardCount: 2 },    // a 18 del objetivo 20: fuera del 25%
    { id: 'b'.repeat(24), cardCount: 24 },   // a 4: dentro
    { id: 'c'.repeat(24), cardCount: 300 },  // a 200 del objetivo 500: fuera
  ]);
  assert.deepEqual(selected.map((s) => s.alias), ['C20-real']);
  assert.equal(selected[0].deckId, 'b'.repeat(24));
  assert.equal(BASELINE_RELATIVE_DISTANCE, 0.25);
});

test('select: sin mazos válidos no selecciona nada', () => {
  assert.deepEqual(selectBaselineDecks([]), []);
  assert.deepEqual(selectBaselineDecks([{ id: 'x'.repeat(24), cardCount: -1 }]), []);
  assert.deepEqual(selectBaselineDecks([{ id: 'x'.repeat(24) }]), []);
});

test('select: C500-real queda ausente si no existe mazo cercano a 500', () => {
  const selected = selectBaselineDecks([
    { id: 'a'.repeat(24), cardCount: 21 },
    { id: 'b'.repeat(24), cardCount: 105 },
  ]);
  assert.deepEqual(selected.map((s) => s.alias), ['C20-real', 'C100-real']);
});

// ---------------------------------------------------------------------------
// Aliases y reemplazo de IDs
// ---------------------------------------------------------------------------

test('aliases: buildAliases mapea usuario y mazos seleccionados', () => {
  const selected = [
    { target: 20, alias: 'C20-real', deckId: 'a'.repeat(24) },
    { target: 100, alias: 'C100-real', deckId: 'b'.repeat(24) },
  ];
  const aliases = buildAliases('9'.repeat(24), selected);
  assert.equal(aliases['9'.repeat(24)], PERF_USER_ALIAS);
  assert.equal(aliases['a'.repeat(24)], 'C20-real');
  assert.equal(aliases['b'.repeat(24)], 'C100-real');
});

test('aliases: applyAliases reemplaza todas las apariciones de IDs reales', () => {
  const text = JSON.stringify({ userId: '9'.repeat(24), deckId: 'a'.repeat(24) });
  const aliased = applyAliases(text, buildAliases('9'.repeat(24), [{ deckId: 'a'.repeat(24), alias: 'C20-real' }]));
  assert.ok(!aliased.includes('9'.repeat(24)));
  assert.ok(!aliased.includes('a'.repeat(24)));
  assert.ok(aliased.includes(PERF_USER_ALIAS));
  assert.ok(aliased.includes('C20-real'));
});

// ---------------------------------------------------------------------------
// Serialización segura de raw-results
// ---------------------------------------------------------------------------

test('serialize: round-trip seguro con aliases y sin IDs reales', () => {
  const results = {
    user: 'real-user-A',
    own: { decks: 3, totalCards: 142, min: 20, median: 50, p95: 100, max: 120 },
    selectedDecks: [{ alias: 'C20-real', cardCount: 20 }],
  };
  const json = serializeRawResults(results, {});
  const parsed = JSON.parse(json);
  assert.equal(parsed.own.decks, 3);
  assert.ok(!json.includes('9'.repeat(24)));
});

test('serialize: rechaza IDs reales sin alias y los acepta con alias', () => {
  const results = { selectedDecks: [{ deckId: 'a'.repeat(24), alias: 'C20-real' }] };
  assert.throws(() => serializeRawResults(results, {}), BaselineSanitizationError);
  const aliases = {};
  aliases['a'.repeat(24)] = 'C20-real';
  const json = serializeRawResults(results, aliases);
  assert.ok(!json.includes('a'.repeat(24)));
  assert.ok(json.includes('C20-real'));
});

test('serialize: rechaza contenido de tarjetas por clave', () => {
  assert.throws(() => serializeRawResults({ answer: 'respuesta' }, {}), BaselineSanitizationError);
  assert.throws(() => serializeRawResults({ cards: [{ question: 'pregunta' }] }, {}), BaselineSanitizationError);
  assert.throws(() => serializeRawResults({ bgImage: '' }, {}), BaselineSanitizationError);
  assert.throws(() => serializeRawResults({ contentImage: '' }, {}), BaselineSanitizationError);
  assert.throws(() => serializeRawResults({ coverImage: '' }, {}), BaselineSanitizationError);
  assert.throws(() => serializeRawResults({ cardBackgrounds: ['x'] }, {}), BaselineSanitizationError);
});

test('serialize: rechaza Data URLs en cualquier valor', () => {
  assert.throws(
    () => serializeRawResults({ thumb: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' }, {}),
    BaselineSanitizationError
  );
  assert.throws(() => serializeRawResults({ note: 'prefijo data: en texto' }, {}), BaselineSanitizationError);
});

test('serialize: agrega alias y luego no quedan IDs reales', () => {
  const results = { userId: '9'.repeat(24), decks: [{ id: 'a'.repeat(24), count: 20 }] };
  const json = serializeRawResults(results, buildAliases('9'.repeat(24), [{ deckId: 'a'.repeat(24), alias: 'C20-real' }]));
  assert.ok(!json.includes('9'.repeat(24)));
  assert.ok(!json.includes('a'.repeat(24)));
  assert.ok(json.includes('real-user-A'));
  assert.ok(json.includes('C20-real'));
});

test('serialize: claves agregadas con nombre de campo no son contenido', () => {
  const results = {
    images: { withCoverImage: 2, withCoverImageThumb: 1, coverImageLength: 12345 },
    cards: { withContentImage: 3, contentImageLength: 999 },
  };
  const json = serializeRawResults(results, {});
  const parsed = JSON.parse(json);
  assert.equal(parsed.cards.withContentImage, 3);
});

// ---------------------------------------------------------------------------
// Sanitización de errores
// ---------------------------------------------------------------------------

test('sanitize: elimina base URL, IDs reales y URLs', () => {
  const message = sanitizeError(
    new Error(`GET https://api.example.com/api/decks/${'9'.repeat(24)}?contract=indexed falló`),
    { baseUrl: 'https://api.example.com', ids: ['9'.repeat(24)] }
  );
  assert.ok(!message.includes('api.example.com'));
  assert.ok(!message.includes('9'.repeat(24)));
  assert.ok(message.includes('<base-url>'));
});

test('sanitize: nunca expone credenciales ni URIs Mongo', () => {
  const message = sanitizeError(new Error('connect mongodb+srv://user:pass@cluster/db falló'));
  assert.ok(!message.includes('mongodb+srv://'));
  assert.ok(!message.includes('user:pass'));
  assert.ok(message.includes('<mongo-url>'));
});

test('sanitize: errores sin datos se conservan como texto', () => {
  assert.equal(sanitizeError(new Error('Timeout después de 5000 ms')), 'Timeout después de 5000 ms');
  assert.equal(sanitizeError('texto plano'), 'texto plano');
});

// ---------------------------------------------------------------------------
// Construcción de URLs con contrato indexado
// ---------------------------------------------------------------------------

test('urls: Library con contract=indexed y cover=thumbnail', () => {
  const url = buildLibraryUrl('https://api.example.com/', '9'.repeat(24), { includeTimestamp: false });
  assert.equal(
    url,
    `https://api.example.com/api/decks/${'9'.repeat(24)}?contract=indexed&cover=thumbnail`
  );
});

test('urls: Library replica el timestamp del cliente actual si se pide', () => {
  const url = buildLibraryUrl('https://api.example.com', '9'.repeat(24), { includeTimestamp: true });
  assert.ok(url.startsWith(`https://api.example.com/api/decks/${'9'.repeat(24)}?contract=indexed&cover=thumbnail&t=`));
  assert.ok(/&t=\d+$/.test(url));
});

test('urls: mazo con contract=indexed', () => {
  const url = buildDeckCardsUrl('https://api.example.com', 'a'.repeat(24));
  assert.equal(url, `https://api.example.com/api/flashcards/deck/${'a'.repeat(24)}?contract=indexed`);
});

test('urls: rechaza cualquier contrato legacy', () => {
  // Nota: contract ausente (undefined) cae al default indexado y NO se rechaza.
  assert.doesNotThrow(() => buildLibraryUrl('https://api.example.com', '9'.repeat(24)));
  assert.throws(() => buildLibraryUrl('https://api.example.com', '9'.repeat(24), { contract: '' }), /legacy/);
  assert.throws(() => buildLibraryUrl('https://api.example.com', '9'.repeat(24), { contract: 'legacy' }), /legacy/);
  assert.throws(() => buildDeckCardsUrl('https://api.example.com', 'a'.repeat(24), { contract: 'normal-session' }), /legacy/);
  assert.throws(() => assertIndexedContract(['indexed']), /legacy/);
  assert.throws(() => assertIndexedContract(null), /legacy/);
});

test('urls: rechaza valores ausentes', () => {
  assert.throws(() => buildLibraryUrl('', '9'.repeat(24)), /obligatorios/);
  assert.throws(() => buildLibraryUrl('https://api.example.com', ''), /obligatorios/);
  assert.throws(() => buildDeckCardsUrl('https://api.example.com', ''), /obligatorios/);
});

test('urls: classifyContract distingue indexed, legacy-missing y legacy-other', () => {
  assert.equal(classifyContract('indexed'), 'indexed');
  assert.equal(classifyContract(undefined), 'legacy-missing');
  assert.equal(classifyContract(''), 'legacy-other');
  assert.equal(classifyContract('legacy'), 'legacy-other');
  assert.equal(classifyContract(['indexed']), 'legacy-other');
});

// ---------------------------------------------------------------------------
// Política de peticiones
// ---------------------------------------------------------------------------

test('policy: límite máximo de cinco repeticiones por caso', () => {
  assert.equal(MAX_SAMPLES_PER_CASE, 5);
  assert.equal(clampSamples(10), 5);
  assert.equal(clampSamples(5), 5);
  assert.equal(clampSamples(3), 3);
  assert.equal(clampSamples(0), 1);
  assert.equal(clampSamples('x'), 1);
});

test('policy: rechaza métodos distintos de GET', () => {
  assert.doesNotThrow(() => assertReadOnlyMethod('GET'));
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
    assert.throws(() => assertReadOnlyMethod(method), new RegExp(method));
  }
});

test('policy: runSequentially espera cada tarea antes de la siguiente', async () => {
  const order = [];
  const tasks = [
    async () => { order.push('a'); await new Promise((r) => setTimeout(r, 20)); order.push('a-done'); return 1; },
    async () => { order.push('b'); return 2; },
  ];
  const results = await runSequentially(tasks);
  assert.deepEqual(results, [1, 2]);
  assert.deepEqual(order, ['a', 'a-done', 'b']);
});

test('policy: runSequentially detiene la secuencia ante un rechazo', async () => {
  let secondCalled = false;
  const tasks = [
    async () => { throw new Error('boom'); },
    async () => { secondCalled = true; return 2; },
  ];
  await assert.rejects(() => runSequentially(tasks), /boom/);
  assert.equal(secondCalled, false);
});

test('timeout: withTimeout rechaza sin inventar resultados', async () => {
  const slow = new Promise((resolve) => setTimeout(() => resolve({ totalMs: 999 }), 100));
  await assert.rejects(() => withTimeout(slow, 10), BaselineTimeoutError);
  const err = await withTimeout(Promise.resolve({ totalMs: 1 }), 10).then(() => null, (e) => e);
  assert.equal(err, null);
});

test('timeout: summarizeSamples no presenta p95 con 5 o menos muestras', () => {
  const summary = summarizeSamples([{ totalMs: 100 }, { totalMs: 200 }, { totalMs: 300 }, { totalMs: 400 }, { totalMs: 500 }]);
  assert.equal(summary.samples, 5);
  assert.equal(summary.medianMs, 300);
  assert.equal(summary.minMs, 100);
  assert.equal(summary.maxMs, 500);
  assert.equal(summary.p95Ms, 'NOT MEASURED');
});

test('timeout: muestras fallidas no se cuentan como latencia', () => {
  const summary = summarizeSamples([{ totalMs: 100 }, { error: 'x' }, { totalMs: 300 }]);
  assert.equal(summary.samples, 2);
  assert.equal(summary.minMs, 100);
  assert.equal(summary.maxMs, 300);
  assert.equal(summary.p95Ms, 'NOT MEASURED');
});

test('timeout: sin muestras válidas devuelve nulos, no fabrica valores', () => {
  const summary = summarizeSamples([]);
  assert.equal(summary.samples, 0);
  assert.equal(summary.minMs, null);
  assert.equal(summary.medianMs, null);
  assert.equal(summary.maxMs, null);
  assert.equal(summary.p95Ms, 'NOT MEASURED');
});

// ---------------------------------------------------------------------------
// Interpretación de respuestas
// ---------------------------------------------------------------------------

test('elements: deck-list cuenta el array de mazos', () => {
  assert.equal(countElements([{ id: 1 }, { id: 2 }], 'deck-list'), 2);
  assert.equal(countElements(null, 'deck-list'), null);
});

test('elements: deck-cards cuenta cards del payload indexado', () => {
  assert.equal(countElements({ backgrounds: [], cards: [{ id: 1 }] }, 'deck-cards'), 1);
  assert.equal(countElements({ cards: 'no' }, 'deck-cards'), null);
  assert.equal(countElements({}, 'deck-cards'), null);
});

// ---------------------------------------------------------------------------
// Opciones de agregación con maxTimeMS (compatibles con Atlas)
// ---------------------------------------------------------------------------

test('pipeline: buildAggregateOptions devuelve maxTimeMS como opción de cursor', () => {
  assert.deepEqual(buildAggregateOptions(5000), { maxTimeMS: 5000 });
  assert.deepEqual(buildAggregateOptions(1), { maxTimeMS: 1 });
});

test('pipeline: acepta enteros 1 y 5000 (límites del rango MAX_TIME_MS)', () => {
  assert.equal(MAX_TIME_MS, 5000);
  assert.equal(validateMaxTimeMs(1), 1);
  assert.equal(validateMaxTimeMs(5000), 5000);
  assert.deepEqual(buildAggregateOptions(1), { maxTimeMS: 1 });
  assert.deepEqual(buildAggregateOptions(5000), { maxTimeMS: 5000 });
});

test('pipeline: rechaza 0, 5001, 60000, negativos, decimales y texto', () => {
  for (const bad of [0, 5001, 60000, -1, -5000, 1.5, 4999.9, 'x', '5001', '', null, undefined, NaN, []]) {
    assert.throws(() => validateMaxTimeMs(bad), /maxTimeMS inválido/);
    assert.throws(() => buildAggregateOptions(bad), /maxTimeMS inválido/);
  }
});

test('pipeline: validateArgs aplica el mismo límite máximo de 5000', () => {
  const base = { userId: 'a'.repeat(24), baseUrl: 'https://api.example.com', mongoUrl: undefined, samples: '5', maxTimeMs: undefined, sections: undefined, out: undefined, help: false };
  const ok = validateArgs({ ...base, maxTimeMs: '5000' });
  assert.equal(ok.maxTimeMs, 5000);
  assert.equal(validateArgs({ ...base, maxTimeMs: '1' }).maxTimeMs, 1);
  for (const bad of ['0', '5001', '60000', '-5', '1.5', 'abc']) {
    assert.throws(() => validateArgs({ ...base, maxTimeMs: bad }), /maxTimeMS inválido/);
  }
});

// ---------------------------------------------------------------------------
// Estado parcial de la sección api
// ---------------------------------------------------------------------------

const okCase = (samplesOk = 5) => ({ samplesRequested: 5, samplesOk });
const failCase = () => ({ samplesRequested: 5, samplesOk: 0, blockedReason: 'all-requests-failed' });

test('api-status: MEASURED sólo cuando todos los casos esperados tienen muestras correctas', () => {
  const cases = {
    'deck-list': okCase(),
    'deck-cards': { 'C20-real': okCase(), 'C100-real': okCase(), 'C500-real': okCase() },
  };
  const result = classifyApiSectionStatus(cases);
  assert.equal(result.status, 'MEASURED');
  assert.equal(result.partialResults, undefined);
});

test('api-status: sólo deck-list correcto queda BLOCKED con partialResults', () => {
  const cases = {
    'deck-list': okCase(),
    'deck-cards': { status: 'NOT RUN', reason: 'sin selección de mazos' },
  };
  const result = classifyApiSectionStatus(cases);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.partialResults, true);
});

test('api-status: un deck-cards fallido degrada la sección aunque deck-list esté OK', () => {
  const cases = {
    'deck-list': okCase(),
    'deck-cards': { 'C20-real': okCase(), 'C100-real': okCase(), 'C500-real': failCase() },
  };
  const result = classifyApiSectionStatus(cases);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.partialResults, true);
});

test('api-status: todos los casos presentes fallidos quedan BLOCKED sin partialResults', () => {
  const cases = {
    'deck-list': failCase(),
    'deck-cards': { 'C20-real': failCase(), 'C100-real': failCase(), 'C500-real': failCase() },
  };
  const result = classifyApiSectionStatus(cases);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.partialResults, undefined);
});

test('api-status: casos ausentes o entrada inválida quedan BLOCKED', () => {
  assert.equal(classifyApiSectionStatus({}).status, 'BLOCKED');
  assert.equal(classifyApiSectionStatus(null).status, 'BLOCKED');
  assert.equal(classifyApiSectionStatus(undefined).status, 'BLOCKED');
  assert.equal(classifyApiSectionStatus({ 'deck-list': okCase() }).status, 'BLOCKED');
});

// ---------------------------------------------------------------------------
// Evidencia persistida: raw-results.json (determinista, sin red)
// ---------------------------------------------------------------------------

test('raw: explain de conteos persistido con nombre de muestra y valores originales', () => {
  const raw = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', '..', 'docs', 'performance-audit', 'research', 'library-scale', 'raw-results.json'),
    'utf8'
  ));
  const queries = raw.sections.explain.queries;
  assert.ok(queries['deck-counts-selected-sample'], 'la clave renombrada debe existir');
  assert.ok(!('deck-counts-aggregate' in queries), 'la clave antigua debe desaparecer');
  const counts = queries['deck-counts-selected-sample'];
  assert.equal(counts.nReturned, 3);
  assert.equal(counts.keysExamined, 620);
  assert.equal(counts.docsExamined, 0);
  assert.equal(counts.indexName, 'deckId_1');
  assert.equal(counts.keyPattern, '{"deckId":1}');
  assert.equal(counts.winningPlanStages.join('>'), 'GROUP>PROJECTION_COVERED>IXSCAN');
});

test('raw: estadísticas de latencia recalculadas desde samplesDetail (2 decimales)', () => {
  const raw = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', '..', 'docs', 'performance-audit', 'research', 'library-scale', 'raw-results.json'),
    'utf8'
  ));
  const api = raw.sections.api.cases;
  const cases = { 'deck-list': api['deck-list'], ...api['deck-cards'] };
  const round2 = (n) => Number(n.toFixed(2));
  for (const [name, c] of Object.entries(cases)) {
    const times = c.samplesDetail
      .filter((s) => Number.isFinite(s.totalMs))
      .map((s) => s.totalMs)
      .sort((a, b) => a - b);
    const median = round2(times[Math.floor(times.length / 2)]);
    assert.equal(median, round2(c.latency.medianMs), `${name}: mediana`);
    assert.equal(round2(times[0]), round2(c.latency.minMs), `${name}: mínimo`);
    assert.equal(round2(times[times.length - 1]), round2(c.latency.maxMs), `${name}: máximo`);
    assert.equal(c.latency.p95Ms, 'NOT MEASURED', `${name}: p95`);
  }
});

// ---------------------------------------------------------------------------
// Resumen genérico del plan MongoDB
// ---------------------------------------------------------------------------

test('plan: resume etapas, índice y patrones sin valores', () => {
  const plan = {
    stage: 'SORT',
    sortPattern: { createdAt: -1 },
    inputStage: {
      stage: 'IXSCAN',
      indexName: 'createdAt_-1',
      keyPattern: { createdAt: -1 },
      indexBounds: { userId: ["[ObjectId('abcdef0123456789abcdef01'), ObjectId('abcdef0123456789abcdef01')]"] },
    },
  };
  const summary = summarizeWinningPlan(plan);
  assert.deepEqual(summary.stages, ['SORT', 'IXSCAN']);
  assert.equal(summary.indexName, 'createdAt_-1');
  assert.equal(summary.keyPattern, '{"createdAt":-1}');
  assert.equal(summary.sortPattern, '{"createdAt":-1}');
  // Nunca conserva valores reales (ObjectIds, bounds o filtros).
  const json = JSON.stringify(summary);
  assert.ok(!json.includes('abcdef0123456789abcdef01'));
  assert.ok(!json.includes('indexBounds'));
  assert.ok(!json.includes('ObjectId'));
});

test('plan: COLLSCAN con filtro por userId queda genérico', () => {
  const plan = {
    stage: 'COLLSCAN',
    filter: { userId: { $eq: 'abcdef0123456789abcdef01' } },
    direction: 'forward',
  };
  const summary = summarizeWinningPlan(plan);
  assert.deepEqual(summary.stages, ['COLLSCAN']);
  assert.equal(summary.indexName, null);
  const json = JSON.stringify(summary);
  assert.ok(!json.includes('abcdef0123456789abcdef01'));
  assert.ok(!json.includes('filter'));
});

test('plan: entradas inválidas devuelven null', () => {
  assert.equal(summarizeWinningPlan(null), null);
  assert.equal(summarizeWinningPlan(undefined), null);
  assert.equal(summarizeWinningPlan('plan'), null);
});

test('plan: hasSortStage se deriva de las etapas', () => {
  const withSort = summarizeWinningPlan({ stage: 'SORT', inputStage: { stage: 'IXSCAN' } });
  assert.equal(withSort.stages.includes('SORT'), true);
  const withoutSort = summarizeWinningPlan({ stage: 'IXSCAN' });
  assert.equal(withoutSort.stages.includes('SORT'), false);
});

// ---------------------------------------------------------------------------
// Agregados de longitudes de imagen
// ---------------------------------------------------------------------------

test('images: sumStringLengths y countNonEmptyStrings', () => {
  assert.equal(sumStringLengths(['abc', '', 42, null]), 3);
  assert.equal(countNonEmptyStrings(['abc', '', 'd', null]), 2);
  assert.equal(sumStringLengths([]), 0);
});
