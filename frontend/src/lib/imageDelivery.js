// FILE: frontend/src/lib/imageDelivery.js
// Corte 1 — resolución productiva del contrato indexado de entrega de
// imágenes. Se usa una sola vez en las fronteras de carga (inmediatamente
// después de response.json()), para que grid, editor, repaso, sesiones y PDF
// sigan recibiendo tarjetas con `bgImage` materializado.
//
// Precedencia obligatoria (alineada con migration-rollout-rollback.md):
// - Si la tarjeta posee la propiedad bgImageIndex, es indexada:
//   índice entero no negativo dentro del diccionario => backgrounds[index];
//   -1, inválido, no entero o fuera de rango => ''.
//   bgImage coexistente se ignora (sin rescate).
// - Si no posee bgImageIndex, se usa bgImage como fallback legacy.
//
// Ninguna función muta tarjetas, arrays ni diccionarios. Las entradas nulas o
// malformadas no provocan excepciones incontroladas. El resultado materializado
// conserva bgImageIndex y añade bgImage para los consumidores actuales.

// Fondo resuelto de una sola tarjeta contra el diccionario.
export function resolveCardBackground(card, backgrounds = []) {
  if (card == null || typeof card !== 'object') return '';
  const dictionary = Array.isArray(backgrounds) ? backgrounds : [];
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

// Copia de una tarjeta con bgImage materializado; conserva todos los demás
// campos (incluido bgImageIndex). No muta la tarjeta recibida.
export function resolveCard(card, backgrounds = []) {
  if (card == null || typeof card !== 'object') return card;
  return { ...card, bgImage: resolveCardBackground(card, backgrounds) };
}

// Resuelve un array de tarjetas contra un diccionario. No muta entradas.
export function resolveCards(cards, backgrounds = []) {
  if (!Array.isArray(cards)) return [];
  const dictionary = Array.isArray(backgrounds) ? backgrounds : [];
  return cards.map((card) => resolveCard(card, dictionary));
}

// Extrae y resuelve tarjetas desde cualquier shape de carga productivo:
//   * array legacy (backend anterior): [{ bgImage, ... }]
//   * payload de detalle indexado: { backgrounds, cards }
//   * payload de sesión indexado: { success, backgrounds, cards }
//   * payload de sesión legacy: { success, cards }
// Devuelve siempre un array de tarjetas con bgImage materializado.
export function extractAndResolveCards(payload) {
  if (Array.isArray(payload)) return resolveCards(payload, []);
  if (payload == null || typeof payload !== 'object') return [];
  if (Array.isArray(payload.cards)) {
    return resolveCards(payload.cards, payload.backgrounds);
  }
  return [];
}

// Copia de un mazo sin cardBackgrounds (el campo no tiene consumidores y el
// caché antiguo puede conservarlo). No muta el mazo recibido.
export function stripCardBackgrounds(deck) {
  if (deck == null || typeof deck !== 'object') return deck;
  if (!Object.prototype.hasOwnProperty.call(deck, 'cardBackgrounds')) return deck;
  const summary = { ...deck };
  delete summary.cardBackgrounds;
  return summary;
}

// Sanitiza una lista de mazos antes de guardarla en estado o safeLocalStorage.
// No muta el array ni los mazos recibidos; conserva coverImage y metadatos.
export function sanitizeDeckSummaries(decks) {
  if (!Array.isArray(decks)) return decks;
  return decks.map((deck) => stripCardBackgrounds(deck));
}

// ---------------------------------------------------------------------------
// Corte 2 — contrato ligero de lista de mazos (coverImageThumb opcional)
// ---------------------------------------------------------------------------

// Portada resuelta de un resumen de mazo (legacy, Corte 1 o Corte 2):
//   coverImageThumb válida  => miniatura (Corte 2);
//   si no, coverImage        => portada completa como fallback (legacy/Corte 1
//                               y mazos antiguos sin miniatura);
//   si ninguna              => '' (DeckCard aplica el color de fallback).
// Nunca muta el mazo recibido.
export function resolveDeckCover(deck) {
  if (deck == null || typeof deck !== 'object') return '';
  if (typeof deck.coverImageThumb === 'string' && deck.coverImageThumb) return deck.coverImageThumb;
  if (typeof deck.coverImage === 'string' && deck.coverImage) return deck.coverImage;
  return '';
}

// Campos de imagen del payload de creación/edición de mazo (protección del
// flujo de edición):
//   edición sin tocar la portada  => {} (el backend conserva lo almacenado;
//                                    la miniatura NUNCA sustituye a la portada
//                                    completa en escrituras);
//   portada nueva seleccionada    => { coverImage: full, coverImageThumb: thumb };
//   eliminación explícita         => { coverImage: '', coverImageThumb: '' };
//   creación                      => ambos valores disponibles.
export function buildDeckCoverPayload({ isEditing = false, coverChanged = false, coverImage = '', coverThumb = '' } = {}) {
  if (isEditing && !coverChanged) return {};
  return { coverImage: coverImage ?? '', coverImageThumb: coverThumb ?? '' };
}
