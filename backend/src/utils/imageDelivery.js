// FILE: backend/src/utils/imageDelivery.js
// Corte 1 — normalización de entrega de imágenes (contrato indexado).
// Única fuente productiva de verdad para construir el contrato
// { backgrounds, cards } con bgImageIndex. Utilizada exclusivamente por los
// controladores cuando la petición negocia `?contract=indexed`; el contrato
// legacy (bgImage expandido) sigue viviendo en Flashcard.serialize() y
// Deck.serialize(), que no se modifican.
//
// Reglas del normalizador:
// - backgrounds incluye únicamente cadenas realmente referenciadas por las
//   tarjetas devueltas, deduplicadas por valor exacto.
// - El orden es estable: primera aparición de cada fondo en el orden final
//   de las tarjetas.
// - Cada bgImageIndex almacenado se remapea al índice del diccionario de
//   respuesta; dos índices almacenados que apunten a cadenas idénticas
//   terminan apuntando a una sola entrada.
// - Índice -1, no entero, fuera de rango o cadena inválida => bgImageIndex -1,
//   sin excepción y sin usar bgImage como rescate.
// - contentImage permanece idéntico dentro de cada tarjeta (no se deduplica).
// - Nunca se construye primero una tarjeta con bgImage expandido para después
//   eliminarlo: la rama indexada no invoca Flashcard.serialize().

// Verdad única de la negociación: el contrato indexado se reconoce única y
// exclusivamente con el valor exacto `indexed` del query parameter `contract`.
// Cualquier ausencia u otro valor conserva el contrato legacy.
function isIndexedContractRequest(req) {
  return Boolean(req && req.query && req.query.contract === 'indexed');
}

// Devuelve la cadena de fondo almacenada referenciada por la tarjeta, o ''
// si el índice es -1, no entero, fuera de rango o la entrada no es cadena.
function storedBackgroundFor(card, storedBackgrounds) {
  if (card == null || typeof card !== 'object') return '';
  const index = card.bgImageIndex;
  if (!Number.isInteger(index) || index < 0) return '';
  const backgrounds = Array.isArray(storedBackgrounds) ? storedBackgrounds : [];
  const value = backgrounds[index];
  return typeof value === 'string' ? value : '';
}

// Serializa una tarjeta en el contrato indexado (bgImageIndex, sin bgImage).
// La vía productiva es Flashcard.serializeIndexed(); el fallback sólo cubre
// entradas no-documento para que la utilidad sea total y nunca lance.
function serializeIndexedCard(card, bgImageIndex) {
  if (card && typeof card.serializeIndexed === 'function') {
    return card.serializeIndexed(bgImageIndex);
  }
  if (card == null || typeof card !== 'object') return null;
  const { bgImage, ...rest } = card;
  return { ...rest, bgImageIndex };
}

// Construye el payload indexado de detalle: { backgrounds, cards }.
// Recibe las tarjetas (documentos Flashcard) y el diccionario almacenado
// deck.cardBackgrounds. No muta entradas. No expande bgImage.
function buildIndexedCardPayload(cards, storedBackgrounds = []) {
  const backgrounds = [];
  const indexByValue = new Map();
  const cardList = (Array.isArray(cards) ? cards : []).map((card) => {
    const storedValue = storedBackgroundFor(card, storedBackgrounds);
    let bgImageIndex = -1;
    if (storedValue) {
      if (!indexByValue.has(storedValue)) {
        indexByValue.set(storedValue, backgrounds.length);
        backgrounds.push(storedValue);
      }
      bgImageIndex = indexByValue.get(storedValue);
    }
    return serializeIndexedCard(card, bgImageIndex);
  });
  return { backgrounds, cards: cardList };
}

// Construye el envelope indexado de sesión:
// { success: true, backgrounds, cards }. Mismo normalizador que el detalle.
function buildIndexedSessionPayload(cards, storedBackgrounds = []) {
  const indexed = buildIndexedCardPayload(cards, storedBackgrounds);
  return { success: true, backgrounds: indexed.backgrounds, cards: indexed.cards };
}

module.exports = {
  isIndexedContractRequest,
  buildIndexedCardPayload,
  buildIndexedSessionPayload,
};
