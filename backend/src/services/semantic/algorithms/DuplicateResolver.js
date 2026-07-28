// backend/src/services/semantic/algorithms/DuplicateResolver.js

/**
 * Resuelve duplicados semánticos mutando el estado del índice.
 * 
 * @param {Object} params
 * @param {import('../core/InMemoryVectorIndex').InMemoryVectorIndex} params.index
 * @param {Array<{id: string, qualityScore?: number}>} params.cards - Tarjetas ordenadas por aparición.
 * @param {number} [params.threshold=0.92]
 * @param {(event:{
 *   survivorId: string,
 *   removedId: string,
 *   similarity: number,
 *   survivorScore: number,
 *   removedScore: number
 * })=>void} [params.onDuplicateDetected] - Callback de observabilidad. No afecta el flujo.
 * @returns {Array<string>} IDs de las tarjetas supervivientes.
 */
function resolveDuplicates({ index, cards, threshold = 0.92, onDuplicateDetected }) {
  const survivors = new Set(cards.map(c => c.id));
  const cardMap = new Map(cards.map(card => [card.id, card]));

  for (const card of cards) {
    if (!survivors.has(card.id)) continue;

    const neighbors = index.getNeighbors(card.id, threshold);
    
    for (const neighbor of neighbors) {
      if (!survivors.has(neighbor.id)) continue;

      const neighborCard = cardMap.get(neighbor.id);
      if (!neighborCard) continue;

      const scoreA = card.qualityScore ?? 1.0;
      const scoreB = neighborCard.qualityScore ?? 1.0;

      if (scoreA > scoreB) {
        survivors.delete(neighbor.id);
        index.remove(neighbor.id);
        onDuplicateDetected?.({
          survivorId: card.id,
          removedId: neighbor.id,
          similarity: neighbor.similarity,
          survivorScore: scoreA,
          removedScore: scoreB
        });
      } else if (scoreB > scoreA) {
        survivors.delete(card.id);
        index.remove(card.id);
        onDuplicateDetected?.({
          survivorId: neighbor.id,
          removedId: card.id,
          similarity: neighbor.similarity,
          survivorScore: scoreB,
          removedScore: scoreA
        });
        break; // La tarjeta actual murió, pasamos a la siguiente
      } else {
        // Empate exacto: Gana la primera aparición (card.id)
        survivors.delete(neighbor.id);
        index.remove(neighbor.id);
        onDuplicateDetected?.({
          survivorId: card.id,
          removedId: neighbor.id,
          similarity: neighbor.similarity,
          survivorScore: scoreA,
          removedScore: scoreB
        });
      }
    }
  }

  return Array.from(survivors);
}

module.exports = { resolveDuplicates };
