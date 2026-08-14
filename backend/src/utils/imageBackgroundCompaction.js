// FILE: backend/src/utils/imageBackgroundCompaction.js
// Fase 1F — Corte 4: normalización segura de Deck.cardBackgrounds.
//
// Planificador PURO (sin base de datos, sin efectos, sin credenciales) que
// calcula cómo compactar el diccionario almacenado de fondos de un deck y
// remapear atómicamente los Flashcard.bgImageIndex afectados. No muta sus
// argumentos y es totalmente determinista: aplicar el plan y volver a
// calcularlo produce cero cambios (idempotencia).
//
// Reglas implementadas (contrato del Corte 4):
// - Se conservan únicamente las entradas de cardBackgrounds referenciadas
//   válidamente por alguna tarjeta (índice entero, no negativo, dentro de
//   rango y cuyo valor sea un string no vacío).
// - El orden final es estable: se respeta el orden original de
//   cardBackgrounds y, entre entradas con el mismo string, gana la primera.
// - La deduplicación usa exclusivamente igualdad exacta de string; si varios
//   índices almacenados contienen el mismo string, todos se remapean al mismo
//   índice final.
// - Un índice no entero, negativo, fuera de rango o que apunte a un valor
//   vacío/no-string se normaliza a -1 (sin excepción y sin usar bgImage como
//   rescate), replicando la semántica de storedBackgroundFor de
//   imageDelivery.js para el diccionario almacenado.
// - contentImage y cualquier otro campo de la tarjeta no se tocan: el plan
//   sólo transporta { cardId, bgImageIndex }.
// - Para toda referencia válida, el fondo visual resuelto antes y después es
//   exactamente el mismo string.
// - La estimación de bytes eliminados es conservadora: suma UTF-8 únicamente
//   de los strings que dejan de persistirse (huérfanos + duplicados colapsados;
//   las entradas no-string aportan 0), sin imprimir nunca los Data URLs.

// Una entrada almacenada es utilizable únicamente si es un string no vacío.
function isUsableBackgroundEntry(value) {
  return typeof value === 'string' && value.length > 0;
}

// Identificador de tarjeta: _id del documento o id del objeto plano. Falla
// rápido (fail-fast) si una tarjeta no puede identificarse, para que la
// migración nunca escriba a ciegas.
function cardIdOf(card, position) {
  const id = card && (card._id || card.id);
  if (id === undefined || id === null || id === '') {
    throw new Error(
      `Tarjeta en la posición ${position} no tiene identificador (id/_id); abortando el plan.`
    );
  }
  return id;
}

// Calcula el plan de compactación para un deck.
//
// @param {Array} storedBackgrounds — Deck.cardBackgrounds almacenado (se
//   trata como vacío si no es un array).
// @param {Array} cards — tarjetas del deck (documentos Flashcard o objetos
//   planos con id/_id y bgImageIndex). Las entradas nulas se omiten; las
//   tarjetas sin identificador lanzan un error.
// @returns {Object} plan determinista:
//   - changed: booleano — true si algo cambiaría al aplicar el plan.
//   - cardBackgrounds: nuevo diccionario (sólo entradas conservadas).
//   - cardUpdates: [{ cardId, bgImageIndex }] — únicamente tarjetas cuyo
//     índice cambiaría.
//   - stats: conteos antes/después y métricas del corte.
function planCardBackgroundCompaction(storedBackgrounds, cards) {
  const backgrounds = Array.isArray(storedBackgrounds) ? storedBackgrounds : [];
  const cardList = Array.isArray(cards) ? cards : [];

  // -------------------------------------------------------------------------
  // 1. Determina qué entradas almacenadas están referenciadas válidamente.
  // -------------------------------------------------------------------------
  const referenced = new Array(backgrounds.length).fill(false);
  // Por tarjeta: id + índice almacenado + fondo resuelto (null si inválido).
  const resolvedByCard = [];
  cardList.forEach((card, position) => {
    if (card == null || typeof card !== 'object') return; // se omite, sin tocar
    const cardId = cardIdOf(card, position);
    const storedIndex = card.bgImageIndex;
    const valid =
      Number.isInteger(storedIndex) &&
      storedIndex >= 0 &&
      storedIndex < backgrounds.length &&
      isUsableBackgroundEntry(backgrounds[storedIndex]);
    if (valid) {
      referenced[storedIndex] = true;
      resolvedByCard.push({ cardId, storedIndex, value: backgrounds[storedIndex] });
    } else {
      resolvedByCard.push({ cardId, storedIndex, value: null });
    }
  });

  // -------------------------------------------------------------------------
  // 2. Construye el nuevo diccionario en orden original; primera aparición
  //    de cada string gana (deduplicación por igualdad exacta).
  // -------------------------------------------------------------------------
  const keptEntry = new Array(backgrounds.length).fill(false);
  // Entradas que sobreviven literalmente en el diccionario final: huérfanos y
  // duplicados colapsados dejan de persistirse y aportan a la estimación.
  const inFinalDictionary = new Array(backgrounds.length).fill(false);
  const newBackgrounds = [];
  const newIndexByValue = new Map();
  let duplicatesRemoved = 0;
  backgrounds.forEach((entry, index) => {
    if (!referenced[index]) return;
    keptEntry[index] = true;
    if (newIndexByValue.has(entry)) {
      duplicatesRemoved += 1; // entrada conservada que colapsa en la primera
      return;
    }
    newIndexByValue.set(entry, newBackgrounds.length);
    newBackgrounds.push(entry);
    inFinalDictionary[index] = true;
  });

  // -------------------------------------------------------------------------
  // 3. Remapea las tarjetas: sólo las que cambiarían entran al plan.
  // -------------------------------------------------------------------------
  const cardUpdates = [];
  let invalidReferencesNormalized = 0;
  for (const { cardId, storedIndex, value } of resolvedByCard) {
    let newIndex = -1;
    if (value !== null) newIndex = newIndexByValue.get(value);
    if (newIndex === storedIndex) continue; // sin cambio
    if (newIndex === -1) invalidReferencesNormalized += 1; // inválida -> -1
    cardUpdates.push({ cardId, bgImageIndex: newIndex });
  }

  // -------------------------------------------------------------------------
  // 4. Estadísticas antes/después y estimación conservadora de bytes.
  // -------------------------------------------------------------------------
  const keptCount = keptEntry.reduce((sum, kept) => sum + (kept ? 1 : 0), 0);
  const orphansRemoved = backgrounds.length - keptCount;
  const estimatedBytesRemoved = backgrounds.reduce((sum, entry, index) => {
    if (inFinalDictionary[index]) return sum;
    return sum + (typeof entry === 'string' ? Buffer.byteLength(entry, 'utf8') : 0);
  }, 0);

  const stats = {
    backgroundsBefore: backgrounds.length,
    backgroundsAfter: newBackgrounds.length,
    cardsExamined: resolvedByCard.length,
    cardsUpdated: cardUpdates.length,
    orphansRemoved,
    duplicatesRemoved,
    invalidReferencesNormalized,
    estimatedBytesRemoved,
  };

  return {
    changed: stats.backgroundsAfter !== stats.backgroundsBefore || cardUpdates.length > 0,
    cardBackgrounds: newBackgrounds,
    cardUpdates,
    stats,
  };
}

module.exports = {
  planCardBackgroundCompaction,
};
