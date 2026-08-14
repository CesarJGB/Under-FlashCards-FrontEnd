// FILE: backend/scripts/performance/libraryScaleBaseline.js
// Fase 2A — baseline real de escala de Library y apertura de mazos.
// Harness READ-ONLY, determinista y NO productivo. Mide y documenta; no
// implementa optimizaciones.
//
// Garantías:
// - Sólo operaciones de lectura MongoDB (find/aggregate/explain con
//   maxTimeMS) y únicamente peticiones HTTP GET con el contrato indexado
//   (contract=indexed y cover=thumbnail en la lista de mazos).
// - Nunca crea, edita, borra, importa o mueve datos; nunca ejecuta
//   save/update/insert/delete/bulkWrite; nunca crea índices ni migraciones.
// - No almacena cuerpos de respuestas, Data URLs, contenido de tarjetas,
//   credenciales, tokens ni IDs reales: los resultados se serializan sólo
//   con aliases (real-user-A, C20-real, C100-real, C500-real) mediante
//   serializeRawResults().
// - Sin credenciales configuradas, cada sección se reporta BLOCKED y el
//   proceso termina con código 3; nunca inventa métricas.
//
// Configuración (variables de entorno o argumentos):
//   PERF_TEST_USER_ID / --user-id   usuario real autorizado (obligatorio)
//   BASE_URL          / --base-url  URL de la API (obligatoria para la sección api)
//   MONGO_URL|MONGO_URI / --mongo-url  cadena de conexión Mongo (obligatoria para inventory/explain)
//   --samples <1..5>               máx. solicitudes secuenciales por caso (default 5)
//   --max-time-ms <1..5000>        límite por consulta/petición (default 5000; máx. 5000)
//   --sections <lista>             inventory,api,explain (default: todas)
//   --out <path>                   archivo JSON de resultados seguros (opcional)
//   --help                          esta ayuda
//
// Códigos de salida: 0 éxito (al menos una sección ejecutada); 2 error de
// argumentos/validación; 3 todas las secciones BLOCKED por configuración
// ausente; 1 fallo inesperado.

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const http = require('http');
const https = require('https');
const zlib = require('zlib');
const path = require('path');
const fs = require('fs');
const { performance } = require('perf_hooks');

const {
  INDEXED_CONTRACT,
  MAX_SAMPLES_PER_CASE,
  MAX_TIME_MS,
  deckCountStats,
  bucketCardCounts,
  selectBaselineDecks,
  buildAliases,
  serializeRawResults,
  sanitizeError,
  buildLibraryUrl,
  buildDeckCardsUrl,
  clampSamples,
  withTimeout,
  BaselineTimeoutError,
  countElements,
  summarizeSamples,
  summarizeWinningPlan,
  buildAggregateOptions,
  validateMaxTimeMs,
  classifyApiSectionStatus,
  sumStringLengths,
  countNonEmptyStrings,
} = require('./libraryScaleBaselineUtils');

const DB_NAME = process.env.DB_NAME || 'flashcards';
const DEFAULT_SECTIONS = ['inventory', 'api', 'explain'];

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const USAGE = `Uso:
  node scripts/performance/libraryScaleBaseline.js [opciones]

Baseline read-only de escala de Library y apertura de mazos (Fase 2A).
Sólo GET con contrato indexado y lecturas MongoDB con maxTimeMS.
Nunca escribe datos; los resultados sólo contienen aliases y agregados.

Opciones:
  --user-id <id>        Usuario autorizado (env: PERF_TEST_USER_ID, obligatorio)
  --base-url <url>      URL base de la API (env: BASE_URL; sección api)
  --mongo-url <url>     URI de MongoDB (env: MONGO_URL o MONGO_URI; inventory/explain)
  --samples <n>         Solicitudes por caso, 1..5 (default 5; el límite es 5)
  --max-time-ms <ms>    Timeout por consulta/petición (default ${MAX_TIME_MS}; máximo ${MAX_TIME_MS} por consulta MongoDB)
  --sections <lista>    inventory,api,explain separadas por coma (default todas)
  --out <path>          Escribe resultados seguros JSON en <path> (opcional)
  --help                Muestra esta ayuda y termina

Códigos de salida:
  0  al menos una sección se ejecutó correctamente
  2  error de argumentos o validación
  3  todas las secciones BLOCKED por configuración ausente
  1  fallo inesperado

Privacidad: los resultados persistidos contienen exclusivamente aliases
(real-user-A, C20-real, C100-real, C500-real) y métricas agregadas.`;

function parseArgs(argv) {
  const args = { userId: undefined, baseUrl: undefined, mongoUrl: undefined, samples: undefined, maxTimeMs: undefined, sections: undefined, out: undefined, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => { i += 1; return argv[i]; };
    switch (arg) {
      case '--help': args.help = true; break;
      case '--user-id': args.userId = next(); break;
      case '--base-url': args.baseUrl = next(); break;
      case '--mongo-url': args.mongoUrl = next(); break;
      case '--samples': args.samples = next(); break;
      case '--max-time-ms': args.maxTimeMs = next(); break;
      case '--sections': args.sections = next(); break;
      case '--out': args.out = next(); break;
      default:
        if (arg.startsWith('-')) throw new Error(`Argumento desconocido: ${arg}`);
        throw new Error(`Argumento posicional no permitido: ${arg}`);
    }
  }
  if (args.userId === undefined && process.env.PERF_TEST_USER_ID) args.userId = process.env.PERF_TEST_USER_ID;
  if (args.baseUrl === undefined && process.env.BASE_URL) args.baseUrl = process.env.BASE_URL;
  if (args.mongoUrl === undefined && (process.env.MONGO_URL || process.env.MONGO_URI)) {
    args.mongoUrl = process.env.MONGO_URL || process.env.MONGO_URI;
  }
  return args;
}

function validateArgs(args) {
  if (!args.userId || typeof args.userId !== 'string') {
    throw new Error('Falta PERF_TEST_USER_ID: proporciónalo con --user-id o la variable PERF_TEST_USER_ID');
  }
  if (args.userId.length !== 24 || !/^[0-9a-f]{24}$/.test(args.userId)) {
    throw new Error('PERF_TEST_USER_ID debe ser un ObjectId de 24 caracteres hexadecimales');
  }
  if (args.baseUrl !== undefined) {
    try {
      const u = new URL(args.baseUrl);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error();
    } catch {
      throw new Error('--base-url debe ser una URL http(s) válida');
    }
  }
  if (args.mongoUrl !== undefined && !/^mongodb(\+srv)?:\/\//.test(args.mongoUrl)) {
    throw new Error('--mongo-url debe ser una URI mongodb:// o mongodb+srv://');
  }
  if (args.samples !== undefined) {
    const n = Number(args.samples);
    if (!Number.isInteger(n) || n < 1 || n > MAX_SAMPLES_PER_CASE) {
      throw new Error(`--samples debe ser un entero entre 1 y ${MAX_SAMPLES_PER_CASE}`);
    }
  }
  if (args.maxTimeMs !== undefined) {
    // Límite impuesto por construcción: entero entre 1 y MAX_TIME_MS (5000).
    // Ninguna consulta MongoDB recibe más de 5000 ms.
    args.maxTimeMs = validateMaxTimeMs(args.maxTimeMs);
  }
  if (args.sections !== undefined) {
    const parts = String(args.sections).split(',').map((s) => s.trim()).filter(Boolean);
    for (const p of parts) {
      if (!DEFAULT_SECTIONS.includes(p)) throw new Error(`Sección desconocida: ${p} (válidas: ${DEFAULT_SECTIONS.join(',')})`);
    }
    args.sectionList = parts;
  } else {
    args.sectionList = [...DEFAULT_SECTIONS];
  }
  return args;
}

// ---------------------------------------------------------------------------
// HTTP GET con medición (TTFB, total, bytes, encoding, JSON.parse)
// ---------------------------------------------------------------------------

function httpGetMeasured(urlString, { timeoutMs }) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const transport = url.protocol === 'https:' ? https : http;
    const start = performance.now();
    let ttfbMs = null;
    const chunks = [];
    let wireBytes = 0;

    const request = transport.get(url, { headers: { accept: 'application/json' } }, (res) => {
      ttfbMs = performance.now() - start;
      const contentEncoding = (res.headers['content-encoding'] || '').toString();
      res.on('data', (chunk) => { chunks.push(chunk); wireBytes += chunk.length; });
      res.on('end', () => {
        try {
          const totalMs = performance.now() - start;
          const buffer = Buffer.concat(chunks);
          let text;
          if (/gzip/i.test(contentEncoding)) text = zlib.gunzipSync(buffer).toString('utf8');
          else if (/deflate/i.test(contentEncoding)) text = zlib.inflateSync(buffer).toString('utf8');
          else if (/br/i.test(contentEncoding)) text = zlib.brotliDecompressSync(buffer).toString('utf8');
          else text = buffer.toString('utf8');

          const parseStart = performance.now();
          let parsed;
          try { parsed = JSON.parse(text); } finally { /* el parseo se mide, no se falla aquí */ }
          const parseMs = performance.now() - parseStart;

          resolve({
            status: res.statusCode,
            ttfbMs,
            totalMs,
            parseMs,
            wireBytes,
            contentEncoding: contentEncoding || null,
            payload: parsed,
          });
        } catch (err) {
          reject(err);
        }
      });
    });

    request.on('error', reject);
    request.setTimeout(timeoutMs, () => {
      request.destroy(new BaselineTimeoutError(timeoutMs));
    });
  });
}

// ---------------------------------------------------------------------------
// Sección 1 — Inventario agregado (MongoDB, sólo lectura)
// ---------------------------------------------------------------------------

async function runInventory({ userId, maxTimeMs }) {
  const Deck = require('../../src/models/Deck');
  const Flashcard = require('../../src/models/Flashcard');
  // Los aggregates de Mongoose NO castean tipos: el $match debe usar ObjectId.
  const userIdOid = new (require('mongoose').Types.ObjectId)(userId);

  // Conjunto "propio": mazos del usuario. Conjunto "visible": lo que devuelve
  // GET /api/decks/:userId (propios + isDefault + isPublicReadOnly).
  const ownDecks = await Deck.find({ userId })
    .select('_id coverImage coverImageThumb cardBackgrounds')
    .lean()
    .maxTimeMS(maxTimeMs)
    .exec();

  const ownIds = ownDecks.map((d) => d._id);
  // Nota Mongoose 9 + Atlas: Aggregate no expone .maxTimeMS() y la etapa
  // $maxTimeMS no está permitida; el límite va como opción del cursor.
  const countRows = await Flashcard.aggregate([
    { $match: { deckId: { $in: ownIds } } },
    { $group: { _id: '$deckId', count: { $sum: 1 } } },
  ])
    .option(buildAggregateOptions(maxTimeMs))
    .exec();

  const countMap = new Map(countRows.map((r) => [String(r._id), r.count]));
  const ownCounts = ownDecks.map((d) => countMap.get(String(d._id)) || 0);

  const contentStats = await Flashcard.aggregate([
    { $match: { userId: userIdOid } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        withContentImage: {
          $sum: { $cond: [{ $gt: [{ $strLenCP: { $toString: { $ifNull: ['$contentImage', ''] } } }, 0] }, 1, 0] },
        },
        contentImageLength: { $sum: { $strLenCP: { $toString: { $ifNull: ['$contentImage', ''] } } } },
      },
    },
  ])
    .option(buildAggregateOptions(maxTimeMs))
    .exec();

  const visibleDecks = await Deck.find({
    $or: [{ userId }, { isDefault: true }, { isPublicReadOnly: true }],
  })
    .select('_id coverImage coverImageThumb cardBackgrounds')
    .lean()
    .maxTimeMS(maxTimeMs)
    .exec();

  const visibleIds = visibleDecks.map((d) => d._id);
  const visibleCountRows = await Flashcard.aggregate([
    { $match: { deckId: { $in: visibleIds } } },
    { $group: { _id: '$deckId', count: { $sum: 1 } } },
  ])
    .option(buildAggregateOptions(maxTimeMs))
    .exec();
  const visibleCountMap = new Map(visibleCountRows.map((r) => [String(r._id), r.count]));
  const visibleCounts = visibleDecks.map((d) => visibleCountMap.get(String(d._id)) || 0);

  const summarizeImageFields = (decks) => ({
    withCoverImage: countNonEmptyStrings(decks.map((d) => d.coverImage)),
    withCoverImageThumb: countNonEmptyStrings(decks.map((d) => d.coverImageThumb)),
    coverImageLength: sumStringLengths(decks.map((d) => d.coverImage)),
    withCardBackgrounds: decks.filter((d) => Array.isArray(d.cardBackgrounds) && d.cardBackgrounds.length > 0).length,
    cardBackgroundsEntries: decks.reduce((s, d) => s + (Array.isArray(d.cardBackgrounds) ? d.cardBackgrounds.length : 0), 0),
    cardBackgroundsLength: decks.reduce((s, d) => s + sumStringLengths(d.cardBackgrounds || []), 0),
  });

  // Selección interna (con deckId real, que NUNCA se persiste).
  const selected = selectBaselineDecks(
    ownDecks.map((d) => ({ id: String(d._id), cardCount: countMap.get(String(d._id)) || 0 }))
  );

  const content = contentStats[0] || { total: 0, withContentImage: 0, contentImageLength: 0 };

  return {
    selected,
    report: {
      section: 'inventory',
      user: 'real-user-A',
      own: {
        decks: ownDecks.length,
        ...deckCountStats(ownCounts),
        buckets: bucketCardCounts(ownCounts),
        images: summarizeImageFields(ownDecks),
      },
      visible: {
        decks: visibleDecks.length,
        ...deckCountStats(visibleCounts),
      },
      cards: {
        totalCards: content.total,
        withContentImage: content.withContentImage,
        contentImageLength: content.contentImageLength,
      },
      selectedDecks: selected.map((s) => ({ alias: s.alias, cardCount: s.cardCount, distance: s.distance })),
    },
  };
}

// ---------------------------------------------------------------------------
// Sección 2 — Medición de API (sólo GET indexado)
// ---------------------------------------------------------------------------

async function runApi({ baseUrl, userId, samples, maxTimeMs, inventorySelected }) {
  const results = { section: 'api', baseUrl: '<base-url>', contract: INDEXED_CONTRACT, cases: {} };

  const runCase = async (name, url, surface, extraIds = []) => {
    const rawSamples = [];
    for (let attempt = 1; attempt <= samples; attempt += 1) {
      try {
        // El límite real de la petición es maxTimeMs (≤ MAX_TIME_MS). El
        // margen extra del wrapper (+1000 ms) es sólo cierre local de la
        // promesa; ninguna consulta MongoDB recibe más de 5000 ms.
        const response = await withTimeout(httpGetMeasured(url, { timeoutMs: maxTimeMs }), maxTimeMs + 1000);
        rawSamples.push({
          attempt,
          status: response.status,
          elements: countElements(response.payload, surface),
          wireBytes: response.wireBytes,
          ttfbMs: response.ttfbMs,
          totalMs: response.totalMs,
          parseMs: response.parseMs,
          contentEncoding: response.contentEncoding,
        });
      } catch (err) {
        rawSamples.push({
          attempt,
          error: sanitizeError(err, { baseUrl, ids: [userId, ...extraIds] }),
          reason: err instanceof BaselineTimeoutError ? 'timeout' : 'error',
        });
      }
    }

    const okSamples = rawSamples.filter((s) => s.status !== undefined);
    const wireBytes = okSamples.map((s) => s.wireBytes).sort((a, b) => a - b);
    const base = {
      surface: name,
      contract: INDEXED_CONTRACT,
      samplesRequested: samples,
      samplesOk: okSamples.length,
      statuses: okSamples.map((s) => s.status),
      elements: okSamples.length ? okSamples[okSamples.length - 1].elements : null,
      wireBytesMin: wireBytes.length ? wireBytes[0] : null,
      wireBytesMedian: wireBytes.length ? wireBytes[Math.floor(wireBytes.length / 2)] : null,
      wireBytesMax: wireBytes.length ? wireBytes[wireBytes.length - 1] : null,
      contentEncoding: [...new Set(okSamples.map((s) => s.contentEncoding))],
      latency: summarizeSamples(okSamples),
      samplesDetail: rawSamples.map((s) => {
        if (s.error) return { attempt: s.attempt, reason: s.reason, error: s.error };
        return {
          attempt: s.attempt,
          status: s.status,
          ttfbMs: Number(s.ttfbMs.toFixed(2)),
          totalMs: Number(s.totalMs.toFixed(2)),
          parseMs: Number(s.parseMs.toFixed(2)),
          wireBytes: s.wireBytes,
        };
      }),
    };
    if (okSamples.length === 0) {
      base.blockedReason = rawSamples.some((s) => s.reason === 'timeout') ? 'timeout' : 'all-requests-failed';
    }
    return base;
  };

  // Caso 1 — lista de mazos indexada con cover=thumbnail (como App.jsx).
  const libraryUrl = buildLibraryUrl(baseUrl, userId);
  results.cases['deck-list'] = await runCase('deck-list', libraryUrl, 'deck-list');

  // Selección de mazos: se reutiliza la del inventario si existe; si no, se
  // deriva con UNA petición extra a la lista (fuera de los casos medidos).
  let selectedForApi = inventorySelected && inventorySelected.length ? inventorySelected : null;
  if (!selectedForApi) {
    try {
      const selectionResponse = await withTimeout(httpGetMeasured(libraryUrl, { timeoutMs: maxTimeMs }), maxTimeMs + 1000);
      if (selectionResponse.status === 200 && Array.isArray(selectionResponse.payload)) {
        selectedForApi = selectBaselineDecks(
          selectionResponse.payload
            .filter((d) => d && d.id)
            .map((d) => ({ id: String(d.id), cardCount: Number(d.cardCount) || 0 }))
        );
      }
    } catch { /* sin selección: se reporta NOT RUN */ }
  }

  if (!selectedForApi || selectedForApi.length === 0) {
    results.cases['deck-cards'] = {
      surface: 'deck-cards',
      contract: INDEXED_CONTRACT,
      status: 'NOT RUN',
      reason: 'sin selección de mazos C20/C100/C500 (inventario bloqueado o respuesta de lista sin cardCount)',
    };
    return results;
  }

  results.cases['deck-cards'] = {};
  for (const sel of selectedForApi) {
    const url = buildDeckCardsUrl(baseUrl, sel.deckId);
    results.cases['deck-cards'][sel.alias] = await runCase(`deck-cards:${sel.alias}`, url, 'deck-cards', [sel.deckId]);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Sección 3 — Consultas MongoDB con explain (sólo lectura, una vez cada una)
// ---------------------------------------------------------------------------

async function runExplain({ userId, maxTimeMs, selectedDecks }) {
  const Deck = require('../../src/models/Deck');
  const Flashcard = require('../../src/models/Flashcard');

  const extractExplain = (doc) => {
    const cursor = doc && doc.stages && doc.stages[0] && doc.stages[0].$cursor
      ? doc.stages[0].$cursor
      : doc;
    const planner = cursor && cursor.queryPlanner;
    const execution = cursor && cursor.executionStats;
    // Resumen GENÉRICO del plan: el winningPlan crudo puede contener valores
    // reales (ObjectIds en filter/indexBounds); aquí sólo se conservan etapas,
    // nombre del índice y patrones de campos (seguro para persistir).
    const planSummary = summarizeWinningPlan(planner ? planner.winningPlan : null);
    return {
      winningPlanStages: planSummary ? planSummary.stages : null,
      indexName: planSummary ? planSummary.indexName : null,
      keyPattern: planSummary ? planSummary.keyPattern : null,
      sortPattern: planSummary ? planSummary.sortPattern : null,
      hasSortStage: planSummary
        ? planSummary.stages.some((s) => s === 'SORT' || s === 'SORT_MERGE')
        : null,
      nReturned: execution ? execution.nReturned : null,
      docsExamined: execution ? execution.totalDocsExamined : null,
      keysExamined: execution ? execution.totalKeysExamined : null,
      executionTimeMillis: execution ? execution.executionTimeMillis : null,
    };
  };

  const results = { section: 'explain', queries: {} };

  const runQuery = async (name, task) => {
    try {
      // maxTimeMs se aplica dentro de la consulta (find/aggregate/explain con
      // .maxTimeMS()/.option()); el margen extra del wrapper (+2000 ms) es
      // sólo cierre local de la promesa, nunca llega a MongoDB.
      const doc = await withTimeout(task(), maxTimeMs + 2000);
      results.queries[name] = { status: 'ok', ...extractExplain(doc) };
    } catch (err) {
      results.queries[name] = {
        status: 'BLOCKED',
        reason: err instanceof BaselineTimeoutError ? 'timeout' : 'permission-or-error',
        error: sanitizeError(err, { ids: [userId] }),
      };
    }
  };

  await runQuery('deck-list', () =>
    Deck.find({ $or: [{ userId }, { isDefault: true }, { isPublicReadOnly: true }] })
      .sort({ createdAt: -1 })
      .maxTimeMS(maxTimeMs)
      .explain('executionStats')
  );

  const deckIds = (selectedDecks || []).map((s) => new (require('mongoose').Types.ObjectId)(s.deckId));
  // Muestra de conteos: SOLO los tres mazos seleccionados (C20/C100/C500-real).
  // No es el aggregate completo del endpoint de Library (29 mazos visibles):
  // ese explain no se midió y queda NOT MEASURED (ver reporte Fase 2A).
  await runQuery('deck-counts-selected-sample', () =>
    Flashcard.aggregate([
      { $match: { deckId: { $in: deckIds } } },
      { $group: { _id: '$deckId', count: { $sum: 1 } } },
    ])
      .option(buildAggregateOptions(maxTimeMs))
      .explain('executionStats')
  );

  for (const sel of selectedDecks || []) {
    await runQuery(`deck-cards:${sel.alias}`, () =>
      Flashcard.find({ deckId: sel.deckId })
        .sort({ createdAt: -1 })
        .maxTimeMS(maxTimeMs)
        .explain('executionStats')
    );
  }

  return results;
}

// ---------------------------------------------------------------------------
// Orquestación
// ---------------------------------------------------------------------------

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    console.error('Usa --help para la ayuda.');
    process.exit(2);
  }

  if (args.help) {
    console.log(USAGE);
    process.exit(0);
  }

  try {
    args = validateArgs(args);
  } catch (err) {
    console.error(`Error de validación: ${err.message}`);
    process.exit(2);
  }

  const userId = args.userId;
  const maxTimeMs = args.maxTimeMs !== undefined ? Number(args.maxTimeMs) : MAX_TIME_MS;
  const samples = clampSamples(args.samples !== undefined ? Number(args.samples) : MAX_SAMPLES_PER_CASE);

  const report = {
    sha: null,
    measuredAtUtc: new Date().toISOString(),
    user: 'real-user-A',
    sections: {},
  };
  try {
    report.sha = require('child_process').execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch { /* sin git */ }

  let mongoose = null;
  const needsMongo = args.sectionList.includes('inventory') || args.sectionList.includes('explain');
  if (needsMongo && args.mongoUrl) {
    mongoose = require('mongoose');
  }

  // Selección interna (nunca persiste deckIds reales).
  let inventorySelected = [];

  if (args.sectionList.includes('inventory')) {
    if (!args.mongoUrl) {
      report.sections.inventory = {
        section: 'inventory',
        status: 'BLOCKED',
        reason: 'sin credenciales Mongo configuradas en el entorno',
      };
    } else {
      try {
        await mongoose.connect(args.mongoUrl, { dbName: DB_NAME, serverSelectionTimeoutMS: 3000 });
        const inventory = await runInventory({ userId, maxTimeMs });
        inventorySelected = inventory.selected;
        report.sections.inventory = { ...inventory.report, status: 'MEASURED' };
      } catch (err) {
        report.sections.inventory = {
          section: 'inventory',
          status: 'BLOCKED',
          reason: sanitizeError(err, { ids: [userId] }),
        };
      } finally {
        if (mongoose && mongoose.connection && mongoose.connection.readyState === 1) {
          await mongoose.disconnect().catch(() => {});
        }
      }
    }
  }

  if (args.sectionList.includes('api')) {
    if (!args.baseUrl) {
      report.sections.api = {
        section: 'api',
        status: 'BLOCKED',
        reason: 'sin BASE_URL configurada en el entorno',
      };
    } else {
      try {
        const api = await runApi({ baseUrl: args.baseUrl, userId, samples, maxTimeMs, inventorySelected });
        // La sección sólo es MEASURED cuando TODOS los casos esperados
        // (deck-list + C20/C100/C500-real) tienen muestras correctas; un
        // éxito parcial queda BLOCKED con partialResults: true.
        const statusInfo = classifyApiSectionStatus(api.cases);
        api.status = statusInfo.status;
        if (statusInfo.partialResults) api.partialResults = true;
        if (statusInfo.reason) api.reason = statusInfo.reason;
        report.sections.api = api;
      } catch (err) {
        report.sections.api = {
          section: 'api',
          status: 'BLOCKED',
          reason: sanitizeError(err, { baseUrl: args.baseUrl, ids: [userId] }),
        };
      }
    }
  }

  if (args.sectionList.includes('explain')) {
    if (!args.mongoUrl) {
      report.sections.explain = {
        section: 'explain',
        status: 'BLOCKED',
        reason: 'sin credenciales Mongo configuradas en el entorno',
      };
    } else {
      try {
        await mongoose.connect(args.mongoUrl, { dbName: DB_NAME, serverSelectionTimeoutMS: 3000 });
        const explain = await runExplain({ userId, maxTimeMs, selectedDecks: inventorySelected });
        const anyOk = Object.values(explain.queries || {}).some((q) => q && q.status === 'ok');
        explain.status = anyOk ? 'MEASURED' : 'BLOCKED';
        if (!anyOk) explain.reason = 'ninguna consulta explain pudo ejecutarse';
        report.sections.explain = explain;
      } catch (err) {
        report.sections.explain = {
          section: 'explain',
          status: 'BLOCKED',
          reason: sanitizeError(err, { ids: [userId] }),
        };
      } finally {
        if (mongoose && mongoose.connection && mongoose.connection.readyState === 1) {
          await mongoose.disconnect().catch(() => {});
        }
      }
    }
  }

  const anyExecuted = Object.values(report.sections).some(
    (s) => s && s.status === 'MEASURED'
  );

  const aliases = buildAliases(userId, inventorySelected);
  let safeJson;
  try {
    safeJson = serializeRawResults(report, aliases);
  } catch (err) {
    // Nunca se vuelca el JSON crudo: podría contener el contenido rechazado.
    const reason = String(err.message).replace(/data:[^\s"]+/g, '<data-url>').slice(0, 300);
    console.error(`Los resultados no pasan la serialización segura: ${reason}`);
    console.error('No se escribió ningún archivo y no se emite el reporte crudo.');
    process.exitCode = 1;
    safeJson = JSON.stringify({ status: 'FAIL', reason: 'serialización insegura' }, null, 2);
  }

  if (args.out && process.exitCode !== 1) {
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(args.out, safeJson + '\n', 'utf8');
    console.log(`Resultados seguros escritos en ${args.out}`);
  }

  console.log(safeJson);

  if (!anyExecuted) {
    console.error('Todas las secciones solicitadas quedaron BLOCKED por configuración ausente.');
    process.exit(3);
  }
  if (process.exitCode === undefined) process.exitCode = 0;
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`Fallo inesperado: ${sanitizeError(err)}`);
    process.exit(1);
  });
}

module.exports = { main, validateArgs };
