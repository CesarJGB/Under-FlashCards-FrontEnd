// FILE: backend/test/imageDeliveryFixtures.js
// Fixtures sintéticos y helpers de referencia del Corte 0 (contratos de
// entrega de imágenes). Exclusivo del árbol de pruebas: no es código
// productivo, no lo importa producción. Data URLs pequeñas y deterministas;
// sin fotografías reales, Base64 pesado, credenciales ni datos privados.
// Espejo de los helpers equivalentes en frontend/tests/image-delivery/.

function syntheticDataUrl(seed = 1, mime = 'image/jpeg', byteCount = 96) {
  const payload = Buffer.alloc(byteCount);
  for (let i = 0; i < byteCount; i += 1) payload[i] = (seed * 31 + i * 7 + 13) % 256;
  return `data:${mime};base64,${payload.toString('base64')}`;
}

const BG_SHARED = syntheticDataUrl(1); // fondo compartido por varias tarjetas
const BG_RED = syntheticDataUrl(2); // fondo distinto A
const BG_GREEN = syntheticDataUrl(3); // fondo distinto B
const BG_BLUE = syntheticDataUrl(4); // fondo distinto C
const CONTENT_IMAGE_A = syntheticDataUrl(10); // contenido por tarjeta (no deduplicado)
const CONTENT_IMAGE_B = syntheticDataUrl(11);

// Tarjeta JSON sintética con el shape del contrato objetivo (espejo de
// baseCard del harness image-delivery, reducido para pruebas de contrato).
function baseCard(seed, overrides = {}) {
  return {
    id: `card-${String(seed).padStart(4, '0')}`,
    userId: '000000000000000000000001',
    deckId: '000000000000000000000002',
    question: `Pregunta sintética ${seed}`,
    answer: `Respuesta sintética ${seed}`,
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
    ...overrides,
  };
}

// Tarjeta con bgImage expandido (shape legacy entregado por la API actual).
// Una tarjeta legacy contiene `bgImage` y NO contiene `bgImageIndex`. Sólo
// si el caller pasa `bgImageIndex` explícitamente se genera una tarjeta dual
// (para las pruebas de precedencia), nunca por herencia del fixture base.
function legacyCard(seed, overrides = {}) {
  const { bgImage, bgImageIndex, ...rest } = { ...overrides };
  const card = {
    ...baseCard(seed, rest),
    bgImage: bgImage ?? '',
  };
  delete card.bgImageIndex;
  if ('bgImageIndex' in overrides) card.bgImageIndex = bgImageIndex;
  return card;
}

// Referencia del contrato objetivo (Alternativa A): convierte tarjetas con
// bgImage expandido en `{ backgrounds, cards }` con bgImageIndex.
// Cada fondo único se registra una sola vez; los índices son estables según
// la primera aparición; -1 representa ausencia de fondo. No muta las tarjetas.
function buildIndexedCards(cards) {
  const backgrounds = [];
  const indexByUrl = new Map();
  const indexed = cards.map((card) => {
    const next = { ...card };
    delete next.bgImage;
    let bgImageIndex = -1;
    if (typeof card.bgImage === 'string' && card.bgImage) {
      if (!indexByUrl.has(card.bgImage)) {
        indexByUrl.set(card.bgImage, backgrounds.length);
        backgrounds.push(card.bgImage);
      }
      bgImageIndex = indexByUrl.get(card.bgImage);
    }
    next.bgImageIndex = bgImageIndex;
    return next;
  });
  return { backgrounds, cards: indexed };
}

// Resolver de referencia del cliente futuro. Precedencia (alineada con
// migration-rollout-rollback.md: durante el campo dual el cliente nuevo
// recibe `backgrounds` + `bgImageIndex` e ignora `bgImage`):
// - Si la tarjeta posee `bgImageIndex`, se trata como contrato indexado:
//   índice entero no negativo dentro del diccionario => `backgrounds[index]`;
//   `-1`, índice inválido, no entero o fuera de rango => cadena vacía, nunca
//   una excepción. `bgImage` no se usa como rescate para estas tarjetas.
// - `bgImage` se usa únicamente cuando la tarjeta NO tiene `bgImageIndex`.
// Espejo del resolver en frontend/tests/image-delivery/reference.js.
function resolveBackground(card, dictionary = []) {
  if (card == null || typeof card !== 'object') return '';
  if (Object.prototype.hasOwnProperty.call(card, 'bgImageIndex')) {
    const index = card.bgImageIndex;
    if (Number.isInteger(index) && index >= 0 && index < dictionary.length) {
      return dictionary[index];
    }
    return '';
  }
  if (typeof card.bgImage === 'string') return card.bgImage;
  return '';
}

module.exports = {
  syntheticDataUrl,
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
};
