// Harness no productivo de la Fase 1B (image-delivery) — CORRECCIÓN 1.
// Compara, con los mismos perfiles sintéticos de la Fase 1A, contratos de
// respuestas de tarjetas y de listas de mazos:
//
// Respuestas de tarjetas:
//   current      — contrato actual: bgImage expandido por tarjeta (Fase 1A)
//   normalized   — diccionario de fondos únicos + bgImageIndex por tarjeta (Alternativa A)
//   referenced   — tarjetas con referencia de asset y sin bytes de imagen en JSON (Alternativa C)
//   hybrid       — diccionario de miniaturas (una por fondo único) + referencias full externas (Alternativa D)
//
// Listas de mazos:
//   current              — portada completa + cardBackgrounds completos (serializador actual)
//   without_backgrounds  — conserva coverImage, elimina sólo cardBackgrounds (Corte 1)
//   metadata_only        — elimina portada y fondos (control, NO es el contrato propuesto)
//   thumbnail_summary    — conserva una miniatura de portada, sin fondos (posible Corte 2)
//   migration_dual       — datos heredados + referencias/ids (convivencia de migración)
//
// Invariantes estructurales con salida no cero ante cualquier fallo.
// No accede a red, base de datos ni datos de usuario. Genera bytes deterministas
// en memoria; los archivos de salida sólo contienen tamaños y tiempos.
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { performance } from 'node:perf_hooks';
import { gzipSync, createGzip } from 'node:zlib';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const { BSON, ObjectId } = require('../../../../backend/node_modules/bson');

const COMMIT = process.env.PERF_COMMIT || 'UNKNOWN';
const OUTPUT = process.argv[2] || '/tmp/image-delivery-results.json';
const UTF8 = (value) => Buffer.byteLength(value, 'utf8');
const REPETITIONS = 5;

// Mismos perfiles que la Fase 1A (base64-payload-results.md) más un perfil
// thumb ESTIMADO por escalado de píxeles del perfil small medido (320×180,
// 32 KiB binario): 256×144 ⇒ 32 KiB × (256×144)/(320×180).
const profiles = {
  small: { width: 320, height: 180, binaryBytes: 32 * 1024, mime: 'image/jpeg' },
  medium: { width: 1280, height: 720, binaryBytes: 256 * 1024, mime: 'image/jpeg' },
  large: { width: 2400, height: 1600, binaryBytes: 700 * 1024, mime: 'image/jpeg' },
  content: { width: 600, height: 338, binaryBytes: 128 * 1024, mime: 'image/jpeg' },
  thumb: { width: 256, height: 144, binaryBytes: Math.round(32 * 1024 * ((256 * 144) / (320 * 180))), mime: 'image/jpeg' },
};

function seededBytes(length, seed) {
  const output = Buffer.allocUnsafe(length);
  let state = (seed >>> 0) || 0x6d2b79f5;
  for (let i = 0; i < length; i += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    output[i] = state & 0xff;
  }
  return output;
}

function dataUrl(profileName, seed = 1) {
  const profile = profiles[profileName];
  return `data:${profile.mime};base64,${seededBytes(profile.binaryBytes, seed).toString('base64')}`;
}

function estimatedBinaryBytes(dataUrlValue) {
  const commaIndex = dataUrlValue.indexOf(',');
  if (commaIndex === -1) return 0;
  const payload = dataUrlValue.slice(commaIndex + 1);
  return Math.max(0, Math.floor((payload.length * 3) / 4) - (payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0));
}

function percentileSummary(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return {
    values,
    median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
    min: sorted[0],
    max: sorted.at(-1),
  };
}

async function streamGzip(chunks) {
  const gzip = createGzip({ level: 6 });
  let bytes = 0;
  gzip.on('data', (chunk) => { bytes += chunk.length; });
  const done = once(gzip, 'end');
  for await (const chunk of chunks) {
    if (!gzip.write(chunk)) await once(gzip, 'drain');
  }
  gzip.end();
  await done;
  return bytes;
}

function timeJsonOperation(value, operation) {
  const values = [];
  let serialized = typeof value === 'string' ? value : JSON.stringify(value);
  for (let warm = 0; warm < 2; warm += 1) {
    if (operation === 'stringify') JSON.stringify(value);
    else JSON.parse(serialized);
  }
  for (let i = 0; i < REPETITIONS; i += 1) {
    const started = performance.now();
    if (operation === 'stringify') serialized = JSON.stringify(value);
    else JSON.parse(serialized);
    values.push(performance.now() - started);
  }
  return percentileSummary(values);
}

// Contabiliza las imágenes que REALMENTE forman parte del JSON modelado.
// Cada entrada debe ser una cadena Data URL completa; no se aceptan
// concatenaciones artificiales (p. ej. array.join(',')), que ocultarían el
// tamaño real de cada imagen y romperían la deduplicación.
function imageStats(images) {
  const unique = new Set();
  let total = 0;
  let uniqueBytes = 0;
  for (const image of images) {
    if (!image) continue;
    const bytes = UTF8(image);
    total += bytes;
    if (!unique.has(image)) {
      unique.add(image);
      uniqueBytes += bytes;
    }
  }
  return {
    imageUtf8Bytes: total,
    uniqueImageUtf8Bytes: uniqueBytes,
    repeatedImageUtf8Bytes: Math.max(0, total - uniqueBytes),
    uniqueImageCount: unique.size,
  };
}

function baseCard(index, extra = {}) {
  return {
    id: `card-${String(index).padStart(4, '0')}`,
    userId: '000000000000000000000001',
    deckId: '000000000000000000000002',
    question: `Pregunta sintética ${index}`,
    answer: `Respuesta sintética ${index}`,
    easeFactor: 2.5,
    bgImageIndex: -1,
    textAlign: 'center',
    fontSize: 'text-base',
    contentImage: '',
    imageSide: '',
    difficulty: 0.3,
    totalReviews: 0,
    consecutiveErrors: 0,
    lastReviewedAt: null,
    createdAt: '2026-08-12T00:00:00.000Z',
    ...extra,
  };
}

function sharedSetFor(scenario) {
  if (scenario === 'shared_small') return { bg: dataUrl('small', 100), content: '' };
  if (scenario === 'shared_medium') return { bg: dataUrl('medium', 101), content: '' };
  if (scenario === 'shared_large') return { bg: dataUrl('large', 102), content: '' };
  return { bg: '', content: '' };
}

// Fuente única de verdad de imágenes por tarjeta: devuelve { bgImage, contentImage }.
function cardImagesFor(scenario, index) {
  if (scenario === 'shared_small' || scenario === 'shared_medium' || scenario === 'shared_large') {
    return { bgImage: sharedSetFor(scenario).bg, contentImage: '' };
  }
  if (scenario === 'distinct_backgrounds') return { bgImage: dataUrl('medium', 1000 + index), contentImage: '' };
  if (scenario === 'content_10pct') {
    return index % 10 === 0 ? { bgImage: '', contentImage: dataUrl('content', 2000 + index) } : { bgImage: '', contentImage: '' };
  }
  if (scenario === 'content_all') return { bgImage: '', contentImage: dataUrl('content', 3000 + index) };
  return { bgImage: '', contentImage: '' };
}

// Número de imágenes únicas esperadas por escenario (para invariantes).
function expectedImageCounts(scenario, count) {
  if (scenario.startsWith('shared_')) return { backgrounds: 1, content: 0 };
  if (scenario === 'distinct_backgrounds') return { backgrounds: count, content: 0 };
  if (scenario === 'content_10pct') return { backgrounds: 0, content: Math.ceil(count / 10) };
  if (scenario === 'content_all') return { backgrounds: 0, content: count };
  return { backgrounds: 0, content: 0 };
}

// ---------------------------------------------------------------------------
// Contrato actual: Flashcard.serialize(backgrounds) expande bgImage por tarjeta
// ---------------------------------------------------------------------------
function buildCurrentCards(count, scenario) {
  return Array.from({ length: count }, (_, index) => {
    const images = cardImagesFor(scenario, index);
    const indexOf = images.bgImage ? 0 : -1;
    return baseCard(index, {
      bgImageIndex: indexOf,
      bgImage: images.bgImage,
      contentImage: images.contentImage,
      imageSide: images.contentImage ? (index % 2 ? 'question' : 'answer') : '',
    });
  });
}

// ---------------------------------------------------------------------------
// Alternativa A (normalizada): diccionario de TODOS los fondos únicos + índice.
// Recorre cada tarjeta, registra cada fondo único exactamente una vez y asigna
// el índice correspondiente; -1 si la tarjeta no tiene fondo.
// ---------------------------------------------------------------------------
function buildNormalizedCards(count, scenario) {
  const backgrounds = [];
  const indexByUrl = new Map();
  const cards = Array.from({ length: count }, (_, index) => {
    const images = cardImagesFor(scenario, index);
    let bgImageIndex = -1;
    if (images.bgImage) {
      if (!indexByUrl.has(images.bgImage)) {
        indexByUrl.set(images.bgImage, backgrounds.length);
        backgrounds.push(images.bgImage);
      }
      bgImageIndex = indexByUrl.get(images.bgImage);
    }
    return baseCard(index, {
      bgImageIndex,
      contentImage: images.contentImage,
      imageSide: images.contentImage ? (index % 2 ? 'question' : 'answer') : '',
    });
  });
  return { backgrounds, cards };
}

// ---------------------------------------------------------------------------
// Alternativa C (referenciada): la tarjeta sólo referencia assets; el JSON no
// incluye bytes de imagen. Los bytes externos se reportan aparte (ESTIMATED).
// ---------------------------------------------------------------------------
function buildReferencedCards(count, scenario) {
  const uniqueBackgrounds = new Map();
  let next = 0;
  const assetIdFor = (seed) => {
    if (!uniqueBackgrounds.has(seed)) uniqueBackgrounds.set(seed, next++);
    return `bg-${String(uniqueBackgrounds.get(seed)).padStart(4, '0')}`;
  };
  let contentCount = 0;
  const cards = Array.from({ length: count }, (_, index) => {
    const images = cardImagesFor(scenario, index);
    if (images.contentImage) contentCount += 1;
    return baseCard(index, {
      bgImageIndex: images.bgImage ? 0 : -1,
      bgImageUrl: images.bgImage ? `/api/assets/deck-0002/${assetIdFor(images.bgImage)}` : '',
      contentImageUrl: images.contentImage ? `/api/assets/deck-0002/content-${String(index).padStart(4, '0')}` : '',
      contentImage: '',
      imageSide: images.contentImage ? (index % 2 ? 'question' : 'answer') : '',
    });
  });
  return {
    cards,
    uniqueBackgroundCount: uniqueBackgrounds.size,
    uniqueContentCount: contentCount,
    uniqueAssetCount: uniqueBackgrounds.size + contentCount,
  };
}

// ---------------------------------------------------------------------------
// Alternativa D (híbrida): una entrada de miniatura por fondo ÚNICO (ids
// únicos) + referencias full externas. Las miniaturas viven en el JSON; la
// resolución completa y el contenido se obtienen con requests separados.
// ---------------------------------------------------------------------------
function buildHybridCards(count, scenario) {
  const backgrounds = [];
  const indexByUrl = new Map();
  let contentCount = 0;
  const cards = Array.from({ length: count }, (_, index) => {
    const images = cardImagesFor(scenario, index);
    if (images.contentImage) contentCount += 1;
    let bgImageIndex = -1;
    let bgImageThumbUrl = '';
    let bgImageFullUrl = '';
    if (images.bgImage) {
      if (!indexByUrl.has(images.bgImage)) {
        indexByUrl.set(images.bgImage, backgrounds.length);
        backgrounds.push({
          id: `bg-${String(backgrounds.length).padStart(4, '0')}`,
          thumb: dataUrl('thumb', 90000 + backgrounds.length),
        });
      }
      bgImageIndex = indexByUrl.get(images.bgImage);
      bgImageThumbUrl = `assets/${backgrounds[bgImageIndex].id}/thumb`;
      bgImageFullUrl = `assets/${backgrounds[bgImageIndex].id}/full`;
    }
    return baseCard(index, {
      bgImageIndex,
      bgImageThumbUrl,
      bgImageFullUrl,
      contentImageThumbUrl: images.contentImage ? `assets/content-${String(index).padStart(4, '0')}/thumb` : '',
      contentImage: '',
      imageSide: images.contentImage ? (index % 2 ? 'question' : 'answer') : '',
    });
  });
  return {
    backgrounds,
    cards,
    thumbnailCount: backgrounds.length,
    uniqueBackgroundCount: backgrounds.length,
    uniqueContentCount: contentCount,
  };
}

// ---------------------------------------------------------------------------
// Medición de JSON por streaming: evita materializar strings > 512 MiB (límite
// de V8) en los contratos expandidos de 1000 tarjetas, igual que la Fase 1A.
// ---------------------------------------------------------------------------
async function measureJsonStreaming(generator) {
  let jsonUtf8Bytes = 0;
  async function* chunks() {
    for await (const chunk of generator()) {
      jsonUtf8Bytes += UTF8(chunk);
      yield chunk;
    }
  }
  const gzipStarted = performance.now();
  const gzipBytes = await streamGzip(chunks());
  const streamModelDurationMs = performance.now() - gzipStarted;
  return { jsonUtf8Bytes, gzipBytes, streamModelDurationMs };
}

const STRINGIFY_SAFE_THRESHOLD = 400 * 1024 * 1024;

function timedJson(value, kind) {
  const serialized = JSON.stringify(value);
  const size = UTF8(serialized);
  if (size > STRINGIFY_SAFE_THRESHOLD) {
    return {
      run: false,
      reason: `NOT RUN — payload > ${STRINGIFY_SAFE_THRESHOLD / 1024 / 1024} MiB, superaría el límite de string de V8`,
      values: [],
    };
  }
  return { run: true, ...timeJsonOperation(kind === 'parse' ? serialized : value, kind) };
}

// ---------------------------------------------------------------------------
// Medición de un contrato de tarjetas.
// jsonImages: Data URLs que realmente forman parte del JSON modelado.
// externalAssets: { bytes, requests, counts } de recursos fuera del JSON.
// ---------------------------------------------------------------------------
async function measureContract(label, chunkGeneratorFn, jsonImages, externalAssets, endpoint, evidence, extra = {}, timingPayload = null) {
  const { jsonUtf8Bytes, gzipBytes, streamModelDurationMs } = await measureJsonStreaming(chunkGeneratorFn);
  const stringify = timingPayload ? timedJson(timingPayload, 'stringify') : { run: false };
  const parse = timingPayload ? timedJson(timingPayload, 'parse') : { run: false };
  const stats = imageStats(jsonImages);
  const externals = externalAssets || { bytes: 0, requests: 0 };
  return {
    contract: label,
    endpoint,
    evidence,
    status: 'PASS',
    jsonUtf8Bytes,
    gzipBytes,
    gzipRatio: gzipBytes / jsonUtf8Bytes,
    attemptedLocalStorageUtf8Bytes: jsonUtf8Bytes,
    attemptedLocalStorageCharacters: jsonUtf8Bytes,
    stringifyMs: stringify.run
      ? { values: stringify.values, median: stringify.median, min: stringify.min, max: stringify.max }
      : null,
    parseMs: parse.run
      ? { values: parse.values, median: parse.median, min: parse.min, max: parse.max }
      : null,
    stringifyEvidence: stringify.run ? 'MEASURED' : 'NOT RUN',
    parseEvidence: parse.run ? 'MEASURED' : 'NOT RUN',
    streamModelDurationMs,
    imageUtf8Bytes: stats.imageUtf8Bytes,
    uniqueImageUtf8Bytes: stats.uniqueImageUtf8Bytes,
    repeatedImageUtf8Bytes: stats.repeatedImageUtf8Bytes,
    uniqueImageCount: stats.uniqueImageCount,
    duplicatePercentOfJson: jsonUtf8Bytes ? (stats.repeatedImageUtf8Bytes / jsonUtf8Bytes) * 100 : 0,
    externalAssetBytes: externals.bytes,
    externalAssetRequests: externals.requests,
    externalAssetEvidence: externals.evidence || 'ESTIMATED',
    externalBytesNotInJson: true,
    ...extra,
  };
}

function arrayGenerator(array) {
  return async function* generator() {
    const open = '[';
    yield open;
    for (let index = 0; index < array.length; index += 1) {
      const json = JSON.stringify(array[index]);
      yield index ? `,${json}` : json;
    }
    yield ']';
  };
}

// Serializa el shape { backgrounds, cards } por partes (el diccionario puede
// superar 300 MiB con fondos distintos a 1000 tarjetas).
function dictGenerator({ backgrounds, cards: cardArray }) {
  return async function* generator() {
    yield '{"backgrounds":[';
    for (let i = 0; i < backgrounds.length; i += 1) {
      const json = JSON.stringify(backgrounds[i]);
      yield i ? `,${json}` : json;
    }
    yield '],"cards":[';
    for (let i = 0; i < cardArray.length; i += 1) {
      const json = JSON.stringify(cardArray[i]);
      yield i ? `,${json}` : json;
    }
    yield ']}';
  };
}

async function runCardScenario(count, scenario) {
  const expected = expectedImageCounts(scenario, count);
  const current = buildCurrentCards(count, scenario);
  const normalized = buildNormalizedCards(count, scenario);
  const referenced = buildReferencedCards(count, scenario);
  const hybrid = buildHybridCards(count, scenario);

  const allImages = Array.from({ length: count }, (_, i) => [cardImagesFor(scenario, i).bgImage, cardImagesFor(scenario, i).contentImage]).flat();
  const contentImagesInCards = current.filter((c) => c.contentImage).map((c) => c.contentImage);

  // Assets externos por contrato (NO están en el JSON; ESTIMATED).
  const backgroundBinaryBytes = (urls) => urls.reduce((sum, url) => sum + estimatedBinaryBytes(url), 0);
  const contentBinaryBytes = (urls) => urls.reduce((sum, url) => sum + estimatedBinaryBytes(url), 0);

  const rows = [
    await measureContract(
      'current',
      arrayGenerator(current),
      allImages,
      null,
      'GET /api/flashcards/deck/:deckId',
      'MODELED',
      { cardCount: count, imageScenario: scenario, logicalBackgroundCopies: current.filter((c) => c.bgImage).length }
    ),
    await measureContract(
      'normalized',
      dictGenerator(normalized),
      [...normalized.backgrounds, ...contentImagesInCards],
      null,
      'GET /api/flashcards/deck/:deckId (diccionario + índice)',
      'MODELED',
      {
        cardCount: count,
        imageScenario: scenario,
        logicalBackgroundCopies: normalized.backgrounds.length,
        dictionaryCount: normalized.backgrounds.length,
        uniqueBackgroundCount: normalized.backgrounds.length,
        uniqueContentCount: contentImagesInCards.length,
        requestsColdAssets: 0,
      },
      normalized
    ),
    await measureContract(
      'referenced',
      arrayGenerator(referenced.cards),
      [],
      {
        bytes: backgroundBinaryBytes([...new Set(current.filter((c) => c.bgImage).map((c) => c.bgImage))])
          + contentBinaryBytes([...new Set(contentImagesInCards)]),
        requests: referenced.uniqueAssetCount,
        evidence: 'ESTIMATED',
      },
      'GET /api/flashcards/deck/:deckId (referencias de asset)',
      'MODELED',
      {
        cardCount: count,
        imageScenario: scenario,
        uniqueBackgroundCount: referenced.uniqueBackgroundCount,
        uniqueContentCount: referenced.uniqueContentCount,
        uniqueAssetCount: referenced.uniqueAssetCount,
        requestsColdAssets: referenced.uniqueAssetCount,
      },
      referenced.cards
    ),
    await measureContract(
      'hybrid',
      dictGenerator(hybrid),
      hybrid.backgrounds.map((b) => b.thumb),
      {
        bytes: backgroundBinaryBytes([...new Set(current.filter((c) => c.bgImage).map((c) => c.bgImage))])
          + contentBinaryBytes([...new Set(contentImagesInCards)]),
        requests: hybrid.uniqueBackgroundCount + hybrid.uniqueContentCount,
        evidence: 'ESTIMATED',
      },
      'GET /api/flashcards/deck/:deckId (miniaturas inline + referencias full)',
      'MODELED',
      {
        cardCount: count,
        imageScenario: scenario,
        thumbnailCount: hybrid.thumbnailCount,
        uniqueBackgroundCount: hybrid.uniqueBackgroundCount,
        uniqueContentCount: hybrid.uniqueContentCount,
        requestsColdAssets: hybrid.uniqueBackgroundCount + hybrid.uniqueContentCount,
      },
      hybrid
    ),
  ];

  return {
    rows: rows.map((row) => ({
      scenarioId: `cards-${count}-${scenario}-${row.contract}`,
      ...row,
      limitation: 'Contrato JSON reproducido en Node (MODELED); gzip y tiempos Node/V8 (MEASURED sobre el modelo); el perfil de miniatura y los bytes externos son ESTIMATED; los bytes externos no forman parte del JSON; no incluye HTTP, MongoDB, parseo del navegador ni memoria raster.',
    })),
    expected,
  };
}

function baseDeck(index, extra = {}) {
  return {
    id: `deck-${String(index).padStart(4, '0')}`,
    userId: '000000000000000000000001',
    title: `Mazo sintético ${index}`,
    coverColor: '#4f46e5',
    coverImage: '',
    cardCount: 100,
    cardBackgrounds: [],
    isStarred: false,
    isDefault: false,
    isPublicReadOnly: false,
    materiaId: null,
    parcialNumber: null,
    temaId: null,
    subtemaId: null,
    analytics: {
      masteryPercentage: 0,
      avgResponseTime: 0,
      totalReviewsCount: 0,
      velocityIndex: 0,
      lastCalculatedAt: '2026-08-12T00:00:00.000Z',
    },
    createdAt: '2026-08-12T00:00:00.000Z',
    ...extra,
  };
}

function deckImagesFor(scenario, index) {
  const coverImage = scenario === 'covers' || scenario === 'cover_and_backgrounds'
    ? dataUrl('small', 10000 + index)
    : '';
  const cardBackgrounds = scenario === 'backgrounds' || scenario === 'cover_and_backgrounds'
    ? [0, 1, 2].map((offset) => dataUrl('small', 20000 + index * 3 + offset))
    : [];
  const coverImageThumb = scenario === 'covers' || scenario === 'cover_and_backgrounds'
    ? dataUrl('thumb', 30000 + index)
    : '';
  return { coverImage, cardBackgrounds, coverImageThumb };
}

// Variantes de lista de mazos con nombres inequívocos.
function buildDeckListVariants(count, scenario) {
  const current = Array.from({ length: count }, (_, index) => {
    const images = deckImagesFor(scenario, index);
    return baseDeck(index, { coverImage: images.coverImage, cardBackgrounds: images.cardBackgrounds });
  });
  const withoutBackgrounds = current.map((deck) => {
    const { cardBackgrounds, ...rest } = deck;
    return rest;
  });
  const metadataOnly = current.map((deck) => {
    const { coverImage, cardBackgrounds, ...rest } = deck;
    return rest;
  });
  const thumbnailSummary = current.map((deck, index) => ({
    ...metadataOnly[index],
    coverImageThumb: deckImagesFor(scenario, index).coverImageThumb,
  }));
  const migrationDual = current.map((deck, index) => ({
    ...deck,
    cardBackgroundAssetIds: deck.cardBackgrounds.map((_, bgIndex) => `bg-${String(index).padStart(4, '0')}-${bgIndex}`),
  }));
  return { current, without_backgrounds: withoutBackgrounds, metadata_only: metadataOnly, thumbnail_summary: thumbnailSummary, migration_dual: migrationDual };
}

function deckVariantImages(label, decks) {
  if (label === 'without_backgrounds') return decks.map((deck) => deck.coverImage);
  if (label === 'metadata_only') return [];
  if (label === 'thumbnail_summary') return decks.map((deck) => deck.coverImageThumb);
  return decks.flatMap((deck) => [deck.coverImage, ...(deck.cardBackgrounds || [])]);
}

async function runDeckScenario(count, scenario) {
  const variants = buildDeckListVariants(count, scenario);

  const measure = async (label, decks, endpoint, evidence, extra = {}) => {
    const images = deckVariantImages(label, decks);
    async function* generator() {
      const open = '[';
      yield open;
      for (let index = 0; index < decks.length; index += 1) {
        const json = JSON.stringify(decks[index]);
        yield index ? `,${json}` : json;
      }
      yield ']';
    }
    const { jsonUtf8Bytes, gzipBytes } = await measureJsonStreaming(generator);
    const stringify = timedJson(decks, 'stringify');
    const parse = timedJson(decks, 'parse');
    const stats = imageStats(images);
    return {
      scenarioId: `decks-${count}-${scenario}-${label}`,
      contract: label,
      endpoint,
      evidence,
      status: 'PASS',
      deckCount: count,
      imageScenario: scenario,
      jsonUtf8Bytes,
      jsonCharacters: jsonUtf8Bytes,
      gzipBytes,
      attemptedLocalStorageUtf8Bytes: jsonUtf8Bytes,
      attemptedLocalStorageCharacters: jsonUtf8Bytes,
      stringifyMs: stringify.run ? { ...stringify } : null,
      parseMs: parse.run ? { ...parse } : null,
      stringifyEvidence: stringify.run ? 'MEASURED' : 'NOT RUN',
      parseEvidence: parse.run ? 'MEASURED' : 'NOT RUN',
      imageUtf8Bytes: stats.imageUtf8Bytes,
      uniqueImageUtf8Bytes: stats.uniqueImageUtf8Bytes,
      repeatedImageUtf8Bytes: stats.repeatedImageUtf8Bytes,
      uniqueImageCount: stats.uniqueImageCount,
      duplicatePercentOfJson: jsonUtf8Bytes ? (stats.repeatedImageUtf8Bytes / jsonUtf8Bytes) * 100 : 0,
      ...extra,
      limitation: 'JSON reproducido en Node (MODELED); gzip y tiempos Node/V8 (MEASURED sobre el modelo); el perfil de miniatura es ESTIMATED; sin HTTP, MongoDB, parseo del navegador ni memoria raster.',
    };
  };

  const rows = [
    await measure('current', variants.current, 'GET /api/decks/:userId', 'MODELED', { legacyContract: true }),
    await measure('without_backgrounds', variants.without_backgrounds, 'GET /api/decks/:userId (Corte 1: sin cardBackgrounds, portada completa)', 'MODELED', { corte1: true, keepsCoverImage: true }),
    await measure('metadata_only', variants.metadata_only, 'GET /api/decks/:userId (control: sin portada ni fondos)', 'MODELED', { controlOnly: true }),
    await measure('thumbnail_summary', variants.thumbnail_summary, 'GET /api/decks/:userId (Corte 2: portada en miniatura, sin fondos)', 'MODELED', { corte2: true, thumbnailOnly: true }),
    await measure('migration_dual', variants.migration_dual, 'GET /api/decks/:userId (migración dual: heredado + ids)', 'MODELED', { dualMigration: true, legacyContract: true }),
  ];

  return rows;
}

function measureBsonAssets() {
  const deckId = new ObjectId('000000000000000000000002');
  const userId = new ObjectId('000000000000000000000001');
  const cases = [];
  for (const profileName of ['small', 'medium', 'large']) {
    const legacy = {
      _id: deckId,
      userId,
      title: 'Deck BSON heredado',
      coverImage: dataUrl(profileName, 40000),
      cardBackgrounds: [dataUrl(profileName, 40001), dataUrl(profileName, 40002), dataUrl(profileName, 40003)],
      createdAt: new Date('2026-08-12T00:00:00.000Z'),
      updatedAt: new Date('2026-08-12T00:00:00.000Z'),
    };
    const assetRefs = {
      _id: deckId,
      userId,
      title: 'Deck BSON con referencias',
      coverImageAssetId: 'asset-cover-0001',
      cardBackgroundAssetIds: ['asset-bg-0001', 'asset-bg-0002', 'asset-bg-0003'],
      coverImage: '',
      cardBackgrounds: [],
      createdAt: new Date('2026-08-12T00:00:00.000Z'),
      updatedAt: new Date('2026-08-12T00:00:00.000Z'),
    };
    cases.push({
      scenarioId: `bson-deck-legacy-vs-assets-${profileName}`,
      evidence: 'MEASURED',
      status: 'PASS',
      profile: profileName,
      legacyBsonBytes: BSON.calculateObjectSize(legacy),
      assetRefBsonBytes: BSON.calculateObjectSize(assetRefs),
      ratioAssetToLegacy: BSON.calculateObjectSize(assetRefs) / BSON.calculateObjectSize(legacy),
      limitation: 'BSON sintético medido con la dependencia bson instalada; los ids de asset son de longitud fija sintética; no es un documento real ni incluye overhead de WiredTiger.',
    });
  }
  return cases;
}

// ---------------------------------------------------------------------------
// INVARIANTES: cualquier fallo imprime el detalle y termina con código != 0.
// ---------------------------------------------------------------------------
function verifyInvariants({ cardRows, deckRows, cardScenarios, cardCounts, deckScenarios, deckCounts }) {
  const failures = [];
  const passed = [];
  const check = (cond, message) => {
    if (cond) passed.push(`PASS: ${message}`);
    else failures.push(`FAIL: ${message}`);
  };

  const allRows = [...cardRows, ...deckRows];

  // 1. IDs de escenario únicos.
  const ids = new Set();
  for (const row of allRows) {
    check(!ids.has(row.scenarioId), `IDs de escenario duplicados: ${row.scenarioId}`);
    ids.add(row.scenarioId);
  }

  // 2. Conteos de filas esperados (7 escenarios × 4 tamaños × 4 contratos de
  // tarjetas; 4 escenarios × 3 tamaños × 5 contratos de listas).
  const expectedCardRows = cardScenarios.length * cardCounts.length * 4;
  const expectedDeckRows = deckScenarios.length * deckCounts.length * 5;
  check(cardRows.length === expectedCardRows,
    `Conteo de filas de tarjetas: esperadas ${expectedCardRows}, obtenidas ${cardRows.length}`);
  check(deckRows.length === expectedDeckRows,
    `Conteo de filas de mazos: esperadas ${expectedDeckRows}, obtenidas ${deckRows.length}`);

  // 3. Sin NaN, Infinity ni negativos en valores numéricos.
  for (const row of allRows) {
    for (const [key, value] of Object.entries(row)) {
      if (typeof value !== 'number') continue;
      check(Number.isFinite(value), `Número no finito en ${row.scenarioId}.${key} (${value})`);
      check(value >= 0, `Número negativo en ${row.scenarioId}.${key} (${value})`);
    }
  }

  // 4. Invariantes estructurales por escenario/contrato de tarjetas.
  for (const count of cardCounts) {
    for (const scenario of cardScenarios) {
      const expected = expectedImageCounts(scenario, count);
      const scenarioRows = cardRows.filter((r) => r.imageScenario === scenario && r.cardCount === count);
      for (const row of scenarioRows) {
        const tag = row.scenarioId;
        if (row.contract === 'normalized') {
          check(row.dictionaryCount === expected.backgrounds,
            `${tag}: dictionaryCount esperado ${expected.backgrounds}, obtenido ${row.dictionaryCount}`);
          check(row.uniqueContentCount === expected.content,
            `${tag}: fondos de contenido únicos esperados ${expected.content}, obtenidos ${row.uniqueContentCount}`);
          check(row.uniqueImageCount === expected.backgrounds + expected.content,
            `${tag}: uniqueImageCount esperado ${expected.backgrounds + expected.content}, obtenido ${row.uniqueImageCount}`);
          if (expected.backgrounds + expected.content > 0) {
            check(row.imageUtf8Bytes > 0, `${tag}: JSON incluye Data URL pero imageUtf8Bytes es 0`);
          } else {
            check(row.imageUtf8Bytes === 0, `${tag}: sin imágenes pero imageUtf8Bytes > 0`);
          }
          check(row.requestsColdAssets === 0, `${tag}: normalized no debería tener requests externos`);
        }
        if (row.contract === 'hybrid') {
          check(row.thumbnailCount === expected.backgrounds,
            `${tag}: thumbnailCount esperado ${expected.backgrounds}, obtenido ${row.thumbnailCount}`);
          check(row.uniqueBackgroundCount === expected.backgrounds,
            `${tag}: fondos únicos esperados ${expected.backgrounds}, obtenidos ${row.uniqueBackgroundCount}`);
          check(row.requestsColdAssets === expected.backgrounds + expected.content,
            `${tag}: requests fríos esperados ${expected.backgrounds + expected.content}, obtenidos ${row.requestsColdAssets}`);
          if (expected.backgrounds > 0) {
            check(row.uniqueImageCount === expected.backgrounds, `${tag}: miniaturas en JSON deben ser una por fondo único`);
            check(row.imageUtf8Bytes > 0, `${tag}: hay miniaturas en JSON pero imageUtf8Bytes es 0`);
          } else {
            check(row.thumbnailCount === 0 && row.uniqueImageCount === 0, `${tag}: sin fondos, sin miniaturas`);
          }
        }
        if (row.contract === 'referenced') {
          check(row.uniqueAssetCount === expected.backgrounds + expected.content,
            `${tag}: uniqueAssetCount esperado ${expected.backgrounds + expected.content}, obtenido ${row.uniqueAssetCount}`);
          check(row.requestsColdAssets === row.uniqueAssetCount,
            `${tag}: requests fríos deben coincidir con assets únicos`);
          check(row.imageUtf8Bytes === 0, `${tag}: referenced no incluye bytes de imagen en JSON`);
          check(row.externalAssetBytes > 0 === (expected.backgrounds + expected.content > 0),
            `${tag}: bytes externos deben existir sólo si hay imágenes`);
        }
        if (row.contract === 'current') {
          const totalUnique = expected.backgrounds + expected.content;
          check(row.uniqueImageCount === totalUnique,
            `${tag}: uniqueImageCount esperado ${totalUnique}, obtenido ${row.uniqueImageCount}`);
          if (totalUnique > 0) check(row.imageUtf8Bytes > 0, `${tag}: JSON incluye Data URL pero imageUtf8Bytes es 0`);
          if (scenario.startsWith('shared_') && count > 1) {
            check(row.repeatedImageUtf8Bytes > 0, `${tag}: fondo compartido debe repetirse en current`);
          }
        }
      }
    }
  }

  // 5. Índices válidos en los constructores (fuera de rango o -1 con fondo).
  for (const count of cardCounts) {
    for (const scenario of cardScenarios) {
      const normalized = buildNormalizedCards(count, scenario);
      const hybrid = buildHybridCards(count, scenario);
      const tag = `cards-${count}-${scenario}`;
      for (const card of normalized.cards) {
        check(card.bgImageIndex >= -1 && card.bgImageIndex < normalized.backgrounds.length,
          `${tag} normalized: bgImageIndex ${card.bgImageIndex} fuera de rango (diccionario ${normalized.backgrounds.length})`);
        const hasBg = Boolean(cardImagesFor(scenario, Number(card.id.split('-')[1])).bgImage);
        check(!hasBg || card.bgImageIndex >= 0,
          `${tag} normalized: tarjeta con fondo esperado pero índice -1 (${card.id})`);
      }
      for (const card of hybrid.cards) {
        check(card.bgImageIndex >= -1 && card.bgImageIndex < hybrid.backgrounds.length,
          `${tag} hybrid: bgImageIndex ${card.bgImageIndex} fuera de rango (diccionario ${hybrid.backgrounds.length})`);
      }
      const hybridIds = hybrid.backgrounds.map((b) => b.id);
      check(new Set(hybridIds).size === hybridIds.length,
        `${tag} hybrid: IDs de fondos distintos repetidos`);
      if (scenario === 'distinct_backgrounds') {
        check(hybrid.backgrounds.length === count, `${tag} hybrid: debe haber una miniatura por fondo distinto`);
      }
      if (scenario.startsWith('shared_')) {
        check(normalized.backgrounds.length === 1, `${tag} normalized: fondo compartido debe ser 1 único`);
        check(hybrid.backgrounds.length === 1, `${tag} hybrid: fondo compartido debe ser 1 única miniatura`);
      }
      if (scenario === 'no_image') {
        check(normalized.backgrounds.length === 0, `${tag} normalized: sin imágenes, diccionario vacío`);
        check(hybrid.backgrounds.length === 0, `${tag} hybrid: sin imágenes, cero miniaturas`);
      }
    }
  }

  // 6. Invariantes de listas de mazos.
  for (const count of deckCounts) {
    for (const scenario of deckScenarios) {
      const variants = buildDeckListVariants(count, scenario);
      check(variants.current.every((d) => d.coverImage || d.cardBackgrounds.length > 0 || scenario === 'no_images'),
        `decks-${count}-${scenario}: current no debería quedar sin imágenes en escenarios con imágenes`);
      check(variants.without_backgrounds.every((d) => !('cardBackgrounds' in d)),
        `decks-${count}-${scenario}: without_backgrounds conserva cardBackgrounds`);
      check(variants.without_backgrounds.every((d, i) => d.coverImage === variants.current[i].coverImage),
        `decks-${count}-${scenario}: without_backgrounds debe conservar coverImage completa`);
      check(variants.metadata_only.every((d) => !('coverImage' in d) && !('cardBackgrounds' in d)),
        `decks-${count}-${scenario}: metadata_only conserva imágenes`);
      check(variants.migration_dual.every((d) => Array.isArray(d.cardBackgroundAssetIds) && d.cardBackgroundAssetIds.length === d.cardBackgrounds.length),
        `decks-${count}-${scenario}: migration_dual debe tener un id por fondo heredado`);
    }
  }

  return { passed, failures };
}

async function main() {
  const startedAt = new Date().toISOString();
  const cardScenarios = ['no_image', 'shared_small', 'shared_medium', 'shared_large', 'distinct_backgrounds', 'content_10pct', 'content_all'];
  const cardCounts = [20, 100, 500, 1000];
  const deckScenarios = ['no_images', 'covers', 'backgrounds', 'cover_and_backgrounds'];
  const deckCounts = [10, 100, 500];

  const cardRows = [];
  for (const count of cardCounts) {
    for (const scenario of cardScenarios) {
      const { rows } = await runCardScenario(count, scenario);
      cardRows.push(...rows);
    }
  }
  const deckRows = [];
  for (const count of deckCounts) {
    for (const scenario of deckScenarios) {
      deckRows.push(...(await runDeckScenario(count, scenario)));
    }
  }

  const bsonRows = measureBsonAssets();
  const invariants = verifyInvariants({ cardRows, deckRows, cardScenarios, cardCounts, deckScenarios, deckCounts });

  const output = {
    schemaVersion: '1.2.0',
    phase: '1B image-delivery (corrección 1)',
    commit: COMMIT,
    generatedAt: startedAt,
    evidenceClasses: ['MEASURED', 'STATICALLY CONFIRMED', 'MODELED', 'ESTIMATED', 'BLOCKED', 'PENDING — DEVICE REQUIRED'],
    cardContracts: ['current', 'normalized', 'referenced', 'hybrid'],
    deckListContracts: ['current', 'without_backgrounds', 'metadata_only', 'thumbnail_summary', 'migration_dual'],
    profiles,
    cardScenarios,
    cardCounts,
    deckScenarios,
    deckCounts,
    summary: {
      cardScenarioRows: cardRows.length,
      deckScenarioRows: deckRows.length,
      bsonRows: bsonRows.length,
      invariantsChecked: invariants.passed.length + invariants.failures.length,
      invariantsPassed: invariants.passed.length,
      invariantsFailed: invariants.failures.length,
    },
    thumbProfileEvidence: 'ESTIMATED: binaryBytes = 32 KiB × (256×144)/(320×180) escalado del perfil small medido en la Fase 1A.',
    results: {
      cardResponses: cardRows,
      deckLists: deckRows,
      bson: bsonRows,
    },
    invariants: {
      passed: invariants.passed,
      failures: invariants.failures,
    },
  };

  fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2));

  console.log(JSON.stringify({
    status: invariants.failures.length ? 'FAIL' : 'PASS',
    output: OUTPUT,
    cardRows: cardRows.length,
    deckRows: deckRows.length,
    bsonRows: bsonRows.length,
    invariantsChecked: invariants.passed.length + invariants.failures.length,
    invariantsFailed: invariants.failures.length,
    bytes: fs.statSync(OUTPUT).size,
  }, null, 2));

  if (invariants.failures.length > 0) {
    console.error(`\n=== INVARIANTES FALLIDAS (${invariants.failures.length}) ===`);
    for (const failure of invariants.failures) console.error(failure);
    process.exit(1);
  }

  console.log(`\n=== INVARIANTES APROBADAS (${invariants.passed.length}) ===`);
  for (const p of invariants.passed) console.log(p);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
