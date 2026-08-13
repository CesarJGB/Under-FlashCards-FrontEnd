// FILE: backend/test/imageDeliveryContracts.test.js
// Corte 0 — contratos y pruebas de caracterización de entrega de imágenes.
// Congela el contrato heredado (Flashcard.serialize con bgImage expandido y
// resolución desde cardBackgrounds + bgImageIndex) y el contrato objetivo
// ({ backgrounds, cards } con bgImageIndex). Sólo pruebas y fixtures:
// no hay código productivo ni cambios de endpoint.
//
// Corte 1 — pruebas del normalizador productivo (backend/src/utils/imageDelivery.js),
// de los serializadores nuevos (Flashcard.serializeIndexed, Deck.serializeSummary)
// y presupuestos de aceptación con la implementación real.
//
// Corte 2 — pruebas del contrato ligero de lista de mazos
// (`?contract=indexed&cover=thumbnail`), de la validación de coverImageThumb,
// de las escrituras parciales de imagen y del presupuesto de 500 mazos.

const test = require('node:test');
const assert = require('node:assert/strict');
const { gzipSync } = require('node:zlib');
const Flashcard = require('../src/models/Flashcard');
const Deck = require('../src/models/Deck');
const {
  isIndexedContractRequest,
  resolveDeckListContract,
  isValidCoverThumb,
  sanitizeCoverThumb,
  buildDeckImageFields,
  buildIndexedCardPayload,
  buildIndexedSessionPayload,
} = require('../src/utils/imageDelivery');
const {
  BG_SHARED,
  BG_RED,
  BG_GREEN,
  BG_BLUE,
  CONTENT_IMAGE_A,
  CONTENT_IMAGE_B,
  baseCard,
  legacyCard,
  buildIndexedCards,
  resolveBackground,
} = require('./imageDeliveryFixtures');

// Documento Flashcard sintético para caracterizar Flashcard.serialize().
function legacyDoc(overrides = {}) {
  return new Flashcard({
    userId: '000000000000000000000001',
    deckId: '000000000000000000000002',
    question: 'Pregunta sintética',
    answer: 'Respuesta sintética',
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
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Escenario F — caracterización del serializador actual
// ---------------------------------------------------------------------------

test('F: serialize expands a valid bgImageIndex against cardBackgrounds', () => {
  const serialized = legacyDoc({ bgImageIndex: 1 }).serialize([BG_SHARED, BG_RED]);

  assert.equal(serialized.bgImage, BG_RED);
  assert.equal(legacyDoc({ bgImageIndex: 0 }).serialize([BG_RED, BG_GREEN, BG_BLUE]).bgImage, BG_RED);
});

test('F: serialize maps -1 to an empty bgImage even with a populated dictionary', () => {
  const serialized = legacyDoc({ bgImageIndex: -1 }).serialize([BG_SHARED]);
  assert.equal(serialized.bgImage, '');
});

test('F: serialize maps an in-range index against an empty dictionary to empty bgImage', () => {
  const serialized = legacyDoc({ bgImageIndex: 0 }).serialize([]);
  assert.equal(serialized.bgImage, '');
});

test('F: serialize maps an out-of-range index to empty bgImage', () => {
  const serialized = legacyDoc({ bgImageIndex: 5 }).serialize([BG_SHARED, BG_RED]);
  assert.equal(serialized.bgImage, '');
});

test('F: serialize maps a missing or non-array dictionary to empty bgImage', () => {
  assert.equal(legacyDoc({ bgImageIndex: 0 }).serialize(undefined).bgImage, '');
  assert.equal(legacyDoc({ bgImageIndex: 0 }).serialize(null).bgImage, '');
});

test('F: serialize preserves content, format, telemetry and identifiers', () => {
  const card = legacyDoc({
    bgImageIndex: 0,
    question: '¿Qué es X?',
    answer: 'X es...',
    contentImage: CONTENT_IMAGE_A,
    imageSide: 'question',
    textAlign: 'left',
    fontSize: 'text-2xl',
    difficulty: 0.7,
    totalReviews: 12,
    consecutiveErrors: 3,
    lastReviewedAt: '2026-08-01T10:00:00.000Z',
  });
  const serialized = card.serialize([BG_SHARED, BG_RED]);

  assert.deepEqual(Object.keys(serialized).sort(), [
    'answer',
    'bgImage',
    'consecutiveErrors',
    'contentImage',
    'createdAt',
    'deckId',
    'difficulty',
    'easeFactor',
    'fontSize',
    'id',
    'imageSide',
    'lastReviewedAt',
    'question',
    'textAlign',
    'totalReviews',
    'userId',
  ]);
  assert.equal('bgImageIndex' in serialized, false, 'bgImageIndex no debe sobrevivir al serializador');
  assert.equal(serialized.bgImage, BG_SHARED);
  assert.equal(serialized.question, '¿Qué es X?');
  assert.equal(serialized.answer, 'X es...');
  assert.equal(serialized.easeFactor, 2.5);
  assert.equal(serialized.textAlign, 'left');
  assert.equal(serialized.fontSize, 'text-2xl');
  assert.equal(serialized.contentImage, CONTENT_IMAGE_A);
  assert.equal(serialized.imageSide, 'question');
  assert.equal(serialized.difficulty, 0.7);
  assert.equal(serialized.totalReviews, 12);
  assert.equal(serialized.consecutiveErrors, 3);
  assert.equal(serialized.lastReviewedAt instanceof Date, true, 'mongoose castea lastReviewedAt a Date');
  assert.equal(serialized.lastReviewedAt.toISOString(), '2026-08-01T10:00:00.000Z');
  assert.equal(String(serialized.id), String(card._id));
  assert.equal(String(serialized.userId), '000000000000000000000001');
  assert.equal(String(serialized.deckId), '000000000000000000000002');
});

// ---------------------------------------------------------------------------
// Escenario E (lado backend) — el contrato heredado mantiene sus campos
// ---------------------------------------------------------------------------

test('E: legacy responses expand the shared background once per card', () => {
  const dictionary = [BG_SHARED, BG_RED];
  const cards = [legacyDoc({ bgImageIndex: 0 }), legacyDoc({ bgImageIndex: 0 }), legacyDoc({ bgImageIndex: 0 })];
  const serialized = cards.map((card) => card.serialize(dictionary));

  assert.equal(serialized.length, 3);
  for (const card of serialized) {
    assert.equal(card.bgImage, BG_SHARED);
    assert.equal('bgImageIndex' in card, false);
  }
  assert.equal(serialized.filter((card) => card.bgImage === BG_SHARED).length, 3);
});

test('E: legacy cards without background serialize with bgImage: ""', () => {
  const serialized = legacyDoc({ bgImageIndex: -1 }).serialize([BG_SHARED]);
  assert.equal(serialized.bgImage, '');
});

// ---------------------------------------------------------------------------
// Contrato objetivo — { backgrounds, cards } con bgImageIndex
// ---------------------------------------------------------------------------

test('A: no-background cards normalize to an empty dictionary and -1 indices', () => {
  const cards = [legacyCard(1), legacyCard(2), legacyCard(3)];
  const { backgrounds, cards: indexed } = buildIndexedCards(cards);

  assert.deepEqual(backgrounds, []);
  assert.ok(indexed.every((card) => card.bgImageIndex === -1));
  assert.ok(indexed.every((card) => resolveBackground(card, backgrounds) === ''));
});

test('B: a shared background yields a single dictionary entry and one stable index', () => {
  const cards = [
    legacyCard(1, { bgImage: BG_SHARED }),
    legacyCard(2, { bgImage: BG_SHARED }),
    legacyCard(3, { bgImage: BG_SHARED }),
    legacyCard(4, { bgImage: BG_SHARED }),
  ];
  const { backgrounds, cards: indexed } = buildIndexedCards(cards);

  assert.equal(backgrounds.length, 1);
  assert.equal(backgrounds[0], BG_SHARED);
  assert.ok(indexed.every((card) => card.bgImageIndex === 0));
  assert.ok(indexed.every((card) => resolveBackground(card, backgrounds) === BG_SHARED));
  assert.equal(JSON.stringify({ backgrounds, cards: indexed }).split(BG_SHARED).length - 1, 1);
});

test('C: distinct backgrounds yield one entry per unique with first-appearance indices', () => {
  const cards = [
    legacyCard(1, { bgImage: BG_RED }),
    legacyCard(2, { bgImage: BG_GREEN }),
    legacyCard(3, { bgImage: BG_RED }),
    legacyCard(4, { bgImage: BG_BLUE }),
  ];
  const { backgrounds, cards: indexed } = buildIndexedCards(cards);

  assert.deepEqual(backgrounds, [BG_RED, BG_GREEN, BG_BLUE]);
  assert.deepEqual(indexed.map((card) => card.bgImageIndex), [0, 1, 0, 2]);
  assert.equal(resolveBackground(indexed[0], backgrounds), BG_RED);
  assert.equal(resolveBackground(indexed[1], backgrounds), BG_GREEN);
  assert.equal(resolveBackground(indexed[2], backgrounds), BG_RED);
  assert.equal(resolveBackground(indexed[3], backgrounds), BG_BLUE);
});

test('D: mixed content with absent and invalid indices resolves safely', () => {
  const cards = [
    legacyCard(1, { bgImage: BG_RED, contentImage: CONTENT_IMAGE_A }),
    legacyCard(2, { contentImage: CONTENT_IMAGE_B }),
    legacyCard(3, { bgImage: BG_GREEN }),
    legacyCard(4, { bgImage: BG_BLUE }),
  ];
  const { backgrounds, cards: indexed } = buildIndexedCards(cards);
  const broken = { ...indexed[0], bgImageIndex: 99 };
  const noBackground = { ...indexed[1], bgImageIndex: -1 };

  assert.deepEqual(backgrounds, [BG_RED, BG_GREEN, BG_BLUE]);
  assert.equal(resolveBackground(broken, backgrounds), '', 'índice fuera de rango => fondo vacío');
  assert.equal(resolveBackground(noBackground, backgrounds), '', 'sin fondo => fondo vacío');
  assert.equal(resolveBackground(indexed[0], backgrounds), BG_RED);
  assert.equal(indexed[0].contentImage, CONTENT_IMAGE_A);
  assert.equal(indexed[1].contentImage, CONTENT_IMAGE_B);
  assert.equal(backgrounds.includes(CONTENT_IMAGE_A), false, 'contentImage no entra al diccionario');
  assert.equal(backgrounds.includes(CONTENT_IMAGE_B), false, 'contentImage no entra al diccionario');
});

test('invariant: no valid index lies outside the dictionary', () => {
  const cards = [
    legacyCard(1, { bgImage: BG_SHARED }),
    legacyCard(2, { bgImage: BG_RED }),
    legacyCard(3, { bgImage: BG_GREEN }),
    legacyCard(4, { bgImage: BG_SHARED }),
    legacyCard(5, { bgImage: BG_BLUE }),
    legacyCard(6),
  ];
  const { backgrounds, cards: indexed } = buildIndexedCards(cards);

  for (const card of indexed) {
    assert.ok(
      card.bgImageIndex === -1 || (card.bgImageIndex >= 0 && card.bgImageIndex < backgrounds.length),
      `bgImageIndex ${card.bgImageIndex} fuera del diccionario de ${backgrounds.length} entradas`,
    );
  }
});

// ---------------------------------------------------------------------------
// Precedencia dual (corrección puntual) — bgImageIndex manda cuando existe;
// bgImage es fallback exclusivo de tarjetas sin bgImageIndex.
// Alineado con migration-rollout-rollback.md (campo dual: el cliente nuevo
// usa backgrounds + bgImageIndex e ignora bgImage).
// ---------------------------------------------------------------------------

test('dual A: an indexed card with both fields resolves from backgrounds, not bgImage', () => {
  const dual = legacyCard(1, { bgImageIndex: 0, bgImage: BG_BLUE });

  assert.equal('bgImageIndex' in dual, true);
  assert.equal(resolveBackground(dual, [BG_RED]), BG_RED, 'el índice manda sobre bgImage');
});

test('dual B: bgImageIndex -1 with a populated bgImage resolves to empty', () => {
  const dual = legacyCard(1, { bgImageIndex: -1, bgImage: BG_BLUE });

  assert.equal(resolveBackground(dual, [BG_RED]), '', 'sin fondo indexado => "" aunque bgImage esté poblado');
});

test('dual C: an out-of-range index with a populated bgImage resolves to empty', () => {
  const dual = legacyCard(1, { bgImageIndex: 99, bgImage: BG_BLUE });

  assert.equal(resolveBackground(dual, [BG_RED]), '', 'índice inválido => "" sin rescate de bgImage');
});

test('dual D: a truly legacy card without bgImageIndex resolves its bgImage', () => {
  const legacy = legacyCard(1, { bgImage: BG_BLUE });

  assert.equal(resolveBackground(legacy, [BG_RED]), BG_BLUE, 'shape sin indexar usa bgImage como fallback');
});

test('dual E: the legacy fixture never carries bgImageIndex', () => {
  assert.equal('bgImageIndex' in legacyCard(1, { bgImage: BG_SHARED }), false);
  assert.equal('bgImageIndex' in legacyCard(2), false);
});

// ===========================================================================
// CORTE 1 — normalizador productivo backend/src/utils/imageDelivery.js
// ===========================================================================

// Documento Flashcard sintético con bgImageIndex almacenado (shape de la BD).
function indexedDoc(seed, bgImageIndex, overrides = {}) {
  return legacyDoc({ bgImageIndex, ...overrides });
}

// ---------------------------------------------------------------------------
// Negociación del contrato (query parameter)
// ---------------------------------------------------------------------------

test('negotiation: contract=indexed is recognized only with that exact value', () => {
  assert.equal(isIndexedContractRequest({ query: { contract: 'indexed' } }), true);
  assert.equal(isIndexedContractRequest({ query: { contract: 'indexed', t: '1' } }), true);

  assert.equal(isIndexedContractRequest(undefined), false);
  assert.equal(isIndexedContractRequest(null), false);
  assert.equal(isIndexedContractRequest({}), false);
  assert.equal(isIndexedContractRequest({ query: {} }), false);
  assert.equal(isIndexedContractRequest({ query: { contract: undefined } }), false);
  assert.equal(isIndexedContractRequest({ query: { contract: '' } }), false);
  assert.equal(isIndexedContractRequest({ query: { contract: 'legacy' } }), false);
  assert.equal(isIndexedContractRequest({ query: { contract: 'indexed ' } }), false);
  assert.equal(isIndexedContractRequest({ query: { contract: 'INDEXED' } }), false);
  assert.equal(isIndexedContractRequest({ query: { contract: 0 } }), false);
});

test('negotiation: absence or unknown values keep the legacy expanded contract', () => {
  const cards = [indexedDoc(1, 0), indexedDoc(2, 0)];

  // Vía legacy (ausencia/valor desconocido): serialize() expande bgImage.
  const legacy = cards.map((card) => card.serialize([BG_SHARED]));
  assert.ok(legacy.every((card) => card.bgImage === BG_SHARED));
  assert.ok(legacy.every((card) => !('bgImageIndex' in card)));

  // La vía indexada sólo se activa con el flag exacto (comprobado arriba).
  assert.equal(isIndexedContractRequest({ query: { contract: 'legacy' } }), false);
  assert.equal(isIndexedContractRequest({ query: {} }), false);
});

// ---------------------------------------------------------------------------
// Normalizador: diccionario, remapeo y shape
// ---------------------------------------------------------------------------

test('indexed: a shared background yields one entry, one stable index, zero expanded bgImage', () => {
  const cards = [indexedDoc(1, 0), indexedDoc(2, 0), indexedDoc(3, 0)];
  const payload = buildIndexedCardPayload(cards, [BG_SHARED, BG_RED]);

  assert.equal(payload.backgrounds.length, 1);
  assert.equal(payload.backgrounds[0], BG_SHARED);
  assert.ok(payload.cards.every((card) => card.bgImageIndex === 0));
  assert.ok(payload.cards.every((card) => !('bgImage' in card)), 'cero bgImage dentro de las tarjetas');
  assert.equal(JSON.stringify(payload).split(BG_SHARED).length - 1, 1, 'una sola copia de la cadena');
});

test('indexed: distinct backgrounds keep one entry per unique with first-appearance indices', () => {
  const cards = [indexedDoc(1, 0), indexedDoc(2, 1), indexedDoc(3, 0), indexedDoc(4, 2)];
  const payload = buildIndexedCardPayload(cards, [BG_RED, BG_GREEN, BG_BLUE, BG_SHARED]);

  assert.deepEqual(payload.backgrounds, [BG_RED, BG_GREEN, BG_BLUE]);
  assert.deepEqual(payload.cards.map((card) => card.bgImageIndex), [0, 1, 0, 2]);
  assert.ok(payload.cards.every((card) => !('bgImage' in card)));
});

test('indexed: duplicated strings inside storage remap to a single response entry', () => {
  const stored = [BG_SHARED, BG_RED, BG_SHARED]; // la misma cadena dos veces en storage
  const cards = [indexedDoc(1, 0), indexedDoc(2, 1), indexedDoc(3, 2)];
  const payload = buildIndexedCardPayload(cards, stored);

  assert.deepEqual(payload.backgrounds, [BG_SHARED, BG_RED]);
  assert.deepEqual(payload.cards.map((card) => card.bgImageIndex), [0, 1, 0]);
});

test('indexed: stored backgrounds without references never travel', () => {
  const cards = [indexedDoc(1, 0), indexedDoc(2, 0)];
  const payload = buildIndexedCardPayload(cards, [BG_SHARED, BG_RED, BG_GREEN]);

  assert.deepEqual(payload.backgrounds, [BG_SHARED]);
  assert.equal(payload.backgrounds.includes(BG_RED), false);
  assert.equal(payload.backgrounds.includes(BG_GREEN), false);
});

test('indexed: -1, non-integer and out-of-range indices normalize to -1 without exceptions', () => {
  const cards = [
    indexedDoc(1, -1),
    indexedDoc(2, 1.5),
    indexedDoc(3, 99),
    indexedDoc(4, -7),
  ];
  const payload = buildIndexedCardPayload(cards, [BG_SHARED, BG_RED]);

  assert.deepEqual(payload.cards.map((card) => card.bgImageIndex), [-1, -1, -1, -1]);
  assert.ok(payload.cards.every((card) => !('bgImage' in card)), 'sin rescate de bgImage en el contrato indexado');
});

test('indexed: a card pointing to a non-string or empty stored entry normalizes to -1', () => {
  const cards = [indexedDoc(1, 0), indexedDoc(2, 1)];
  const payload = buildIndexedCardPayload(cards, [null, '']);

  assert.deepEqual(payload.backgrounds, []);
  assert.deepEqual(payload.cards.map((card) => card.bgImageIndex), [-1, -1]);
});

test('indexed: contentImage and every other card field stay intact', () => {
  const cards = [
    indexedDoc(1, 0, {
      question: '¿Qué es X?',
      answer: 'X es...',
      contentImage: CONTENT_IMAGE_A,
      imageSide: 'question',
      textAlign: 'left',
      fontSize: 'text-2xl',
      difficulty: 0.7,
      totalReviews: 12,
      consecutiveErrors: 3,
      lastReviewedAt: '2026-08-01T10:00:00.000Z',
    }),
    indexedDoc(2, -1, { contentImage: CONTENT_IMAGE_B }),
  ];
  const payload = buildIndexedCardPayload(cards, [BG_SHARED]);

  assert.deepEqual(payload.backgrounds, [BG_SHARED]);
  assert.equal(payload.cards[0].bgImageIndex, 0);
  assert.equal(payload.cards[0].contentImage, CONTENT_IMAGE_A);
  assert.equal(payload.cards[0].imageSide, 'question');
  assert.equal(payload.cards[0].textAlign, 'left');
  assert.equal(payload.cards[0].fontSize, 'text-2xl');
  assert.equal(payload.cards[0].difficulty, 0.7);
  assert.equal(payload.cards[0].totalReviews, 12);
  assert.equal(payload.cards[0].consecutiveErrors, 3);
  assert.equal(payload.cards[0].question, '¿Qué es X?');
  assert.equal(payload.cards[1].contentImage, CONTENT_IMAGE_B);
  assert.equal(payload.cards[1].bgImageIndex, -1);
  assert.equal(payload.backgrounds.includes(CONTENT_IMAGE_A), false, 'contentImage no entra al diccionario');
  assert.equal(payload.backgrounds.includes(CONTENT_IMAGE_B), false);
});

test('indexed: detail and session envelopes keep their exact shape', () => {
  const cards = [indexedDoc(1, 0), indexedDoc(2, 0)];
  const detail = buildIndexedCardPayload(cards, [BG_SHARED]);
  const session = buildIndexedSessionPayload(cards, [BG_SHARED]);

  assert.deepEqual(Object.keys(detail).sort(), ['backgrounds', 'cards']);
  assert.deepEqual(Object.keys(session).sort(), ['backgrounds', 'cards', 'success']);
  assert.equal(session.success, true);
  assert.deepEqual(session.backgrounds, [BG_SHARED]);
  assert.ok(session.cards.every((card) => card.bgImageIndex === 0 && !('bgImage' in card)));
});

// ---------------------------------------------------------------------------
// serializeIndexed() / serializeSummary() — modelos
// ---------------------------------------------------------------------------

test('indexed: Flashcard.serializeIndexed keeps the legacy field contract with bgImageIndex instead of bgImage', () => {
  const serialized = indexedDoc(1, 0, { contentImage: CONTENT_IMAGE_A }).serializeIndexed(0);

  assert.deepEqual(Object.keys(serialized).sort(), [
    'answer',
    'bgImageIndex',
    'consecutiveErrors',
    'contentImage',
    'createdAt',
    'deckId',
    'difficulty',
    'easeFactor',
    'fontSize',
    'id',
    'imageSide',
    'lastReviewedAt',
    'question',
    'textAlign',
    'totalReviews',
    'userId',
  ]);
  assert.equal('bgImage' in serialized, false);
  assert.equal(serialized.bgImageIndex, 0);
  assert.equal(serialized.contentImage, CONTENT_IMAGE_A);
});

test('indexed: Deck.serializeSummary excludes cardBackgrounds and keeps coverImage and metadata', () => {
  const deck = new Deck({
    userId: '000000000000000000000001',
    title: 'Mazo sintético',
    coverColor: '#4f46e5',
    coverImage: BG_SHARED,
    cardBackgrounds: [BG_RED, BG_GREEN],
    isStarred: true,
    isDefault: false,
    isPublicReadOnly: false,
    materiaId: null,
    parcialNumber: 1,
    temaId: '000000000000000000000003',
    subtemaId: null,
  });

  const summary = deck.serializeSummary(7);

  assert.equal('cardBackgrounds' in summary, false, 'el resumen versionado no lleva cardBackgrounds');
  assert.equal(summary.coverImage, BG_SHARED);
  assert.equal(summary.cardCount, 7);
  assert.equal(summary.title, 'Mazo sintético');
  assert.equal(summary.isStarred, true);
  assert.equal(summary.parcialNumber, 1);
  assert.equal(summary.analytics.masteryPercentage, 0);
});

test('indexed: Deck.serialize keeps the frozen legacy contract including cardBackgrounds', () => {
  const deck = new Deck({
    userId: '000000000000000000000001',
    title: 'Mazo sintético',
    coverColor: '#4f46e5',
    coverImage: BG_SHARED,
    cardBackgrounds: [BG_RED, BG_GREEN],
  });

  const legacy = deck.serialize(3);

  assert.deepEqual(legacy.cardBackgrounds, [BG_RED, BG_GREEN]);
  assert.equal(legacy.coverImage, BG_SHARED);
  assert.equal(legacy.cardCount, 3);
});

// ---------------------------------------------------------------------------
// Presupuestos de aceptación con la implementación productiva
// ---------------------------------------------------------------------------

// Data URL pseudoaleatoria (xorshift), poco compresible, como el harness de
// la Fase 1B: gzip se mantiene representativo. syntheticDataUrl es periódico
// cada 256 seeds y comprimiría de forma irreal.
function mixedDataUrl(seed, byteCount) {
  const payload = Buffer.alloc(byteCount);
  let state = (seed >>> 0) || 0x6d2b79f5;
  for (let i = 0; i < byteCount; i += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    payload[i] = state & 0xff;
  }
  return `data:image/jpeg;base64,${payload.toString('base64')}`;
}

test('budget A: 1000 cards sharing one large background stay under the indexed budget', () => {
  const LARGE_BG = mixedDataUrl(1, 700 * 1024); // perfil 'large' del harness
  const cards = Array.from({ length: 1000 }, (_, i) => indexedDoc(i, 0));

  const started = performance.now();
  const payload = buildIndexedCardPayload(cards, [LARGE_BG]);
  const json = JSON.stringify(payload);
  const jsonBytes = Buffer.byteLength(json, 'utf8');
  const gzipBytes = gzipSync(json).length;
  const stringifyMs = performance.now() - started;

  console.log(`[budget A] json=${jsonBytes} bytes, gzip=${gzipBytes} bytes, backgrounds=${payload.backgrounds.length}, stringify+payload=${stringifyMs.toFixed(1)}ms`);

  assert.equal(payload.backgrounds.length, 1);
  assert.equal(json.split(LARGE_BG).length - 1, 1, 'una sola copia de la cadena en el JSON');
  assert.ok(payload.cards.every((card) => card.bgImageIndex === 0), 'cero índices fuera de rango');
  assert.ok(payload.cards.every((card) => !('bgImage' in card)), 'cero bgImage dentro de cards');
  assert.ok(jsonBytes <= 1.5 * 1024 * 1024, `JSON indexado ${jsonBytes} bytes <= 1.5 MiB`);
  assert.ok(gzipBytes <= 0.8 * 1024 * 1024, `gzip ${gzipBytes} bytes <= 0.8 MiB`);
});

test('budget B: 1000 distinct backgrounds keep one entry per unique and valid indices', () => {
  const distinct = Array.from({ length: 1000 }, (_, i) => mixedDataUrl(i + 1, 96));
  const cards = Array.from({ length: 1000 }, (_, i) => indexedDoc(i, i));

  const started = performance.now();
  const payload = buildIndexedCardPayload(cards, distinct);
  const json = JSON.stringify(payload);
  const stringifyMs = performance.now() - started;

  console.log(`[budget B] json=${Buffer.byteLength(json, 'utf8')} bytes, backgrounds=${payload.backgrounds.length}, stringify+payload=${stringifyMs.toFixed(1)}ms`);

  assert.equal(payload.backgrounds.length, 1000);
  assert.equal(new Set(payload.backgrounds).size, 1000, 'cada cadena distinta aparece una sola vez en el diccionario');
  assert.equal(json.split('data:image/jpeg;base64,').length - 1, 1000, 'cada cadena aparece una sola vez en el JSON');
  assert.ok(payload.cards.every((card) => card.bgImageIndex >= 0 && card.bgImageIndex < 1000), 'todos los índices son válidos');
  assert.ok(payload.cards.every((card) => !('bgImage' in card)));
});

test('budget C: deck list summary of 500 decks with cover and backgrounds meets the budget', () => {
  const SMALL_IMAGE = mixedDataUrl(500, 32 * 1024); // perfil 'small' del harness
  const deckBackgrounds = [mixedDataUrl(601, 32 * 1024), mixedDataUrl(602, 32 * 1024), mixedDataUrl(603, 32 * 1024)];
  const decks = Array.from({ length: 500 }, (_, i) => new Deck({
    userId: '000000000000000000000001',
    title: `Mazo sintético ${i}`,
    coverColor: '#4f46e5',
    coverImage: SMALL_IMAGE,
    cardBackgrounds: deckBackgrounds,
    isStarred: false,
    isDefault: false,
    isPublicReadOnly: false,
    materiaId: null,
    parcialNumber: null,
    temaId: null,
    subtemaId: null,
  }));

  const legacy = JSON.stringify(decks.map((deck) => deck.serialize(100)));
  const legacyBytes = Buffer.byteLength(legacy, 'utf8');

  const started = performance.now();
  const summaries = decks.map((deck) => deck.serializeSummary(100));
  const json = JSON.stringify(summaries);
  const jsonBytes = Buffer.byteLength(json, 'utf8');
  const gzipBytes = gzipSync(json).length;
  const stringifyMs = performance.now() - started;
  const reductionPercent = ((1 - jsonBytes / legacyBytes) * 100);

  console.log(`[budget C] legacy=${legacyBytes} bytes, summary=${jsonBytes} bytes, gzip=${gzipBytes} bytes, reduction=${reductionPercent.toFixed(2)}%, stringify=${stringifyMs.toFixed(1)}ms`);

  assert.ok(summaries.every((deck) => !('cardBackgrounds' in deck)), 'cardBackgrounds ausente en el resumen');
  assert.ok(summaries.every((deck) => deck.coverImage === SMALL_IMAGE), 'coverImage conservada completa');
  assert.ok(summaries.every((deck) => deck.cardCount === 100), 'metadatos y conteo conservados');
  assert.ok(jsonBytes <= 22 * 1024 * 1024, `JSON del resumen ${jsonBytes} bytes <= 22 MiB`);
  assert.ok(gzipBytes <= 17 * 1024 * 1024, `gzip ${gzipBytes} bytes <= 17 MiB`);
  assert.ok(reductionPercent >= 70, `reducción ${reductionPercent.toFixed(2)}% >= 70% frente al contrato actual modelado`);
});

// ===========================================================================
// CORTE 2 — contrato ligero de lista de mazos (coverImageThumb opcional)
// ===========================================================================

// Miniatura sintética válida: Data URL image/webp cercana al presupuesto de
// ~24 KiB (24_576 caracteres de payload base64 + prefijo).
const COVER_THUMB = `data:image/webp;base64,${'A'.repeat(24576)}`;
// Portada completa sintética (~43 KiB de Data URL).
const FULL_COVER = mixedDataUrl(900, 32 * 1024);

function deckDocWithCover(overrides = {}) {
  return new Deck({
    userId: '000000000000000000000001',
    title: 'Mazo sintético',
    coverColor: '#4f46e5',
    coverImage: FULL_COVER,
    cardBackgrounds: [BG_RED, BG_GREEN],
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Negociación del contrato de lista de mazos
// ---------------------------------------------------------------------------

test('cut2: resolveDeckListContract maps requests to the three frozen list contracts', () => {
  assert.equal(resolveDeckListContract(undefined), 'legacy');
  assert.equal(resolveDeckListContract({ query: {} }), 'legacy');
  assert.equal(resolveDeckListContract({ query: { contract: 'legacy' } }), 'legacy');
  assert.equal(resolveDeckListContract({ query: { contract: 'indexed ' } }), 'legacy');
  assert.equal(resolveDeckListContract({ query: { contract: 'indexed' } }), 'indexed');
  assert.equal(resolveDeckListContract({ query: { contract: 'indexed', t: '1' } }), 'indexed');
  assert.equal(resolveDeckListContract({ query: { contract: 'indexed', cover: 'full' } }), 'indexed', 'valor desconocido de cover conserva el Corte 1');
  assert.equal(resolveDeckListContract({ query: { contract: 'indexed', cover: '' } }), 'indexed');
  assert.equal(resolveDeckListContract({ query: { contract: 'indexed', cover: 'THUMBNAIL' } }), 'indexed', 'el valor de cover es sensible a mayúsculas');
  assert.equal(resolveDeckListContract({ query: { contract: 'indexed', cover: 'thumbnail' } }), 'thumbnail');
  assert.equal(resolveDeckListContract({ query: { cover: 'thumbnail' } }), 'legacy', 'cover sin contract=indexed sigue siendo legacy');
});

// ---------------------------------------------------------------------------
// serializeLightSummary — contrato `contract=indexed&cover=thumbnail`
// ---------------------------------------------------------------------------

test('cut2: a deck with a valid thumbnail ships coverImageThumb and omits full coverImage', () => {
  const deck = deckDocWithCover({ coverImageThumb: COVER_THUMB, isStarred: true });
  const summary = deck.serializeLightSummary(7);

  assert.equal('cardBackgrounds' in summary, false, 'nunca incluye cardBackgrounds');
  assert.equal('coverImage' in summary, false, 'la portada completa no viaja cuando hay miniatura');
  assert.equal(summary.coverImageThumb, COVER_THUMB);
  assert.equal(summary.cardCount, 7);
  assert.equal(summary.title, 'Mazo sintético');
  assert.equal(summary.isStarred, true);
});

test('cut2: a deck without thumbnail falls back to the full coverImage and invents nothing', () => {
  const deck = deckDocWithCover({ coverImageThumb: '' });
  const summary = deck.serializeLightSummary(3);

  assert.equal('coverImageThumb' in summary, false, 'no inventa una miniatura');
  assert.equal(summary.coverImage, FULL_COVER, 'fallback a la portada completa');
  assert.equal('cardBackgrounds' in summary, false);
});

test('cut2: an invalid stored thumbnail falls back to the full coverImage', () => {
  const deck = deckDocWithCover({ coverImageThumb: 'https://example.com/not-a-data-url.png' });
  const summary = deck.serializeLightSummary(3);

  assert.equal('coverImageThumb' in summary, false);
  assert.equal(summary.coverImage, FULL_COVER);
  assert.equal('cardBackgrounds' in summary, false);
});

test('cut2: the frozen legacy and Corte 1 contracts never leak coverImageThumb', () => {
  const deck = deckDocWithCover({ coverImageThumb: COVER_THUMB });

  const legacy = deck.serialize(3);
  const indexed = deck.serializeSummary(3);

  assert.equal('coverImageThumb' in legacy, false, 'contrato legacy congelado sin miniaturas');
  assert.deepEqual(legacy.cardBackgrounds, [BG_RED, BG_GREEN], 'legacy conserva cardBackgrounds');
  assert.equal(legacy.coverImage, FULL_COVER);
  assert.equal('coverImageThumb' in indexed, false, 'contrato indexed del Corte 1 sin miniaturas');
  assert.equal(indexed.coverImage, FULL_COVER, 'Corte 1 conserva la portada completa');
  assert.equal('cardBackgrounds' in indexed, false);
});

test('cut2: export path (Deck.serialize) keeps the full cover and ignores the thumbnail', () => {
  const deck = deckDocWithCover({ coverImageThumb: COVER_THUMB });
  const exported = deck.serialize(12);

  assert.equal(exported.coverImage, FULL_COVER, 'la exportación mantiene la portada completa');
  assert.equal('coverImageThumb' in exported, false);
});

// ---------------------------------------------------------------------------
// Validación y normalización de la miniatura
// ---------------------------------------------------------------------------

test('cut2: isValidCoverThumb accepts only raster image data URLs within the length cap', () => {
  assert.equal(isValidCoverThumb(COVER_THUMB), true);
  assert.equal(isValidCoverThumb('data:image/jpeg;base64,AAAAAA=='), true);
  assert.equal(isValidCoverThumb('data:image/png;base64,BBBBBBBB'), true);

  assert.equal(isValidCoverThumb(''), false);
  assert.equal(isValidCoverThumb(null), false);
  assert.equal(isValidCoverThumb(undefined), false);
  assert.equal(isValidCoverThumb(42), false);
  assert.equal(isValidCoverThumb('https://example.com/img.png'), false);
  assert.equal(isValidCoverThumb('data:image/svg+xml;base64,PHN2Zz4='), false);
  assert.equal(isValidCoverThumb('data:text/html;base64,AAAA'), false);
  assert.equal(isValidCoverThumb('data:image/webp;base64,'), false, 'sin payload');
  assert.equal(isValidCoverThumb(`data:image/webp;base64,${'A'.repeat(200 * 1024)}`), false, 'excesiva');
});

test('cut2: sanitizeCoverThumb normalizes invalid or excessive input to "" without touching absent fields', () => {
  assert.equal(sanitizeCoverThumb(COVER_THUMB), COVER_THUMB);
  assert.equal(sanitizeCoverThumb(''), '');
  assert.equal(sanitizeCoverThumb(undefined), '');
  assert.equal(sanitizeCoverThumb('data:image/svg+xml;base64,AAAA'), '');
  assert.equal(sanitizeCoverThumb(`data:image/webp;base64,${'A'.repeat(200 * 1024)}`), '');
});

// ---------------------------------------------------------------------------
// Escrituras: creación, actualización parcial y eliminación explícita
// ---------------------------------------------------------------------------

test('cut2: buildDeckImageFields maps both image fields when the body sends them', () => {
  const fields = buildDeckImageFields({ coverImage: FULL_COVER, coverImageThumb: COVER_THUMB });
  assert.deepEqual(fields, { coverImage: FULL_COVER, coverImageThumb: COVER_THUMB });
});

test('cut2: a partial update without image fields modifies nothing stored', () => {
  const fields = buildDeckImageFields({ title: 'Nuevo título', isStarred: true, coverColor: '#000000' });
  assert.deepEqual(fields, {}, 'sin campos de imagen => sin cambios de portada');
  assert.deepEqual(buildDeckImageFields(undefined), {});
  assert.deepEqual(buildDeckImageFields(null), {});
});

test('cut2: explicit cover removal clears both fields', () => {
  const fields = buildDeckImageFields({ coverImage: '', coverImageThumb: '' });
  assert.deepEqual(fields, { coverImage: '', coverImageThumb: '' });
});

test('cut2: thumb-only or cover-only bodies update just that field', () => {
  assert.deepEqual(buildDeckImageFields({ coverImage: FULL_COVER }), { coverImage: FULL_COVER });
  assert.deepEqual(buildDeckImageFields({ coverImageThumb: COVER_THUMB }), { coverImageThumb: COVER_THUMB });
});

test('cut2: a non-string image field is ignored and an invalid thumbnail is normalized', () => {
  assert.deepEqual(buildDeckImageFields({ coverImage: 42 }), {});
  assert.deepEqual(buildDeckImageFields({ coverImageThumb: 42 }), {});
  assert.deepEqual(buildDeckImageFields({ coverImageThumb: 'https://no.data.url' }), { coverImageThumb: '' });
});

test('cut2: Deck documents default coverImageThumb to "" and keep both fields when provided', () => {
  const plain = deckDocWithCover();
  assert.equal(plain.coverImageThumb, '');

  const deck = deckDocWithCover({ coverImage: FULL_COVER, coverImageThumb: COVER_THUMB });
  assert.equal(deck.coverImage, FULL_COVER);
  assert.equal(deck.coverImageThumb, COVER_THUMB);
});

test('cut2: import payload with a valid thumbnail keeps it; without it the field stays ""', () => {
  assert.equal(sanitizeCoverThumb({ coverImageThumb: COVER_THUMB }.coverImageThumb), COVER_THUMB);
  assert.equal(sanitizeCoverThumb(undefined), '', 'payload sin miniatura => sin miniatura');
  const imported = deckDocWithCover({ coverImageThumb: sanitizeCoverThumb(undefined) });
  assert.equal(imported.coverImageThumb, '');
  assert.equal(imported.coverImage, FULL_COVER, 'la portada completa viaja por coverImage, no por la miniatura');
});

// ---------------------------------------------------------------------------
// Presupuesto del Corte 2 — 500 mazos con miniatura (implementación productiva)
// ---------------------------------------------------------------------------

test('cut2 budget: 500 decks with valid thumbnails meet the light summary budget', () => {
  const thumb = `data:image/webp;base64,${mixedDataUrl(701, 18 * 1024).split(',')[1]}`;
  const decks = Array.from({ length: 500 }, (_, i) => deckDocWithCover({
    title: `Mazo sintético ${i}`,
    coverImage: FULL_COVER,
    coverImageThumb: thumb,
  }));

  const summaries = decks.map((deck) => deck.serializeLightSummary(100));
  const json = JSON.stringify(summaries);
  const jsonBytes = Buffer.byteLength(json, 'utf8');
  const gzipBytes = gzipSync(json).length;

  const stringifyMs = [];
  for (let run = 0; run < 9; run += 1) {
    const started = performance.now();
    JSON.stringify(summaries);
    stringifyMs.push(performance.now() - started);
  }
  stringifyMs.sort((a, b) => a - b);
  const median = stringifyMs[Math.floor(stringifyMs.length / 2)];

  console.log(`[cut2 budget] json=${jsonBytes} bytes, gzip=${gzipBytes} bytes, stringify mediana=${median.toFixed(1)}ms (${stringifyMs.map((m) => m.toFixed(1)).join(',')})`);

  assert.ok(summaries.every((deck) => !('cardBackgrounds' in deck)), 'cardBackgrounds completamente ausente');
  assert.ok(summaries.every((deck) => !('coverImage' in deck)), 'coverImage completa ausente en mazos con miniatura');
  assert.ok(summaries.every((deck) => deck.coverImageThumb === thumb), 'coverImageThumb presente y válido');
  assert.ok(summaries.every((deck) => deck.cardCount === 100 && deck.title.startsWith('Mazo sintético')), 'metadatos y conteo intactos');
  assert.ok(jsonBytes <= 15 * 1024 * 1024, `JSON ligero ${jsonBytes} bytes <= 15 MiB`);
});

test('cut2 measure: 500 legacy decks without thumbnail and a mixed profile are logged honestly', () => {
  const thumb = `data:image/webp;base64,${mixedDataUrl(702, 18 * 1024).split(',')[1]}`;
  const legacyDecks = Array.from({ length: 500 }, (_, i) => deckDocWithCover({ title: `Mazo legacy ${i}`, coverImageThumb: '' }));
  const mixedDecks = Array.from({ length: 500 }, (_, i) => deckDocWithCover({
    title: `Mazo mixto ${i}`,
    coverImageThumb: i % 2 === 0 ? thumb : '',
  }));

  for (const [label, decks] of [['legacy', legacyDecks], ['mixed', mixedDecks]]) {
    const summaries = decks.map((deck) => deck.serializeLightSummary(100));
    const json = JSON.stringify(summaries);
    const jsonBytes = Buffer.byteLength(json, 'utf8');
    const stringifyMs = [];
    for (let run = 0; run < 9; run += 1) {
      const started = performance.now();
      JSON.stringify(summaries);
      stringifyMs.push(performance.now() - started);
    }
    stringifyMs.sort((a, b) => a - b);
    console.log(`[cut2 measure:${label}] json=${jsonBytes} bytes, gzip=${gzipSync(json).length} bytes, stringify mediana=${stringifyMs[Math.floor(stringifyMs.length / 2)].toFixed(1)}ms, conMinatura=${summaries.filter((d) => 'coverImageThumb' in d).length}/500, conPortadaCompleta=${summaries.filter((d) => 'coverImage' in d).length}/500`);
    assert.ok(summaries.every((deck) => !('cardBackgrounds' in deck)));
  }
});
