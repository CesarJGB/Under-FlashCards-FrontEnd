// backend/src/services/semantic/algorithms/DiversitySelector.js

/**
 * Selecciona N tarjetas usando Maximal Marginal Relevance (MMR).
 * O(N²) simple.
 * 
 * @param {Object} params
 * @param {import('../core/InMemoryVectorIndex').InMemoryVectorIndex} params.index
 * @param {Array<{id: string, qualityScore?: number}>} params.cards
 * @param {number} params.targetCount - Número exacto a seleccionar.
 * @param {number} [params.lambda=0.7] - Peso de diversidad. 
 *   Conceptualmente limitado entre 0 y 1. 
 *   0 = selecciona solo por calidad. 1 = selecciona solo por diversidad.
 * @returns {Array<string>} IDs de las tarjetas seleccionadas.
 */
function selectDiverse({ index, cards, targetCount, lambda = 0.7 }) {
  if (cards.length <= targetCount) {
    return cards.map(c => c.id);
  }

  const selected = [];
  const available = new Map(cards.map(c => [c.id, c]));

  // 1. Elegir la primera tarjeta: la de mayor qualityScore
  let bestFirstCard = null;
  let maxScore = -Infinity;
  
  for (const card of cards) {
    const score = card.qualityScore ?? 1.0;
    if (score > maxScore) {
      maxScore = score;
      bestFirstCard = card;
    }
  }

  if (!bestFirstCard) return [];

  selected.push(bestFirstCard.id);
  available.delete(bestFirstCard.id);

  // 2. Iterar hasta llegar a targetCount
  while (selected.length < targetCount && available.size > 0) {
    let bestCandidateId = null;
    let bestMmrScore = -Infinity;

    for (const [candidateId, candidate] of available.entries()) {
      let maxSimToSelected = 0;
      
      for (const selectedId of selected) {
        const sim = index.similarity(candidateId, selectedId);
        if (sim > maxSimToSelected) {
          maxSimToSelected = sim;
        }
      }

      const relevance = candidate.qualityScore ?? 1.0;
      const mmrScore = (relevance * (1 - lambda)) - (maxSimToSelected * lambda);

      if (mmrScore > bestMmrScore) {
        bestMmrScore = mmrScore;
        bestCandidateId = candidateId;
      }
    }

    if (bestCandidateId) {
      selected.push(bestCandidateId);
      available.delete(bestCandidateId);
    } else {
      break;
    }
  }

  return selected;
}

module.exports = { selectDiverse };
