// FILE: backend/test/imageBackgroundCompaction.test.js
// Fase 1F — Corte 4: pruebas deterministas del planificador puro
// backend/src/utils/imageBackgroundCompaction.js. Sin conexión a MongoDB,
// sin credenciales y sin red.

const test = require('node:test');
const assert = require('node:assert/strict');
const { planCardBackgroundCompaction } = require('../src/utils/imageBackgroundCompaction');

// Fixtures de fondo: cadenas sintéticas pequeñas (nunca Data URLs reales).
const BG_A = 'data:image/png;base64,AAAA';
const BG_B = 'data:image/png;base64,BBBB';
const BG_C = 'data:image/png;base64,CCCC';
const BG_D = 'data:image/png;base64,DDDD';
const BG_X = 'data:image/png;base64,XXXX';
const BG_Y = 'data:image/png;base64,YYYY';

function card(id, bgImageIndex, overrides = {}) {
  return { _id: id, bgImageIndex, contentImage: `content-${id}`, question: `q-${id}`, ...overrides };
}

// Fondo visual resuelto por una tarjeta (misma semántica que el contrato).
function resolve(card, backgrounds) {
  const index = card.bgImageIndex;
  if (!Number.isInteger(index) || index < 0 || index >= backgrounds.length) return '';
  return backgrounds[index];
}

// Aplica el plan a una copia: nuevo diccionario + bgImageIndex remapeados.
function applyPlan(cards, plan) {
  const byId = new Map(plan.cardUpdates.map((u) => [String(u.cardId), u.bgImageIndex]));
  return cards.map((c) => {
    if (c == null) return c;
    const index = byId.get(String(c._id));
    return index === undefined ? { ...c } : { ...c, bgImageIndex: index };
  });
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function zeroStats() {
  return {
    backgroundsBefore: 0,
    backgroundsAfter: 0,
    cardsExamined: 0,
    cardsUpdated: 0,
    orphansRemoved: 0,
    duplicatesRemoved: 0,
    invalidReferencesNormalized: 0,
    estimatedBytesRemoved: 0,
  };
}

// ---------------------------------------------------------------------------
// Casos básicos
// ---------------------------------------------------------------------------

test('plan: deck vacío (sin fondos ni tarjetas) no produce cambios', () => {
  const plan = planCardBackgroundCompaction([], []);
  assert.equal(plan.changed, false);
  assert.deepEqual(plan.cardBackgrounds, []);
  assert.deepEqual(plan.cardUpdates, []);
  assert.deepEqual(plan.stats, zeroStats());
});

test('plan: deck sin tarjetas elimina todos los fondos como huérfanos', () => {
  const plan = planCardBackgroundCompaction([BG_A, BG_B], []);
  assert.equal(plan.changed, true);
  assert.deepEqual(plan.cardBackgrounds, []);
  assert.deepEqual(plan.cardUpdates, []);
  assert.equal(plan.stats.backgroundsBefore, 2);
  assert.equal(plan.stats.backgroundsAfter, 0);
  assert.equal(plan.stats.orphansRemoved, 2);
  assert.equal(plan.stats.duplicatesRemoved, 0);
  assert.equal(
    plan.stats.estimatedBytesRemoved,
    Buffer.byteLength(BG_A, 'utf8') + Buffer.byteLength(BG_B, 'utf8')
  );
});

test('plan: conserva sólo fondos referenciados y elimina huérfanos con orden estable', () => {
  const cards = [card('c1', 0), card('c2', 2)];
  const plan = planCardBackgroundCompaction([BG_A, BG_B, BG_C], cards);
  assert.deepEqual(plan.cardBackgrounds, [BG_A, BG_C]);
  assert.equal(plan.stats.orphansRemoved, 1);
  assert.equal(plan.stats.backgroundsBefore, 3);
  assert.equal(plan.stats.backgroundsAfter, 2);
  assert.deepEqual(plan.cardUpdates, [{ cardId: 'c2', bgImageIndex: 1 }]);
});

test('plan: strings duplicados en índices distintos se remapean al mismo índice final', () => {
  const cards = [card('c1', 0), card('c2', 2), card('c3', 1)];
  const plan = planCardBackgroundCompaction([BG_A, BG_A, BG_B], cards);
  assert.deepEqual(plan.cardBackgrounds, [BG_A, BG_B]);
  assert.equal(plan.stats.duplicatesRemoved, 1);
  assert.equal(plan.stats.orphansRemoved, 0);
  assert.deepEqual(plan.cardUpdates, [
    { cardId: 'c2', bgImageIndex: 1 },
    { cardId: 'c3', bgImageIndex: 0 },
  ]);
});

// ---------------------------------------------------------------------------
// Referencias inválidas -> -1
// ---------------------------------------------------------------------------

test('plan: índice -1 ya normalizado no genera actualización ni recuento', () => {
  const plan = planCardBackgroundCompaction([BG_A], [card('c1', -1)]);
  assert.equal(plan.changed, true); // BG_A queda huérfano
  assert.equal(plan.stats.invalidReferencesNormalized, 0);
  assert.equal(plan.stats.cardsUpdated, 0);
  assert.deepEqual(plan.cardUpdates, []);
});

test('plan: índices negativos, decimales, strings, nulos y fuera de rango se normalizan a -1', () => {
  const cards = [
    card('c-neg', -2),
    card('c-dec', 0.5),
    card('c-str', '0'),
    card('c-null', null),
    card('c-undef', undefined),
    card('c-range', 99),
  ];
  const plan = planCardBackgroundCompaction([BG_A], cards);
  assert.equal(plan.stats.invalidReferencesNormalized, 6);
  assert.equal(plan.stats.cardsUpdated, 6);
  assert.equal(plan.cardUpdates.length, 6);
  assert.ok(plan.cardUpdates.every((update) => update.bgImageIndex === -1));
});

test('plan: entrada vacía referenciada se elimina y la referencia pasa a -1', () => {
  const plan = planCardBackgroundCompaction(['', BG_A], [card('c1', 0), card('c2', 1)]);
  assert.deepEqual(plan.cardBackgrounds, [BG_A]);
  assert.equal(plan.stats.orphansRemoved, 1);
  assert.equal(plan.stats.invalidReferencesNormalized, 1);
  assert.deepEqual(plan.cardUpdates, [
    { cardId: 'c1', bgImageIndex: -1 },
    { cardId: 'c2', bgImageIndex: 0 },
  ]);
});

test('plan: entradas no-string de cardBackgrounds se eliminan como huérfanas', () => {
  const plan = planCardBackgroundCompaction([BG_A, 123, null, {}, false], [card('c1', 0)]);
  assert.deepEqual(plan.cardBackgrounds, [BG_A]);
  assert.equal(plan.stats.orphansRemoved, 4);
  assert.equal(plan.stats.duplicatesRemoved, 0);
});

// ---------------------------------------------------------------------------
// Orden estable y deduplicación
// ---------------------------------------------------------------------------

test('plan: remapeo estable — la primera ocurrencia de cada string gana en el orden original', () => {
  const cards = [card('c-a', 0), card('c-b', 2), card('c-c', 4)];
  const plan = planCardBackgroundCompaction([BG_X, BG_A, BG_X, BG_B, BG_A], cards);
  // Conservadas (en orden original): índice 0 BG_X, índice 2 BG_X (colapsa),
  // índice 4 BG_A. Huérfanos: índices 1 (BG_A) y 3 (BG_B).
  assert.deepEqual(plan.cardBackgrounds, [BG_X, BG_A]);
  assert.equal(plan.stats.duplicatesRemoved, 1);
  assert.equal(plan.stats.orphansRemoved, 2);
  assert.deepEqual(plan.cardUpdates, [
    { cardId: 'c-b', bgImageIndex: 0 },
    { cardId: 'c-c', bgImageIndex: 1 },
  ]);
});

test('plan: una entrada no referenciada no colapsa como duplicado de otra referenciada', () => {
  // El índice 2 contiene BG_A pero ninguna tarjeta lo referencia: es huérfano,
  // no duplicado; el valor sobrevive vía el índice 0.
  const plan = planCardBackgroundCompaction([BG_A, BG_B, BG_A], [card('c1', 0), card('c2', 1)]);
  assert.deepEqual(plan.cardBackgrounds, [BG_A, BG_B]);
  assert.equal(plan.stats.orphansRemoved, 1);
  assert.equal(plan.stats.duplicatesRemoved, 0);
});

// ---------------------------------------------------------------------------
// Garantías del contrato
// ---------------------------------------------------------------------------

test('plan: preserva exactamente el fondo visual resuelto para toda referencia válida', () => {
  const cards = [card('c1', 0), card('c2', 1), card('c3', 2), card('c4', 5), card('c5', -1)];
  const backgrounds = [BG_A, BG_B, BG_A, BG_C, BG_D, BG_B];
  const plan = planCardBackgroundCompaction(backgrounds, cards);
  const nextCards = applyPlan(cards, plan);
  cards.forEach((original, index) => {
    assert.equal(
      resolve(original, backgrounds),
      resolve(nextCards[index], plan.cardBackgrounds),
      `fondo visual de ${original._id}`
    );
  });
});

test('plan: referencias inválidas se convierten a -1 y nunca apuntan a un fondo borrado', () => {
  const cards = [
    card('c0', 0),
    card('c1', 1),
    card('c2', 0.5),
    card('c3', 9),
    card('c4', -3),
    card('c5', null),
  ];
  const plan = planCardBackgroundCompaction([BG_A, BG_B], cards);
  assert.deepEqual(plan.cardBackgrounds, [BG_A, BG_B]);
  assert.equal(plan.stats.invalidReferencesNormalized, 4); // c2..c5 -> -1
  assert.equal(plan.stats.cardsUpdated, 4);
  assert.ok(plan.cardUpdates.every((update) => update.bgImageIndex === -1));
});

test('plan: ningún índice final queda roto tras remapear duplicados y normalizar inválidos', () => {
  const plan = planCardBackgroundCompaction([BG_A, BG_A, BG_B], [
    card('c1', 0),
    card('c2', 1),
    card('c3', 2),
    card('c4', 7),
  ]);
  for (const update of plan.cardUpdates) {
    assert.ok(
      update.bgImageIndex === -1 ||
        (update.bgImageIndex >= 0 && update.bgImageIndex < plan.cardBackgrounds.length),
      `índice final inválido: ${update.bgImageIndex}`
    );
    if (update.bgImageIndex >= 0) {
      assert.equal(typeof plan.cardBackgrounds[update.bgImageIndex], 'string');
    }
  }
});

test('plan: el plan nunca transporta contentImage ni contenido de las tarjetas', () => {
  const cards = [card('c1', 0, { contentImage: 'SECRET-CONTENT', question: 'SECRET-Q' })];
  const plan = planCardBackgroundCompaction([BG_A], cards);
  const serialized = JSON.stringify(plan);
  assert.equal(serialized.includes('contentImage'), false);
  assert.equal(serialized.includes('question'), false);
  assert.equal(serialized.includes('SECRET'), false);
});

// ---------------------------------------------------------------------------
// Inmutabilidad e idempotencia
// ---------------------------------------------------------------------------

test('plan: no muta los argumentos (fondos, tarjetas ni contentImage)', () => {
  const backgrounds = [BG_A, BG_B, BG_A, '', 42];
  const cards = [card('c1', 0), card('c2', 1), card('c3', 2), card('c4', 9)];
  const backgroundsSnapshot = JSON.parse(JSON.stringify(backgrounds));
  const cardsSnapshot = JSON.parse(JSON.stringify(cards));
  planCardBackgroundCompaction(backgrounds, cards);
  assert.deepEqual(backgrounds, backgroundsSnapshot);
  assert.deepEqual(cards, cardsSnapshot);
  assert.equal(cards[0].contentImage, 'content-c1');
  assert.equal(cards[0].question, 'q-c1');
});

test('plan: acepta argumentos congelados en profundidad sin lanzar', () => {
  const backgrounds = deepFreeze([BG_A, BG_B, BG_A]);
  const cards = deepFreeze([card('c1', 0), card('c3', 2)]);
  const plan = planCardBackgroundCompaction(backgrounds, cards);
  assert.deepEqual(plan.cardBackgrounds, [BG_A]);
  assert.equal(plan.stats.duplicatesRemoved, 1);
  assert.deepEqual(plan.cardUpdates, [{ cardId: 'c3', bgImageIndex: 0 }]);
});

test('plan: idempotencia — aplicar el plan y recalcular produce cero cambios', () => {
  const backgrounds = [BG_A, BG_B, BG_A, '', BG_C];
  const cards = [card('c1', 0), card('c2', 1), card('c3', 2), card('c4', 5), card('c5', null)];
  const first = planCardBackgroundCompaction(backgrounds, cards);
  const nextCards = applyPlan(cards, first);
  const second = planCardBackgroundCompaction(first.cardBackgrounds, nextCards);
  assert.equal(second.changed, false);
  assert.deepEqual(second.cardUpdates, []);
  assert.deepEqual(second.cardBackgrounds, first.cardBackgrounds);
});

test('plan: determinismo — dos invocaciones con la misma entrada producen planes idénticos', () => {
  const backgrounds = [BG_A, BG_B, BG_A, '', BG_C];
  const cards = [card('c1', 0), card('c2', 1), card('c3', 2), card('c4', 5), card('c5', null)];
  const first = planCardBackgroundCompaction(backgrounds, cards);
  const second = planCardBackgroundCompaction(backgrounds, cards);
  assert.deepEqual(first, second);
});

test('plan: estimación conservadora — cuenta sólo los bytes de strings eliminados', () => {
  const cards = [card('c1', 0), card('c2', 2)]; // índice 2 (BG_A) colapsa como duplicado
  const plan = planCardBackgroundCompaction([BG_A, BG_B, BG_A, 123], cards);
  assert.equal(plan.stats.orphansRemoved, 2); // BG_B y el 123 (no-string)
  assert.equal(plan.stats.duplicatesRemoved, 1);
  assert.equal(
    plan.stats.estimatedBytesRemoved,
    Buffer.byteLength(BG_B, 'utf8') + Buffer.byteLength(BG_A, 'utf8')
  );
});

// ---------------------------------------------------------------------------
// Entradas atípicas y validación
// ---------------------------------------------------------------------------

test('plan: argumentos no-array se tratan como vacíos sin lanzar', () => {
  const empty = planCardBackgroundCompaction(null, undefined);
  assert.equal(empty.changed, false);
  assert.deepEqual(empty.cardBackgrounds, []);
  assert.deepEqual(empty.stats, zeroStats());

  const noBackgrounds = planCardBackgroundCompaction('no-es-array', [card('c1', 0)]);
  assert.deepEqual(noBackgrounds.cardBackgrounds, []);
  assert.deepEqual(noBackgrounds.cardUpdates, [{ cardId: 'c1', bgImageIndex: -1 }]);
  assert.equal(noBackgrounds.stats.invalidReferencesNormalized, 1);
});

test('plan: tarjetas nulas se omiten sin error y sin actualización', () => {
  const plan = planCardBackgroundCompaction([BG_A], [null, card('c1', 0), undefined]);
  assert.deepEqual(plan.cardBackgrounds, [BG_A]);
  assert.deepEqual(plan.cardUpdates, []);
  assert.equal(plan.stats.cardsExamined, 1);
});

test('plan: tarjeta sin identificador provoca un error explícito (fail-fast)', () => {
  assert.throws(
    () => planCardBackgroundCompaction([BG_A], [{ bgImageIndex: 0 }]),
    /identificador \(id\/_id\)/
  );
});

test('plan: referencias válidas de tarjetas mezcladas con inválidas conservan el fondo', () => {
  const cards = [card('c1', 0), card('c2', 5), card('c3', null)];
  const plan = planCardBackgroundCompaction([BG_X, BG_Y], cards);
  assert.deepEqual(plan.cardBackgrounds, [BG_X]);
  assert.deepEqual(plan.cardUpdates, [
    { cardId: 'c2', bgImageIndex: -1 },
    { cardId: 'c3', bgImageIndex: -1 },
  ]);
  assert.equal(plan.stats.invalidReferencesNormalized, 2);
  assert.equal(plan.stats.orphansRemoved, 1); // BG_Y
});
