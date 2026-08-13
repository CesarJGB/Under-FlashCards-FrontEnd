// FILE: frontend/tests/image-delivery/image-delivery-contracts.test.js
// Corte 0 — compatibilidad del futuro resolver cliente y contract tests del
// contrato objetivo ({ backgrounds, cards }) y del contrato heredado.
// Sólo pruebas, fixtures y helpers de referencia: nada de esto entra en
// producción ni modifica componentes productivos.
//
// Corte 1 — pruebas de la utilidad productiva frontend/src/lib/imageDelivery.js
// (resolución en fronteras de carga y sanitización de cardBackgrounds), con la
// referencia del Corte 0 conservada como oráculo comparativo.

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BG_SHARED,
  BG_RED,
  BG_GREEN,
  BG_BLUE,
  CONTENT_IMAGE_A,
  CONTENT_IMAGE_B,
  cardFixture,
  legacyCardFixture,
  legacyPayloadFixture,
} from './fixtures.js';
import {
  buildIndexedCards,
  resolveCardBackground,
  resolveBackgrounds,
} from './reference.js';
import {
  resolveCardBackground as resolveCardBackgroundProd,
  resolveCard,
  resolveCards,
  extractAndResolveCards,
  stripCardBackgrounds,
  sanitizeDeckSummaries,
} from '../../src/lib/imageDelivery.js';

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Escenario A — una tarjeta sin fondo
// ---------------------------------------------------------------------------

test('A: a card without background resolves to an empty string', () => {
  const card = cardFixture(1, { bgImageIndex: -1 });

  assert.equal(resolveCardBackground(card, []), '');
  assert.equal(resolveCardBackground(card, [BG_SHARED, BG_RED]), '', '-1 con diccionario poblado sigue sin fondo');
  assert.deepEqual(resolveBackgrounds([card], []), [{ ...card, bgImage: '' }]);
});

test('A: an empty dictionary resolves every card to an empty background', () => {
  const cards = [cardFixture(1, { bgImageIndex: -1 }), cardFixture(2, { bgImageIndex: -1 })];
  const resolved = resolveBackgrounds(cards, []);

  assert.ok(resolved.every((card) => card.bgImage === ''));
});

// ---------------------------------------------------------------------------
// Escenario B — varias tarjetas compartiendo el mismo fondo
// ---------------------------------------------------------------------------

test('B: a shared background is a single dictionary entry with no expanded copies in cards', () => {
  const legacy = [
    legacyCardFixture(1, { bgImage: BG_SHARED }),
    legacyCardFixture(2, { bgImage: BG_SHARED }),
    legacyCardFixture(3, { bgImage: BG_SHARED }),
  ];
  const { backgrounds, cards } = buildIndexedCards(legacy);

  assert.equal(backgrounds.length, 1);
  assert.equal(backgrounds[0], BG_SHARED);
  assert.ok(cards.every((card) => card.bgImageIndex === 0));
  assert.equal('bgImage' in cards[0], false, 'el contrato normalizado no repite copias expandidas');
  assert.equal(JSON.stringify({ backgrounds, cards }).split(BG_SHARED).length - 1, 1);
});

test('B: every card sharing a background resolves to that exact background', () => {
  const payload = {
    backgrounds: [BG_SHARED],
    cards: [cardFixture(1, { bgImageIndex: 0 }), cardFixture(2, { bgImageIndex: 0 }), cardFixture(3, { bgImageIndex: 0 })],
  };
  const resolved = resolveBackgrounds(payload.cards, payload.backgrounds);

  assert.ok(resolved.every((card) => card.bgImage === BG_SHARED));
});

// ---------------------------------------------------------------------------
// Escenario C — varias tarjetas con fondos diferentes
// ---------------------------------------------------------------------------

test('C: distinct backgrounds keep one entry per unique and first-appearance indices', () => {
  const legacy = [
    legacyCardFixture(1, { bgImage: BG_RED }),
    legacyCardFixture(2, { bgImage: BG_GREEN }),
    legacyCardFixture(3, { bgImage: BG_RED }),
    legacyCardFixture(4, { bgImage: BG_BLUE }),
  ];
  const { backgrounds, cards } = buildIndexedCards(legacy);

  assert.deepEqual(backgrounds, [BG_RED, BG_GREEN, BG_BLUE]);
  assert.deepEqual(cards.map((card) => card.bgImageIndex), [0, 1, 0, 2]);
});

test('C: each card resolves exactly to its own background', () => {
  const payload = {
    backgrounds: [BG_RED, BG_GREEN, BG_BLUE],
    cards: [
      cardFixture(1, { bgImageIndex: 0 }),
      cardFixture(2, { bgImageIndex: 1 }),
      cardFixture(3, { bgImageIndex: 0 }),
      cardFixture(4, { bgImageIndex: 2 }),
    ],
  };
  const resolved = resolveBackgrounds(payload.cards, payload.backgrounds);

  assert.deepEqual(resolved.map((card) => card.bgImage), [BG_RED, BG_GREEN, BG_RED, BG_BLUE]);
});

// ---------------------------------------------------------------------------
// Escenario D — contenido mixto
// ---------------------------------------------------------------------------

test('D: an invalid index produces an empty background, never an exception', () => {
  const payload = {
    backgrounds: [BG_RED, BG_GREEN],
    cards: [
      cardFixture(1, { bgImageIndex: 0 }),
      cardFixture(2, { bgImageIndex: -1 }),
      cardFixture(3, { bgImageIndex: 99 }),
      cardFixture(4, { bgImageIndex: -7 }),
      cardFixture(5, { bgImageIndex: 2 }),
    ],
  };
  const resolved = resolveBackgrounds(payload.cards, payload.backgrounds);

  assert.deepEqual(resolved.map((card) => card.bgImage), [BG_RED, '', '', '', '']);
});

test('D: contentImage stays per card and is never deduplicated', () => {
  const legacy = [
    legacyCardFixture(1, { bgImage: BG_SHARED, contentImage: CONTENT_IMAGE_A }),
    legacyCardFixture(2, { bgImage: BG_SHARED, contentImage: CONTENT_IMAGE_B }),
    legacyCardFixture(3, { contentImage: CONTENT_IMAGE_A }),
  ];
  const { backgrounds, cards } = buildIndexedCards(legacy);

  assert.deepEqual(backgrounds, [BG_SHARED]);
  assert.deepEqual(cards.map((card) => card.contentImage), [CONTENT_IMAGE_A, CONTENT_IMAGE_B, CONTENT_IMAGE_A]);
  assert.equal(backgrounds.includes(CONTENT_IMAGE_A), false, 'contentImage no entra al diccionario de fondos');
  assert.equal(backgrounds.includes(CONTENT_IMAGE_B), false);
});

// ---------------------------------------------------------------------------
// Escenario E — compatibilidad heredada
// ---------------------------------------------------------------------------

test('E: legacy cards with an expanded bgImage keep resolving untouched', () => {
  const legacy = legacyCardFixture(1, { bgImage: BG_RED });

  assert.equal(resolveCardBackground(legacy, []), BG_RED, 'fallback: bgImage se conserva aunque falte diccionario');
  assert.equal(resolveCardBackground(legacy, [BG_GREEN]), BG_RED, 'un índice no pisa un bgImage legacy');
});

test('E: the legacy contract keeps its current fields', () => {
  const payload = legacyPayloadFixture();

  assert.deepEqual(Object.keys(payload).sort(), [
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
  assert.equal('bgImageIndex' in payload, false);
  assert.equal(payload.bgImage, BG_SHARED);
});

test('E: the resolver does not mutate the received cards or dictionary', () => {
  const cards = [
    cardFixture(1, { bgImageIndex: 0, contentImage: CONTENT_IMAGE_A }),
    legacyCardFixture(2, { bgImage: BG_RED }),
  ];
  const backgrounds = [BG_SHARED, BG_RED];
  const cardsBefore = structuredClone(cards);
  const backgroundsBefore = structuredClone(backgrounds);

  const resolved = resolveBackgrounds(deepFreeze(cards), deepFreeze(backgrounds));

  assert.equal(resolved[0].bgImage, BG_SHARED);
  assert.equal(resolved[1].bgImage, BG_RED);
  assert.deepEqual(cards, cardsBefore, 'las tarjetas originales no cambian');
  assert.deepEqual(backgrounds, backgroundsBefore, 'el diccionario no cambia');
});

test('E: the resolver preserves all other card fields', () => {
  const payload = {
    backgrounds: [BG_SHARED],
    cards: [cardFixture(1, { bgImageIndex: 0, contentImage: CONTENT_IMAGE_B, imageSide: 'question' })],
  };
  const [resolved] = resolveBackgrounds(payload.cards, payload.backgrounds);
  const { bgImage: _bgImage, ...rest } = resolved;
  const { bgImage: _bgImageOriginal, ...expected } = payload.cards[0];

  assert.equal(resolved.bgImage, BG_SHARED);
  assert.deepEqual(rest, expected, 'todos los campos restantes se conservan idénticos');
});

// ---------------------------------------------------------------------------
// Precedencia dual (corrección puntual) — bgImageIndex manda cuando existe;
// bgImage es fallback exclusivo de tarjetas sin bgImageIndex.
// Alineado con migration-rollout-rollback.md (campo dual: el cliente nuevo
// usa backgrounds + bgImageIndex e ignora bgImage).
// ---------------------------------------------------------------------------

test('dual A: an indexed card with both fields resolves from backgrounds, not bgImage', () => {
  const dual = legacyCardFixture(1, { bgImageIndex: 0, bgImage: BG_BLUE });

  assert.equal('bgImageIndex' in dual, true);
  assert.equal(resolveCardBackground(dual, [BG_RED]), BG_RED, 'el índice manda sobre bgImage');
});

test('dual B: bgImageIndex -1 with a populated bgImage resolves to empty', () => {
  const dual = legacyCardFixture(1, { bgImageIndex: -1, bgImage: BG_BLUE });

  assert.equal(resolveCardBackground(dual, [BG_RED]), '', 'sin fondo indexado => "" aunque bgImage esté poblado');
});

test('dual C: an out-of-range index with a populated bgImage resolves to empty', () => {
  const dual = legacyCardFixture(1, { bgImageIndex: 99, bgImage: BG_BLUE });

  assert.equal(resolveCardBackground(dual, [BG_RED]), '', 'índice inválido => "" sin rescate de bgImage');
});

test('dual D: a truly legacy card without bgImageIndex resolves its bgImage', () => {
  const legacy = legacyCardFixture(1, { bgImage: BG_BLUE });

  assert.equal(resolveCardBackground(legacy, [BG_RED]), BG_BLUE, 'shape sin indexar usa bgImage como fallback');
});

test('dual E: the legacy fixture never carries bgImageIndex', () => {
  assert.equal('bgImageIndex' in legacyCardFixture(1, { bgImage: BG_SHARED }), false);
  assert.equal('bgImageIndex' in legacyCardFixture(2), false);
});

test('dual F: the resolver remains immutable with dual-shape cards', () => {
  const cards = [legacyCardFixture(1, { bgImageIndex: 0, bgImage: BG_BLUE })];
  const backgrounds = [BG_RED];
  const cardsBefore = structuredClone(cards);
  const backgroundsBefore = structuredClone(backgrounds);

  const resolved = resolveBackgrounds(deepFreeze(cards), deepFreeze(backgrounds));

  assert.equal(resolved[0].bgImage, BG_RED);
  assert.deepEqual(cards, cardsBefore, 'las tarjetas originales no cambian');
  assert.deepEqual(backgrounds, backgroundsBefore, 'el diccionario no cambia');
});

// ===========================================================================
// CORTE 1 — utilidad productiva frontend/src/lib/imageDelivery.js
// ===========================================================================

// ---------------------------------------------------------------------------
// Carga desde shapes productivos
// ---------------------------------------------------------------------------

test('cut1: extractAndResolveCards accepts the legacy array from a previous backend', () => {
  const legacyArray = [
    legacyCardFixture(1, { bgImage: BG_RED }),
    legacyCardFixture(2, { bgImage: BG_GREEN }),
    legacyCardFixture(3, { bgImage: '' }),
  ];
  const resolved = extractAndResolveCards(legacyArray);

  assert.deepEqual(resolved.map((card) => card.bgImage), [BG_RED, BG_GREEN, '']);
  assert.ok(resolved.every((card) => !('bgImageIndex' in card)));
});

test('cut1: extractAndResolveCards resolves an indexed detail payload', () => {
  const payload = {
    backgrounds: [BG_SHARED],
    cards: [cardFixture(1, { bgImageIndex: 0 }), cardFixture(2, { bgImageIndex: 0 })],
  };
  const resolved = extractAndResolveCards(payload);

  assert.ok(resolved.every((card) => card.bgImage === BG_SHARED));
  assert.ok(resolved.every((card) => card.bgImageIndex === 0), 'el resultado conserva bgImageIndex');
});

test('cut1: extractAndResolveCards resolves an indexed session payload', () => {
  const payload = {
    success: true,
    backgrounds: [BG_RED, BG_GREEN],
    cards: [cardFixture(1, { bgImageIndex: 0 }), cardFixture(2, { bgImageIndex: 1 }), cardFixture(3, { bgImageIndex: 0 })],
  };
  const resolved = extractAndResolveCards(payload);

  assert.deepEqual(resolved.map((card) => card.bgImage), [BG_RED, BG_GREEN, BG_RED]);
});

test('cut1: extractAndResolveCards accepts the legacy session envelope from a previous backend', () => {
  const payload = {
    success: true,
    cards: [legacyCardFixture(1, { bgImage: BG_BLUE }), legacyCardFixture(2, { bgImage: '' })],
  };
  const resolved = extractAndResolveCards(payload);

  assert.deepEqual(resolved.map((card) => card.bgImage), [BG_BLUE, '']);
});

test('cut1: extractAndResolveCards returns [] for null, malformed or non-card payloads', () => {
  assert.deepEqual(extractAndResolveCards(null), []);
  assert.deepEqual(extractAndResolveCards(undefined), []);
  assert.deepEqual(extractAndResolveCards({}), []);
  assert.deepEqual(extractAndResolveCards({ success: true }), []);
  assert.deepEqual(extractAndResolveCards('texto'), []);
});

// ---------------------------------------------------------------------------
// Precedencia dual con la utilidad productiva
// ---------------------------------------------------------------------------

test('cut1: a dual payload with distinct values resolves from bgImageIndex', () => {
  const dual = cardFixture(1, { bgImageIndex: 0, bgImage: BG_BLUE });
  const resolved = extractAndResolveCards({ backgrounds: [BG_RED], cards: [dual] });

  assert.equal(resolved[0].bgImage, BG_RED, 'gana bgImageIndex; bgImage coexistente se ignora');
});

test('cut1: an invalid index with a populated bgImage resolves to ""', () => {
  const cases = [
    cardFixture(1, { bgImageIndex: -1, bgImage: BG_BLUE }),
    cardFixture(2, { bgImageIndex: 99, bgImage: BG_BLUE }),
    cardFixture(3, { bgImageIndex: -7, bgImage: BG_BLUE }),
    cardFixture(4, { bgImageIndex: 2, bgImage: BG_BLUE }),
  ];
  const resolved = extractAndResolveCards({ backgrounds: [BG_RED, BG_GREEN], cards: cases });

  assert.deepEqual(resolved.map((card) => card.bgImage), ['', '', '', '']);
});

test('cut1: a truly legacy card without bgImageIndex uses its bgImage', () => {
  const legacy = legacyCardFixture(1, { bgImage: BG_RED });
  const resolved = resolveCard(legacy, [BG_GREEN]);

  assert.equal(resolved.bgImage, BG_RED, 'sin índice, bgImage es el fallback');
});

// ---------------------------------------------------------------------------
// Inmutabilidad y conservación de campos
// ---------------------------------------------------------------------------

test('cut1: the production resolver does not mutate cards, arrays or dictionaries', () => {
  const cards = [
    cardFixture(1, { bgImageIndex: 0, contentImage: CONTENT_IMAGE_A }),
    legacyCardFixture(2, { bgImage: BG_RED }),
    cardFixture(3, { bgImageIndex: 1 }),
  ];
  const backgrounds = [BG_SHARED, BG_GREEN];
  const cardsBefore = structuredClone(cards);
  const backgroundsBefore = structuredClone(backgrounds);

  const resolved = resolveCards(deepFreeze(cards), deepFreeze(backgrounds));

  assert.deepEqual(resolved.map((card) => card.bgImage), [BG_SHARED, BG_RED, BG_GREEN]);
  assert.deepEqual(cards, cardsBefore, 'las tarjetas originales no cambian');
  assert.deepEqual(backgrounds, backgroundsBefore, 'el diccionario no cambia');
});

test('cut1: the production resolver preserves every other card field', () => {
  const card = cardFixture(1, { bgImageIndex: 0, contentImage: CONTENT_IMAGE_B, imageSide: 'question' });
  const resolved = resolveCard(card, [BG_SHARED]);
  const { bgImage: _bgImage, ...rest } = resolved;
  const { bgImage: _none, ...expected } = card;

  assert.equal(resolved.bgImage, BG_SHARED);
  assert.deepEqual(rest, expected, 'todos los campos restantes se conservan idénticos');
});

test('cut1: null or malformed entries never throw', () => {
  const cards = [null, undefined, 42, 'tarjeta', cardFixture(1, { bgImageIndex: 0 })];
  const resolved = resolveCards(cards, [BG_SHARED]);

  assert.equal(resolved.length, 5);
  assert.equal(resolved[0], null);
  assert.equal(resolved[1], undefined);
  assert.equal(resolved[4].bgImage, BG_SHARED);
  assert.equal(resolveCardBackgroundProd(null, [BG_SHARED]), '');
  assert.equal(resolveCardBackgroundProd(42, [BG_SHARED]), '');
});

// ---------------------------------------------------------------------------
// Sanitización de cardBackgrounds (resumen de mazos)
// ---------------------------------------------------------------------------

function deckSummaryFixture(overrides = {}) {
  return {
    id: 'deck-0001',
    userId: '000000000000000000000001',
    title: 'Mazo sintético',
    coverColor: '#4f46e5',
    coverImage: BG_SHARED,
    cardCount: 10,
    cardBackgrounds: [BG_RED, BG_GREEN],
    isStarred: true,
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
    ...overrides,
  };
}

test('cut1: stripCardBackgrounds removes the field and keeps coverImage and metadata', () => {
  const deck = deckSummaryFixture();
  const summary = stripCardBackgrounds(deck);

  assert.equal('cardBackgrounds' in summary, false);
  assert.equal(summary.coverImage, BG_SHARED);
  assert.equal(summary.title, 'Mazo sintético');
  assert.equal(summary.cardCount, 10);
  assert.equal(summary.isStarred, true);
  assert.equal('cardBackgrounds' in deck, true, 'el mazo original no se muta');
});

test('cut1: sanitizeDeckSummaries sanitizes every deck before state/localStorage without mutating input', () => {
  const decks = [deckSummaryFixture(), deckSummaryFixture({ id: 'deck-0002' })];
  const decksBefore = structuredClone(decks);

  const sanitized = sanitizeDeckSummaries(deepFreeze(decks));

  assert.ok(sanitized.every((deck) => !('cardBackgrounds' in deck)));
  assert.ok(sanitized.every((deck) => deck.coverImage === BG_SHARED));
  assert.deepEqual(decks, decksBefore, 'el array y los mazos originales no cambian');
});

test('cut1: a deck without cardBackgrounds passes through unchanged', () => {
  const { cardBackgrounds: _removed, ...clean } = deckSummaryFixture();
  const sanitized = sanitizeDeckSummaries([clean]);

  assert.equal('cardBackgrounds' in sanitized[0], false);
  assert.equal(sanitized[0].coverImage, BG_SHARED);
  assert.equal(stripCardBackgrounds(null), null);
  assert.deepEqual(sanitizeDeckSummaries(null), null);
});

// ---------------------------------------------------------------------------
// Compatibilidad en ambas direcciones
// ---------------------------------------------------------------------------

test('cut1: new frontend + legacy response keeps working (compat backward)', () => {
  const legacyPayload = [legacyPayloadFixture(), legacyCardFixture(2, { bgImage: BG_RED })];
  const resolved = extractAndResolveCards(legacyPayload);

  assert.equal(resolved[0].bgImage, BG_SHARED);
  assert.equal(resolved[0].contentImage, CONTENT_IMAGE_A);
  assert.equal(resolved[1].bgImage, BG_RED);
});

test('cut1: new frontend + indexed response materializes bgImage for current consumers (compat forward)', () => {
  const payload = {
    backgrounds: [BG_SHARED, BG_RED],
    cards: [
      cardFixture(1, { bgImageIndex: 0, contentImage: CONTENT_IMAGE_A }),
      cardFixture(2, { bgImageIndex: 1 }),
      cardFixture(3, { bgImageIndex: -1 }),
    ],
  };
  const resolved = extractAndResolveCards(payload);

  assert.deepEqual(resolved.map((card) => card.bgImage), [BG_SHARED, BG_RED, '']);
  assert.deepEqual(resolved.map((card) => card.contentImage), [CONTENT_IMAGE_A, '', '']);
});

// ---------------------------------------------------------------------------
// Oráculo: la utilidad productiva coincide con la referencia del Corte 0
// ---------------------------------------------------------------------------

test('cut1: production resolver matches the frozen Corte 0 reference on the same fixtures', () => {
  const fixtures = [
    cardFixture(1, { bgImageIndex: -1 }),
    cardFixture(2, { bgImageIndex: 0 }),
    cardFixture(3, { bgImageIndex: 99 }),
    cardFixture(4, { bgImageIndex: 2 }),
    legacyCardFixture(5, { bgImage: BG_BLUE }),
    legacyCardFixture(6, { bgImageIndex: 0, bgImage: BG_RED }),
    null,
  ];
  const dictionary = [BG_SHARED, BG_GREEN];

  for (const fixture of fixtures) {
    assert.equal(
      resolveCardBackgroundProd(fixture, dictionary),
      resolveCardBackground(fixture, dictionary),
      'producción y referencia resuelven idéntico',
    );
  }

  const valid = fixtures.filter((card) => card != null);
  assert.deepEqual(
    resolveCards(valid, dictionary).map((card) => card.bgImage),
    resolveBackgrounds(valid, dictionary).map((card) => card.bgImage),
    'producción y referencia materializan el mismo array',
  );
});

test('cut1: production sanitization keeps the legacy deck list contract intact otherwise', () => {
  const deck = deckSummaryFixture();
  const sanitized = stripCardBackgrounds(deck);
  const { cardBackgrounds: _removed, ...expected } = deck;

  assert.deepEqual(sanitized, expected, 'el resumen es el contrato legacy menos cardBackgrounds');
});
