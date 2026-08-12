// Harness no productivo de la Fase 1B (image-delivery).
// Compara, con los mismos perfiles sintéticos de la Fase 1A, cuatro contratos:
//   current      — contrato actual: bgImage expandido por tarjeta; lista de mazos con coverImage+cardBackgrounds
//   normalized   — tarjetas con bgImageIndex + diccionario de fondos una sola vez (Alternativa A)
//   referenced   — tarjetas con referencia de asset y sin bytes de imagen en JSON (Alternativa C, URL proxy)
//   hybrid       — diccionario de miniaturas + referencia; resolución completa fuera del resumen (Alternativa D)
// Además modela el crecimiento de la lista de mazos durante una migración dual
// (campos heredados + nuevas referencias) y las escrituras en localStorage.
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
// Alternativa A (normalizada): tarjeta conserva bgImageIndex; fondo una sola vez
// ---------------------------------------------------------------------------
function buildNormalizedCards(count, scenario) {
  const { bg, content } = cardImagesFor(scenario, 0);
  const backgrounds = bg ? [bg] : [];
  const cards = Array.from({ length: count }, (_, index) => {
    const images = cardImagesFor(scenario, index);
    const indexOf = images.bgImage ? (images.bgImage === bg ? 0 : -1) : -1;
    return baseCard(index, {
      bgImageIndex: indexOf,
      contentImage: images.contentImage,
      imageSide: images.contentImage ? (index % 2 ? 'question' : 'answer') : '',
    });
  });
  return { backgrounds, cards };
}

// ---------------------------------------------------------------------------
// Alternativa C (referenciada): la tarjeta sólo referencia assets; sin bytes
// ---------------------------------------------------------------------------
function buildReferencedCards(count, scenario) {
  const unique = new Map();
  let next = 0;
  const assetIdFor = (seed) => {
    if (!unique.has(seed)) unique.set(seed, next++);
    return `bg-${String(unique.get(seed)).padStart(4, '0')}`;
  };
  const cards = Array.from({ length: count }, (_, index) => {
    const images = cardImagesFor(scenario, index);
    return baseCard(index, {
      bgImageIndex: images.bgImage ? 0 : -1,
      bgImageUrl: images.bgImage ? `/api/assets/deck-0002/${assetIdFor(images.bgImage)}` : '',
      contentImageUrl: images.contentImage ? `/api/assets/deck-0002/content-${index}` : '',
      contentImage: '',
      imageSide: images.contentImage ? (index % 2 ? 'question' : 'answer') : '',
    });
  });
  return { cards, uniqueAssetCount: unique.size + (scenario === 'content_all' ? count : scenario === 'content_10pct' ? Math.ceil(count / 10) : 0) };
}

// ---------------------------------------------------------------------------
// Alternativa D (híbrida): miniaturas en el diccionario; la tarjeta referencia
// el índice de miniatura y la resolución completa se sirve aparte (detail).
// ---------------------------------------------------------------------------
function buildHybridCards(count, scenario) {
  const { bg } = cardImagesFor(scenario, 0);
  const thumb = bg ? dataUrl('thumb', 900) : '';
  const backgrounds = thumb ? [{ id: 'bg-0000', thumb }] : [];
  const cards = Array.from({ length: count }, (_, index) => {
    const images = cardImagesFor(scenario, index);
    const indexOf = images.bgImage ? 0 : -1;
    return baseCard(index, {
      bgImageIndex: indexOf,
      bgImageThumbUrl: images.bgImage ? 'assets/bg-0000/thumb' : '',
      bgImageFullUrl: images.bgImage ? 'assets/bg-0000/full' : '',
      contentImageThumbUrl: images.contentImage ? `assets/content-${index}/thumb` : '',
      contentImage: '',
      imageSide: images.contentImage ? (index % 2 ? 'question' : 'answer') : '',
    });
  });
  return { backgrounds, cards };
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
// Serialización del JSON y medición de un contrato de tarjetas
// ---------------------------------------------------------------------------
async function measureContract(label, chunkGeneratorFn, images, endpoint, evidence, extra = {}, timingPayload = null) {
  const { jsonUtf8Bytes, gzipBytes, streamModelDurationMs } = await measureJsonStreaming(chunkGeneratorFn);
  const stringify = timingPayload ? timedJson(timingPayload, 'stringify') : { run: false };
  const parse = timingPayload ? timedJson(timingPayload, 'parse') : { run: false };
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
    ...statsFor(images),
    duplicatePercentOfJson: jsonUtf8Bytes ? (statsFor(images).repeatedImageUtf8Bytes / jsonUtf8Bytes) * 100 : 0,
    ...extra,
  };
}

function statsFor(images) {
  return imageStats(images);
}

async function runCardScenario(count, scenario) {
  const current = buildCurrentCards(count, scenario);
  const normalized = buildNormalizedCards(count, scenario);
  const referenced = buildReferencedCards(count, scenario);
  const hybrid = buildHybridCards(count, scenario);
  const imagesFor = cardImagesFor;
  const allImages = Array.from({ length: count }, (_, i) => [imagesFor(scenario, i).bgImage, imagesFor(scenario, i).contentImage]).flat();

  const arrayGenerator = (array) => async function* generator() {
    const open = '[';
    yield open;
    for (let index = 0; index < array.length; index += 1) {
      const json = JSON.stringify(array[index]);
      yield index ? `,${json}` : json;
    }
    yield ']';
  };

  const dictGenerator = ({ backgrounds, cards: cardArray }) => async function* generator() {
    const json = JSON.stringify({ backgrounds, cards: cardArray });
    yield json;
  };

  const uniqueContentImages = (scenario === 'content_all'
    ? Array.from({ length: count }, (_, i) => dataUrl('content', 3000 + i))
    : scenario === 'content_10pct'
      ? Array.from({ length: Math.ceil(count / 10) }, (_, i) => dataUrl('content', 2000 + i * 10))
      : []);

  const rows = [
    await measureContract(
      'current',
      arrayGenerator(current),
      allImages,
      'GET /api/flashcards/deck/:deckId',
      'MODELED',
      { cardCount: count, imageScenario: scenario, logicalBackgroundCopies: current.filter((c) => c.bgImage).length }
    ),
    await measureContract(
      'normalized',
      dictGenerator(normalized),
      [...normalized.backgrounds, ...uniqueContentImages],
      'GET /api/flashcards/deck/:deckId (diccionario + índice)',
      'MODELED',
      { cardCount: count, imageScenario: scenario, logicalBackgroundCopies: normalized.backgrounds.length, dictionaryCount: normalized.backgrounds.length },
      normalized
    ),
    await measureContract(
      'referenced',
      arrayGenerator(referenced.cards),
      [],
      'GET /api/flashcards/deck/:deckId (referencias de asset)',
      'MODELED',
      { cardCount: count, imageScenario: scenario, uniqueAssetCount: referenced.uniqueAssetCount, requestsColdAssets: referenced.uniqueAssetCount },
      referenced.cards
    ),
    await measureContract(
      'hybrid',
      dictGenerator(hybrid),
      [hybrid.backgrounds.map((b) => b.thumb).join(',')],
      'GET /api/flashcards/deck/:deckId (miniaturas + referencias)',
      'MODELED',
      { cardCount: count, imageScenario: scenario, thumbnailCount: hybrid.backgrounds.length, requestsColdAssets: hybrid.backgrounds.length },
      hybrid
    ),
  ];

  return rows.map((row) => ({
    scenarioId: `cards-${count}-${scenario}-${row.contract}`,
    ...row,
    limitation: 'Contrato JSON reproducido en Node (MODELED); gzip y tiempos Node/V8 (MEASURED sobre el modelo); las miniaturas usan un perfil ESTIMADO; no incluye HTTP, MongoDB, parseo del navegador ni memoria raster.',
  }));
}

function baseDeck(index, { coverImage = '', cardBackgrounds = [], coverImageThumb = '' } = {}) {
  return {
    id: `deck-${String(index).padStart(4, '0')}`,
    userId: '000000000000000000000001',
    title: `Mazo sintético ${index}`,
    coverColor: '#4f46e5',
    coverImage,
    cardCount: 100,
    cardBackgrounds,
    coverImageThumb,
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
  };
}

function deckImagesFor(count, scenario, index) {
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

async function runDeckScenario(count, scenario) {
  const currentDecks = Array.from({ length: count }, (_, index) => {
    const images = deckImagesFor(count, scenario, index);
    return baseDeck(index, { coverImage: images.coverImage, cardBackgrounds: images.cardBackgrounds });
  });
  const summaryDecks = currentDecks.map(({ coverImage, cardBackgrounds, ...rest }) => rest);
  const thumbDecks = currentDecks.map((deck, index) => baseDeck(index, { coverImageThumb: deckImagesFor(count, scenario, index).coverImageThumb }));
  const migrationDecks = currentDecks.map((deck, index) => ({
    ...deck,
    cardBackgrounds: deck.cardBackgrounds,
    cardBackgroundAssetIds: deck.cardBackgrounds.map((_, bgIndex) => `bg-${String(index).padStart(4, '0')}-${bgIndex}`),
  }));

  const measure = async (label, decks, endpoint, evidence, extra = {}) => {
    const images = decks.flatMap((deck) => [deck.coverImage, ...(deck.cardBackgrounds || [])]);
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
      ...imageStats(images),
      ...extra,
      limitation: 'JSON reproducido en Node (MODELED); gzip y tiempos Node/V8 (MEASURED sobre el modelo); el contrato summary elimina coverImage y cardBackgrounds como haría un contrato de resumen.',
    };
  };

  const rows = [
    await measure('current', currentDecks, 'GET /api/decks/:userId', 'MODELED', { legacyContract: true }),
    await measure('summary', summaryDecks, 'GET /api/decks/:userId (resumen sin imágenes)', 'MODELED', { summaryWithoutImages: true }),
    await measure('thumb', thumbDecks, 'GET /api/decks/:userId (sólo miniatura de portada)', 'MODELED', { thumbnailOnly: true }),
    await measure('migration_dual', migrationDecks, 'GET /api/decks/:userId (migración dual: heredado + ids)', 'MODELED', { dualMigration: true, legacyContract: true }),
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

async function main() {
  const startedAt = new Date().toISOString();
  const cardScenarios = ['no_image', 'shared_small', 'shared_medium', 'shared_large', 'distinct_backgrounds', 'content_10pct', 'content_all'];
  const cardCounts = [20, 100, 500, 1000];
  const deckScenarios = ['no_images', 'covers', 'backgrounds', 'cover_and_backgrounds'];
  const deckCounts = [10, 100, 500];

  const cardRows = [];
  for (const count of cardCounts) {
    for (const scenario of cardScenarios) {
      cardRows.push(...(await runCardScenario(count, scenario)));
    }
  }
  const deckRows = [];
  for (const count of deckCounts) {
    for (const scenario of deckScenarios) {
      deckRows.push(...(await runDeckScenario(count, scenario)));
    }
  }

  const output = {
    schemaVersion: '1.1.0',
    phase: '1B image-delivery',
    commit: COMMIT,
    generatedAt: startedAt,
    evidenceClasses: ['MEASURED', 'STATICALLY CONFIRMED', 'MODELED', 'ESTIMATED', 'BLOCKED', 'PENDING — DEVICE REQUIRED'],
    contractsCompared: ['current', 'normalized', 'referenced', 'hybrid'],
    profiles,
    cardScenarios,
    cardCounts,
    deckScenarios,
    deckCounts,
    summary: {
      cardScenarioRows: cardRows.length,
      deckScenarioRows: deckRows.length,
      bsonRows: 3,
    },
    thumbProfileEvidence: 'ESTIMATED: binaryBytes = 32 KiB × (256×144)/(320×180) escalado del perfil small medido en la Fase 1A.',
    results: {
      cardResponses: cardRows,
      deckLists: deckRows,
      bson: measureBsonAssets(),
    },
  };

  fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2));
  console.log(JSON.stringify({
    status: 'PASS',
    output: OUTPUT,
    cardRows: cardRows.length,
    deckRows: deckRows.length,
    bsonRows: output.results.bson.length,
    bytes: fs.statSync(OUTPUT).size,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
