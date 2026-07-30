// backend/src/services/semantic/algorithms/DiversitySelector.v1.js

/**
 * Selecciona N tarjetas usando Maximal Marginal Relevance (MMR).
 *
 * La máxima similitud de cada candidata contra las tarjetas ya seleccionadas
 * se conserva de forma incremental. La primera ronda se inicializa calculando
 * explícitamente la similitud contra la primera tarjeta elegida.
 *
 * @param {Object} params
 * @param {import('../core/InMemoryVectorIndex').InMemoryVectorIndex} params.index
 * @param {Array<{id: string, qualityScore?: number}>} params.cards
 * @param {number} params.targetCount - Número exacto a seleccionar.
 * @param {number} [params.lambda=0.7] - Peso de diversidad (0 a 1).
 * @returns {Array<string>} IDs de las tarjetas seleccionadas.
 */
function selectDiverse({ index, cards, targetCount, lambda = 0.7 }) {
  if (!Number.isInteger(targetCount) || targetCount < 0) {
    throw new Error("targetCount debe ser un entero positivo.");
  }

  if (!Number.isFinite(lambda) || lambda < 0 || lambda > 1) {
    throw new Error("lambda debe ser un número entre 0 y 1.");
  }

  if (cards.length <= targetCount) {
    return cards.map(c => c.id);
  }

  const selected = [];
  const available = new Map(cards.map(c => [c.id, c]));
  const maxSims = new Map();

  // 1. Elegir la primera tarjeta: la de mayor qualityScore.
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

  // Conserva el comportamiento histórico de targetCount = 0:
  // se devuelve la primera tarjeta, aunque el objetivo sea cero.
  if (selected.length < targetCount) {
    for (const [candidateId] of available.entries()) {
      maxSims.set(
        candidateId,
        index.similarity(candidateId, bestFirstCard.id)
      );
    }
  }

  // 2. Iterar hasta llegar a targetCount.
  while (selected.length < targetCount && available.size > 0) {
    let bestCandidateId = null;
    let bestMmrScore = -Infinity;

    for (const [candidateId, candidate] of available.entries()) {
      const maxSimToSelected = maxSims.get(candidateId) ?? 0;
      const relevance = candidate.qualityScore ?? 1.0;
      const mmrScore = (relevance * (1 - lambda)) - (maxSimToSelected * lambda);

      // Comparación estricta: conserva el desempate por primera aparición.
      if (mmrScore > bestMmrScore) {
        bestMmrScore = mmrScore;
        bestCandidateId = candidateId;
      }
    }

    if (bestCandidateId) {
      selected.push(bestCandidateId);
      available.delete(bestCandidateId);
      maxSims.delete(bestCandidateId);

      // No hace falta actualizar después de seleccionar la última tarjeta.
      if (selected.length < targetCount) {
        for (const [candidateId] of available.entries()) {
          const similarity = index.similarity(candidateId, bestCandidateId);
          const currentMax = maxSims.get(candidateId) ?? 0;
          if (similarity > currentMax) {
            maxSims.set(candidateId, similarity);
          }
        }
      }
    } else {
      break;
    }
  }

  return selected;
}

module.exports = { selectDiverse };

