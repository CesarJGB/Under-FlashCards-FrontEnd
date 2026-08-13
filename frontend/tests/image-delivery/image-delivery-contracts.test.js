// FILE: frontend/tests/image-delivery/image-delivery-contracts.test.js
// Corte 0 — compatibilidad del futuro resolver cliente y contract tests del
// contrato objetivo ({ backgrounds, cards }) y del contrato heredado.
// Sólo pruebas, fixtures y helpers de referencia: nada de esto entra en
// producción ni modifica componentes productivos.

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
