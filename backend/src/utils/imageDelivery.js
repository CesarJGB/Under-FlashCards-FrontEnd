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

// ---------------------------------------------------------------------------
// Corte 2 — contrato ligero de lista de mazos (coverImageThumb opcional)
// ---------------------------------------------------------------------------

// Límite de caracteres de una miniatura de portada aceptada en escritura.
// El presupuesto de generación es ~24 KiB de Data URL; se acepta hasta
// 64 KiB (65536 caracteres) para tolerar el esfuerzo final del cliente sin
// admitir cadenas excesivas. Superarlo normaliza a '' (sin miniatura).
const COVER_THUMB_MAX_LENGTH = 64 * 1024;

// Miniaturas válidas: Data URL de imagen raster (png/jpeg/webp), con payload.
function isValidCoverThumb(value) {
  return (
    typeof value === 'string' &&
    value.length > 26 &&
    value.length <= COVER_THUMB_MAX_LENGTH &&
    /^data:image\/(png|jpe?g|webp);base64,/.test(value)
  );
}

// Normaliza una miniatura entrante: cadena válida intacta; cualquier otra
// cosa => '' (sin miniatura). Los clientes que no envían el campo no se ven
// afectados: el valor por defecto del modelo sigue siendo ''.
function sanitizeCoverThumb(value) {
  return isValidCoverThumb(value) ? value : '';
}

// Contrato de lista de mazos resuelto a partir de la petición:
//   'legacy'     — sin contract=indexed (o con otro valor): contrato congelado.
//   'indexed'    — contract=indexed exacto: resumen del Corte 1 (sin
//                  cardBackgrounds, coverImage completa). Cualquier valor de
//                  cover distinto de 'thumbnail' conserva este contrato.
//   'thumbnail'  — contract=indexed&cover=thumbnail: contrato del Corte 2
//                  (coverImageThumb si existe, coverImage como fallback,
//                  nunca cardBackgrounds).
function resolveDeckListContract(req) {
  if (!isIndexedContractRequest(req)) return 'legacy';
  return req.query.cover === 'thumbnail' ? 'thumbnail' : 'indexed';
}

// Campos de imagen a escribir en creación/actualización parcial de mazo.
// Sólo se incluye cada campo si el body lo envía como cadena; la miniatura se
// normaliza (inválida o excesiva => ''). Un body sin campos de imagen devuelve
// {} y, por tanto, no modifica nada almacenado (título/color/estrella/jerarquía
// únicamente). La eliminación explícita de portada envía ambas cadenas vacías
// y aquí se conservan como '' para limpiar ambos campos.
function buildDeckImageFields(body) {
  const fields = {};
  if (body && typeof body.coverImage === 'string') fields.coverImage = body.coverImage;
  if (body && typeof body.coverImageThumb === 'string') {
    fields.coverImageThumb = sanitizeCoverThumb(body.coverImageThumb);
  }
  return fields;
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
  resolveDeckListContract,
  isValidCoverThumb,
  sanitizeCoverThumb,
  buildDeckImageFields,
  buildIndexedCardPayload,
  buildIndexedSessionPayload,
};
