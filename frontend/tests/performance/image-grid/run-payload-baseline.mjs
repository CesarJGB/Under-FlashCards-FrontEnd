import { createRequire } from 'node:module';
import { once } from 'node:events';
import { performance } from 'node:perf_hooks';
import { gzipSync, createGzip } from 'node:zlib';
import fs from 'node:fs';
import os from 'node:os';

const require = createRequire(import.meta.url);
const { BSON, ObjectId } = require('../../../../backend/node_modules/bson');

const COMMIT = process.env.PERF_COMMIT || 'UNKNOWN';
const OUTPUT = process.argv[2] || '/tmp/image-payload-results.json';
const UTF8 = (value) => Buffer.byteLength(value, 'utf8');
const REPETITIONS = 5;

const profiles = {
  small: { width: 320, height: 180, binaryBytes: 32 * 1024, mime: 'image/jpeg' },
  medium: { width: 1280, height: 720, binaryBytes: 256 * 1024, mime: 'image/jpeg' },
  large: { width: 2400, height: 1600, binaryBytes: 700 * 1024, mime: 'image/jpeg' },
  content: { width: 600, height: 338, binaryBytes: 128 * 1024, mime: 'image/jpeg' },
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

function baseCard(index, { bgImage = '', contentImage = '' } = {}) {
  return {
    id: `card-${String(index).padStart(4, '0')}`,
    userId: '000000000000000000000001',
    deckId: '000000000000000000000002',
    question: `Pregunta sintética ${index}`,
    answer: `Respuesta sintética ${index}`,
    easeFactor: 2.5,
    bgImage,
    textAlign: 'center',
    fontSize: 'text-base',
    contentImage,
    imageSide: contentImage ? (index % 2 ? 'question' : 'answer') : '',
    difficulty: 0.3,
    totalReviews: 0,
    consecutiveErrors: 0,
    lastReviewedAt: null,
    createdAt: '2026-08-12T00:00:00.000Z',
  };
}

function cardImageFor(scenario, index, shared) {
  if (scenario === 'shared_small') return { bgImage: shared.small };
  if (scenario === 'shared_medium') return { bgImage: shared.medium };
  if (scenario === 'shared_large') return { bgImage: shared.large };
  if (scenario === 'distinct_backgrounds') return { bgImage: dataUrl('medium', 1000 + index) };
  if (scenario === 'content_10pct') {
    return index % 10 === 0 ? { contentImage: dataUrl('content', 2000 + index) } : {};
  }
  if (scenario === 'content_all') return { contentImage: dataUrl('content', 3000 + index) };
  return {};
}

async function measureCardScenario(count, scenario, shared, baselineBytes) {
  let jsonBytes = 0;
  let imageUtf8Bytes = 0;
  let uniqueImageUtf8Bytes = 0;
  let logicalBackgroundCopies = 0;
  let repeatedBackgroundBytes = 0;
  const uniqueImages = new Set();

  async function* chunks() {
    const open = '[';
    jsonBytes += UTF8(open);
    yield open;
    for (let index = 0; index < count; index += 1) {
      const images = cardImageFor(scenario, index, shared);
      const prefix = index ? ',' : '';
      const json = JSON.stringify(baseCard(index, images));
      jsonBytes += UTF8(prefix) + UTF8(json);
      for (const value of [images.bgImage, images.contentImage]) {
        if (!value) continue;
        const bytes = UTF8(value);
        imageUtf8Bytes += bytes;
        if (!uniqueImages.has(value)) {
          uniqueImages.add(value);
          uniqueImageUtf8Bytes += bytes;
        }
      }
      if (images.bgImage) logicalBackgroundCopies += 1;
      yield prefix + json;
    }
    jsonBytes += 1;
    yield ']';
  }

  const started = performance.now();
  const gzipBytes = await streamGzip(chunks());
  const durationMs = performance.now() - started;
  repeatedBackgroundBytes = Math.max(0, imageUtf8Bytes - uniqueImageUtf8Bytes);

  return {
    scenarioId: `cards-${count}-${scenario}`,
    endpoint: 'GET /api/flashcards/deck/:deckId',
    evidence: 'MODELED',
    status: 'PASS',
    cardCount: count,
    imageScenario: scenario,
    jsonUtf8Bytes: jsonBytes,
    gzipBytes,
    gzipRatio: gzipBytes / jsonBytes,
    baselineJsonUtf8Bytes: baselineBytes || jsonBytes,
    imageUtf8Bytes,
    uniqueImageUtf8Bytes,
    repeatedBackgroundBytes,
    duplicatePercentOfJson: jsonBytes ? (repeatedBackgroundBytes / jsonBytes) * 100 : 0,
    logicalBackgroundCopies,
    uniqueImageCount: uniqueImages.size,
    approximateBytesPer100Cards: (jsonBytes / count) * 100,
    streamModelDurationMs: durationMs,
    limitation: 'Contrato JSON reproducido en Node; no incluye HTTP, MongoDB, parseo del navegador ni memoria raster.'
  };
}

function baseDeck(index, { coverImage = '', cardBackgrounds = [] } = {}) {
  return {
    id: `deck-${String(index).padStart(4, '0')}`,
    userId: '000000000000000000000001',
    title: `Mazo sintético ${index}`,
    coverColor: '#4f46e5',
    coverImage,
    cardCount: 100,
    cardBackgrounds,
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
      lastCalculatedAt: '2026-08-12T00:00:00.000Z'
    },
    createdAt: '2026-08-12T00:00:00.000Z'
  };
}

function createDecks(count, scenario) {
  return Array.from({ length: count }, (_, index) => {
    const coverImage = scenario === 'covers' || scenario === 'cover_and_backgrounds'
      ? dataUrl('small', 10000 + index)
      : '';
    const cardBackgrounds = scenario === 'backgrounds' || scenario === 'cover_and_backgrounds'
      ? [0, 1, 2].map((offset) => dataUrl('small', 20000 + index * 3 + offset))
      : [];
    return baseDeck(index, { coverImage, cardBackgrounds });
  });
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
  return { ...percentileSummary(values), unit: 'ms', serialized };
}

function measureDeckScenario(count, scenario) {
  const decks = createDecks(count, scenario);
  const stringify = timeJsonOperation(decks, 'stringify');
  const json = stringify.serialized;
  const parse = timeJsonOperation(json, 'parse');
  const coverBytes = decks.reduce((sum, deck) => sum + UTF8(deck.coverImage), 0);
  const backgroundBytes = decks.reduce(
    (sum, deck) => sum + deck.cardBackgrounds.reduce((inner, image) => inner + UTF8(image), 0),
    0
  );
  return {
    scenarioId: `decks-${count}-${scenario}`,
    endpoint: 'GET /api/decks/:userId',
    evidence: 'MEASURED',
    status: 'PASS',
    deckCount: count,
    imageScenario: scenario,
    jsonUtf8Bytes: UTF8(json),
    jsonCharacters: json.length,
    gzipBytes: gzipSync(json, { level: 6 }).length,
    coverImageUtf8Bytes: coverBytes,
    cardBackgroundUtf8Bytes: backgroundBytes,
    attemptedLocalStorageUtf8Bytes: UTF8(json),
    attemptedLocalStorageCharacters: json.length,
    stringifyMs: { ...stringify, serialized: undefined },
    parseMs: { ...parse, serialized: undefined },
    repetitions: REPETITIONS,
    limitation: 'Tiempos Node/V8, no localStorage de navegador; las imágenes de cada Deck son sintéticas y distintas.'
  };
}

function measureProfiles() {
  return Object.entries(profiles).map(([name, profile], index) => {
    const binary = seededBytes(profile.binaryBytes, 40000 + index);
    const url = `data:${profile.mime};base64,${binary.toString('base64')}`;
    const wrapped = JSON.stringify({ image: url });
    return {
      profile: name,
      evidence: 'MEASURED',
      status: 'PASS',
      representedDimensions: { width: profile.width, height: profile.height },
      binaryBytes: binary.length,
      base64Characters: binary.toString('base64').length,
      dataUrlCharacters: url.length,
      dataUrlUtf8Bytes: UTF8(url),
      jsonUtf8Bytes: UTF8(wrapped),
      gzipJsonBytes: gzipSync(wrapped, { level: 6 }).length,
      base64ToBinaryRatio: binary.toString('base64').length / binary.length,
      estimatedDecodedRgbaBytes: profile.width * profile.height * 4,
      decodedMemoryEvidence: 'ESTIMATED',
      decodedMemoryFormula: 'width × height × 4 bytes (RGBA8); excludes mipmaps, alignment, copies and GPU implementation.'
    };
  });
}

function measureBson() {
  const deckId = new ObjectId('000000000000000000000002');
  const userId = new ObjectId('000000000000000000000001');
  const cases = [];
  for (const profileName of ['small', 'medium', 'large']) {
    for (const count of [1, 10]) {
      const cardBackgrounds = Array.from({ length: count }, (_, index) => dataUrl(profileName, 50000 + index));
      const doc = {
        _id: deckId,
        userId,
        title: 'Mazo BSON sintético',
        coverImage: dataUrl(profileName, 60000),
        cardBackgrounds,
        createdAt: new Date('2026-08-12T00:00:00.000Z'),
        updatedAt: new Date('2026-08-12T00:00:00.000Z')
      };
      cases.push({
        scenarioId: `bson-deck-${profileName}-${count}-backgrounds`,
        evidence: 'MEASURED',
        status: 'PASS',
        profile: profileName,
        backgroundCount: count,
        bsonBytes: BSON.calculateObjectSize(doc),
        logicalImageUtf8Bytes: UTF8(doc.coverImage) + doc.cardBackgrounds.reduce((sum, value) => sum + UTF8(value), 0),
        limitation: 'BSON sintético medido con la dependencia bson instalada; no es un documento real ni incluye overhead de WiredTiger.'
      });
    }
  }
  const flashcard = {
    _id: new ObjectId('000000000000000000000003'), userId, deckId,
    question: 'Pregunta', answer: 'Respuesta', bgImageIndex: 0,
    contentImage: dataUrl('content', 70000), imageSide: 'question',
    createdAt: new Date('2026-08-12T00:00:00.000Z'), updatedAt: new Date('2026-08-12T00:00:00.000Z')
  };
  cases.push({
    scenarioId: 'bson-flashcard-content', evidence: 'MEASURED', status: 'PASS',
    bsonBytes: BSON.calculateObjectSize(flashcard),
    logicalImageUtf8Bytes: UTF8(flashcard.contentImage),
    limitation: 'BSON sintético medido; no representa índices, compresión ni memoria Mongoose.'
  });
  return cases;
}

function measureIndexOf() {
  const results = [];
  let sink = 0;
  for (const profileName of ['small', 'medium', 'large']) {
    const iterations = profileName === 'large' ? 5 : profileName === 'medium' ? 20 : 100;
    for (const count of [1, 10, 50, 100]) {
      const values = Array.from({ length: count }, (_, index) => dataUrl(profileName, 80000 + index));
      const equalCopy = (` ${values.at(-1)}`).slice(1);
      const miss = `${equalCopy.slice(0, -1)}${equalCopy.at(-1) === 'A' ? 'B' : 'A'}`;
      for (const [lookup, target] of [['existing_last_equal_copy', equalCopy], ['missing_same_prefix', miss]]) {
        for (let warm = 0; warm < 2; warm += 1) sink += values.indexOf(target);
        const samples = [];
        for (let repetition = 0; repetition < REPETITIONS; repetition += 1) {
          const started = performance.now();
          for (let i = 0; i < iterations; i += 1) sink += values.indexOf(target);
          samples.push((performance.now() - started) / iterations);
        }
        results.push({
          scenarioId: `indexof-${profileName}-${count}-${lookup}`,
          evidence: 'MEASURED', status: 'PASS', profile: profileName,
          backgroundCount: count, lookup, repetitions: REPETITIONS,
          iterationsPerRepetition: iterations, durationPerLookupMs: { ...percentileSummary(samples), unit: 'ms' },
          limitation: 'Microbenchmark Node/V8; no mide Mongoose, BSON, red ni motor JavaScript del navegador.'
        });
      }
    }
  }
  if (sink === Number.MIN_SAFE_INTEGER) process.stderr.write('unreachable');
  return results;
}

const startedAt = new Date().toISOString();
const shared = {
  small: dataUrl('small', 101),
  medium: dataUrl('medium', 102),
  large: dataUrl('large', 103)
};

const cardResults = [];
for (const count of [20, 100, 500, 1000]) {
  const noImage = await measureCardScenario(count, 'no_image', shared);
  cardResults.push(noImage);
  for (const scenario of [
    'shared_small', 'shared_medium', 'shared_large', 'distinct_backgrounds',
    'content_10pct', 'content_all'
  ]) {
    cardResults.push(await measureCardScenario(count, scenario, shared, noImage.jsonUtf8Bytes));
  }
}

const deckResults = [];
for (const count of [10, 100, 500]) {
  for (const scenario of ['no_images', 'covers', 'backgrounds', 'cover_and_backgrounds']) {
    deckResults.push(measureDeckScenario(count, scenario));
  }
}

const output = {
  schemaVersion: '1.0.0',
  kind: 'under-flashcards-image-payload-baseline',
  commit: COMMIT,
  startedAt,
  finishedAt: new Date().toISOString(),
  environment: {
    node: process.version,
    v8: process.versions.v8,
    platform: `${os.platform()} ${os.release()} ${os.arch()}`,
    cpuModel: os.cpus()[0]?.model || 'unknown',
    logicalCpuCount: os.cpus().length,
    totalMemoryBytes: os.totalmem(),
    gzip: 'node:zlib level 6'
  },
  repetitions: REPETITIONS,
  profiles: measureProfiles(),
  cardResponses: cardResults,
  deckResponses: deckResults,
  bson: measureBson(),
  indexOf: measureIndexOf(),
  createCardOperations: [
    { scenario: 'no_background', evidence: 'STATICALLY CONFIRMED', reads: 1, writes: 1, sequence: ['Flashcard.create', 'Deck.findById for serialize'] },
    { scenario: 'existing_background', evidence: 'STATICALLY CONFIRMED', reads: 2, writes: 1, sequence: ['Deck.findById/indexOf', 'Flashcard.create', 'Deck.findById for serialize'] },
    { scenario: 'new_background', evidence: 'STATICALLY CONFIRMED', reads: 2, writes: 2, sequence: ['Deck.findById/indexOf', 'Deck.save', 'Flashcard.create', 'Deck.findById for serialize'] }
  ],
  representativeDatabase: {
    status: 'BLOCKED',
    evidence: 'BLOCKED',
    label: 'BLOCKED — REPRESENTATIVE DATABASE UNAVAILABLE',
    limitation: 'No se conectó ninguna base; no se ejecutó explain(), profiler ni latencia MongoDB.'
  }
};

fs.writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ output: OUTPUT, cardScenarios: cardResults.length, deckScenarios: deckResults.length, bsonScenarios: output.bson.length, indexOfScenarios: output.indexOf.length }));
