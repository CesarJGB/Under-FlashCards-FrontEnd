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
// - Tarjeta legacy con `bgImage` expandido: se conserva tal cual (fallback).
// - Tarjeta indexada: `backgrounds[index]`; índice inválido o ausente =>
//   cadena vacía, nunca una excepción.
export function resolveCardBackground(card, dictionary = []) {
  if (card == null || typeof card !== 'object') return '';
  if (typeof card.bgImage === 'string') return card.bgImage;
  const index = card.bgImageIndex;
  if (Number.isInteger(index) && index >= 0 && index < dictionary.length) {
    return dictionary[index];
  }
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
