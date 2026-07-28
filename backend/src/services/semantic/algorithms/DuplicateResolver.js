// backend/src/services/semantic/algorithms/DuplicateResolver.js

/**
 * Resuelve duplicados semánticos mutando el estado del índice.
 * 
 * @param {Object} params
 * @param {import('../core/InMemoryVectorIndex').InMemoryVectorIndex} params.index
 * @param {Array<{id: string, qualityScore?: number}>} params.cards - Tarjetas con su ID temporal y score.
 * @param {number} [params.threshold=0.92] - Umbral de similitud para considerar duplicado.
 * @returns {Array<string>} IDs de las tarjetas supervivientes.
 */
function resolveDuplicates({ index, cards, threshold = 0.92 }) {
  const survivors = new Set(cards.map(c => c.id));

  for (const card of cards) {
    // Si la tarjeta ya fue eliminada por una iteración anterior, la saltamos
    if (!survivors.has(card.id)) continue;

    const neighbors = index.getNeighbors(card.id, threshold);
    
    for (const neighbor of neighbors) {
      // Si el vecino ya fue eliminado, continuar
      if (!survivors.has(neighbor.id)) continue;

      const neighborCard = cards.find(c => c.id === neighbor.id);
      if (!neighborCard) continue;

      const scoreA = card.qualityScore ?? 1.0;
      const scoreB = neighborCard.qualityScore ?? 1.0;

      // Lógica de desempate
      if (scoreA > scoreB) {
        // El vecino es peor, lo eliminamos
        survivors.delete(neighbor.id);
        index.remove(neighbor.id);
      } else if (scoreB > scoreA) {
        // La tarjeta actual es peor, la eliminamos y rompemos el loop interno
        survivors.delete(card.id);
        index.remove(card.id);
        break; // Salimos del loop de vecinos porque la tarjeta actual ya murió
      } else {
        // Empate exacto: Gana la primera aparición (card.id actual). Eliminamos al vecino.
        survivors.delete(neighbor.id);
        index.remove(neighbor.id);
      }
    }
  }

  return Array.from(survivors);
}

module.exports = { resolveDuplicates };
