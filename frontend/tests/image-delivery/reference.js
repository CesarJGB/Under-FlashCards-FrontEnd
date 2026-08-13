// FILE: frontend/tests/image-delivery/reference.js
// Helpers de referencia del Corte 0 (contratos de entrega de imágenes).
// Exclusivos del árbol de pruebas: no los importa producción. Congelan el
// comportamiento esperado del futuro resolver cliente y del normalizador
// del contrato objetivo para que el Corte 1 se pruebe contra ellos.
// Espejo de backend/test/imageDeliveryFixtures.js (buildIndexedCards y
// resolveBackground).

// Referencia del contrato objetivo (Alternativa A): convierte tarjetas con
// bgImage expandido en `{ backgrounds, cards }` con bgImageIndex.
// Cada fondo único se registra una sola vez; los índices son estables según
// la primera aparición; -1 representa ausencia de fondo. No muta las tarjetas.
export function buildIndexedCards(cards) {
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

// Fondo resuelto de una sola tarjeta contra el diccionario.
// Precedencia (alineada con migration-rollout-rollback.md: durante el campo
// dual el cliente nuevo recibe `backgrounds` + `bgImageIndex` e ignora
// `bgImage`):
// - Si la tarjeta posee `bgImageIndex`, se trata como contrato indexado:
//   índice entero no negativo dentro del diccionario => `backgrounds[index]`;
//   `-1`, índice inválido, no entero o fuera de rango => cadena vacía, nunca
//   una excepción. `bgImage` no se usa como rescate para estas tarjetas.
// - `bgImage` se usa únicamente cuando la tarjeta NO tiene `bgImageIndex`
//   (shape verdaderamente legacy sin indexar).
export function resolveCardBackground(card, dictionary = []) {
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

// Resuelve todas las tarjetas devolviendo copias con `bgImage` materializado.
// No muta las tarjetas ni el diccionario recibidos; conserva todos los demás
// campos de la tarjeta (contenido, formato, telemetría e identificadores).
export function resolveBackgrounds(cards, dictionary = []) {
  const safe = Array.isArray(dictionary) ? dictionary : [];
  return cards.map((card) => (
    typeof card === 'object' && card !== null
      ? { ...card, bgImage: resolveCardBackground(card, safe) }
      : card
  ));
}
