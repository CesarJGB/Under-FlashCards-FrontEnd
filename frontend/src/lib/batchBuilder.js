// FILE: frontend/src/lib/batchBuilder.js
//
// Lógica de selección de lotes para SessionPlayer, ejecutada en el cliente.
// Portada 1:1 desde reviewController.js (getContinuousSessionCards /
// getNormalSessionCards) para que el comportamiento de priorización sea
// idéntico al que ya estaba validado en el backend, pero sin necesitar un
// viaje de red por cada lote (evita reenviar imágenes pesadas repetidas).

const BATCH_SIZE = 30;
const NEW_CARD_RATIO = 0.6; // hasta 60% del lote puede ser tarjetas nunca repasadas
const ERROR_CAP = 5; // techo para que consecutiveErrors no monopolice infinitamente

export const FRAGILE_MIN_GAP = 3;
export const FRAGILE_MAX_GAP = 6;

export function getCardId(card) {
  return card.id || card._id;
}

function buildBlockedCardSet(blockedCardIds = []) {
  return new Set(blockedCardIds);
}

function shuffleByWeight(list, weightFn) {
  return list
    .map(card => ({ card, key: Math.pow(Math.random(), 1 / weightFn(card)) }))
    .sort((a, b) => b.key - a.key)
    .map(w => w.card);
}

function fisherYates(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Arma un lote de hasta BATCH_SIZE tarjetas, priorizando por errores/dificultad
 * pero con boost fuerte para tarjetas nunca repasadas (60/40), igual que
 * getContinuousSessionCards en el backend.
 */
export function buildContinuousBatch(allCards, { excludeCardId, blockedCardIds = [] } = {}) {
  const blocked = buildBlockedCardSet(blockedCardIds);
  const pool = (excludeCardId || blocked.size > 0)
    ? allCards.filter(c => {
      const cardId = getCardId(c);
      return cardId !== excludeCardId && !blocked.has(cardId);
    })
    : allCards;
  const newCards = [];
  const reviewedCards = [];
  pool.forEach(card => {
    const isNew = !card.totalReviews || card.totalReviews === 0;
    (isNew ? newCards : reviewedCards).push(card);
  });

  const shuffledNew = shuffleByWeight(newCards, () => 1 + Math.random() * 2);
  const shuffledReviewed = shuffleByWeight(
    reviewedCards,
    card => 1 + Math.min(card.consecutiveErrors ?? 0, ERROR_CAP) * 2 + (card.difficulty ?? 0.3) * 3
  );

  const targetNewCount = Math.round(BATCH_SIZE * NEW_CARD_RATIO);
  const targetReviewedCount = BATCH_SIZE - targetNewCount;

  let takenNew = Math.min(targetNewCount, shuffledNew.length);
  let takenReviewed = Math.min(targetReviewedCount, shuffledReviewed.length);

  const totalTaken = takenNew + takenReviewed;
  if (totalTaken < BATCH_SIZE) {
    const remaining = BATCH_SIZE - totalTaken;
    const extraFromReviewed = Math.min(remaining, shuffledReviewed.length - takenReviewed);
    takenReviewed += extraFromReviewed;

    const stillRemaining = BATCH_SIZE - (takenNew + takenReviewed);
    if (stillRemaining > 0) {
      takenNew += Math.min(stillRemaining, shuffledNew.length - takenNew);
    }
  }

  const selectedNew = shuffledNew.slice(0, takenNew);
  const selectedReviewed = shuffledReviewed.slice(0, takenReviewed);

  return fisherYates([...selectedNew, ...selectedReviewed]);
}

/**
 * Arma un lote con el mazo completo en orden aleatorio simple, sin ponderar
 * por dificultad ni errores. Igual que getNormalSessionCards en el backend.
 */
export function buildNormalBatch(allCards, { excludeCardId, blockedCardIds = [] } = {}) {
  const blocked = buildBlockedCardSet(blockedCardIds);
  const pool = (excludeCardId || blocked.size > 0)
    ? allCards.filter(c => {
      const cardId = getCardId(c);
      return cardId !== excludeCardId && !blocked.has(cardId);
    })
    : allCards;
  const shuffled = fisherYates(pool);
  if (excludeCardId && !blocked.has(excludeCardId)) {
    const excluded = allCards.find(c => getCardId(c) === excludeCardId);
    if (excluded) shuffled.push(excluded);
  }
  return shuffled;
}

export function getInitialFragileGap() {
  return FRAGILE_MIN_GAP;
}

export function growFragileGap(currentGap) {
  return Math.min(FRAGILE_MAX_GAP, Math.max(FRAGILE_MIN_GAP, (currentGap ?? FRAGILE_MIN_GAP) + 1));
}

export function insertFragileRetries(cards, retryCards, insertIndex = 0) {
  if (!retryCards || retryCards.length === 0) return cards;

  const nextCards = [...cards];
  const boundedIndex = Math.max(0, Math.min(insertIndex, nextCards.length));
  nextCards.splice(boundedIndex, 0, ...retryCards);
  return nextCards;
}

/**
 * Aplica localmente el mismo delta que registerReview aplica en el backend
 * tras una respuesta, para que el próximo buildBatch ya refleje el cambio
 * sin tener que esperar ningún round-trip al servidor.
 * Muta una copia del array, no el original (inmutabilidad para React state).
 */
export function applyLocalAnswer(allCards, cardId, wasCorrect) {
  const difficultyDelta = wasCorrect ? -0.1 : 0.15;
  const easeFactorDelta = wasCorrect ? 0.15 : -0.2;

  return allCards.map(card => {
    if (getCardId(card) !== cardId) return card;

    return {
      ...card,
      totalReviews: (card.totalReviews ?? 0) + 1,
      lastReviewedAt: new Date().toISOString(),
      consecutiveErrors: wasCorrect ? 0 : (card.consecutiveErrors ?? 0) + 1,
      difficulty: Math.max(0.0, Math.min(1.0, (card.difficulty ?? 0.3) + difficultyDelta)),
      easeFactor: Math.max(1.3, (card.easeFactor ?? 2.5) + easeFactorDelta),
    };
  });
}
