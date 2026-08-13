// FILE: frontend/tests/image-delivery/fixtures.js
// Fixtures sintéticos del Corte 0 (contratos de entrega de imágenes).
// Exclusivo del árbol de pruebas: no lo importa producción. Data URLs
// pequeñas y deterministas; sin fotografías reales, Base64 pesado,
// credenciales ni datos privados. Espejo de backend/test/imageDeliveryFixtures.js.

export function syntheticDataUrl(seed = 1, mime = 'image/jpeg', byteCount = 96) {
  const payload = Buffer.alloc(byteCount);
  for (let i = 0; i < byteCount; i += 1) payload[i] = (seed * 31 + i * 7 + 13) % 256;
  return `data:${mime};base64,${payload.toString('base64')}`;
}

export const BG_SHARED = syntheticDataUrl(1); // fondo compartido por varias tarjetas
export const BG_RED = syntheticDataUrl(2); // fondo distinto A
export const BG_GREEN = syntheticDataUrl(3); // fondo distinto B
export const BG_BLUE = syntheticDataUrl(4); // fondo distinto C
export const CONTENT_IMAGE_A = syntheticDataUrl(10); // contenido por tarjeta (no deduplicado)
export const CONTENT_IMAGE_B = syntheticDataUrl(11);

// Tarjeta JSON sintética con el shape del contrato objetivo.
export function cardFixture(seed, overrides = {}) {
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
export function legacyCardFixture(seed, overrides = {}) {
  const { bgImage, bgImageIndex, ...rest } = { ...overrides };
  const card = {
    ...cardFixture(seed, rest),
    bgImage: bgImage ?? '',
  };
  delete card.bgImageIndex;
  if ('bgImageIndex' in overrides) card.bgImageIndex = bgImageIndex;
  return card;
}

// Payload legacy sintético: shape exacto que devuelve Flashcard.serialize()
// en la API actual (campos congelados en el Corte 0).
export function legacyPayloadFixture(overrides = {}) {
  return {
    id: 'card-0001',
    userId: '000000000000000000000001',
    deckId: '000000000000000000000002',
    question: 'Pregunta legacy',
    answer: 'Respuesta legacy',
    easeFactor: 2.5,
    bgImage: BG_SHARED,
    textAlign: 'center',
    fontSize: 'text-base',
    contentImage: CONTENT_IMAGE_A,
    imageSide: 'answer',
    difficulty: 0.3,
    totalReviews: 0,
    consecutiveErrors: 0,
    lastReviewedAt: null,
    createdAt: '2026-08-12T00:00:00.000Z',
    ...overrides,
  };
}
