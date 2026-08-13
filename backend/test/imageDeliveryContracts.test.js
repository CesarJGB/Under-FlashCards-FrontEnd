// FILE: backend/test/imageDeliveryContracts.test.js
// Corte 0 — contratos y pruebas de caracterización de entrega de imágenes.
// Congela el contrato heredado (Flashcard.serialize con bgImage expandido y
// resolución desde cardBackgrounds + bgImageIndex) y el contrato objetivo
// ({ backgrounds, cards } con bgImageIndex). Sólo pruebas y fixtures:
// no hay código productivo ni cambios de endpoint.

const test = require('node:test');
const assert = require('node:assert/strict');
const Flashcard = require('../src/models/Flashcard');
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
