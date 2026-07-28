// backend/src/services/semantic/orchestrator.js

const crypto = require('crypto');
const { logAiEvent } = require("../aiService");

const { InMemoryVectorIndex } = require('./core/InMemoryVectorIndex');
const { resolveDuplicates } = require('./algorithms/DuplicateResolver');
const { selectDiverse } = require('./algorithms/DiversitySelector');

/**
 * Orquesta el pipeline semántico V3.
 * No contiene lógica de fallback. Si algo falla, lanza el error.
 * 
 * @param {Object} params
 * @param {Array<{question: string, answer: string, qualityScore?: number}>} params.cards
 * @param {import('./types').EmbeddingProvider} params.embedder
 * @param {number} params.targetCount
 * @param {AbortSignal} [params.signal]
 * @param {Object} [params.config]
 * @returns {Promise<{selectedCards: Array<Object>, stats: Object}>}
 */
async function processSemanticBatch({ cards, embedder, targetCount, signal, config = {} }) {
  // 1. Validación defensiva en la frontera pública
  if (!Array.isArray(cards)) {
    throw new Error('INVALID_CARDS_INPUT');
  }

  if (!embedder || typeof embedder.embed !== 'function') {
    throw new Error('INVALID_EMBEDDER');
  }

  if (!Number.isInteger(targetCount) || targetCount < 0) {
    throw new Error('INVALID_TARGET_COUNT');
  }

  const inputCount = cards.length;
  if (inputCount === 0) {
    return { 
      selectedCards: [], 
      stats: { 
        inputCount: 0, 
        duplicatesRemoved: 0, 
        mmrDiscarded: 0, 
        outputCount: 0,
        conceptsDetected: 0,
        conceptsCovered: 0,
        coverageRate: 0
      } 
    };
  }

  const { 
    deduplicationThreshold = 0.92, 
    mmrLambda = 0.7 
  } = config;

  // 2. Asignar IDs temporales y asegurar qualityScore por defecto
  const cardsWithIds = cards.map((card, index) => ({
    originalCard: card,
    id: `semantic_${index}`,
    qualityScore: card.qualityScore ?? 1.0
  }));

  // 3. Generar Embeddings (El proveedor puede lanzar errores que se propagarán)
  const texts = cardsWithIds.map(c => `${c.originalCard.question} ${c.originalCard.answer}`);
  const vectors = await embedder.embed(texts, signal);

  // 4. Validación extendida de la respuesta del Embedder
  if (
    !Array.isArray(vectors) ||
    vectors.length !== inputCount ||
    vectors.some(vector =>
      !Array.isArray(vector) ||
      vector.length === 0 ||
      vector.some(value => !Number.isFinite(value))
    )
  ) {
    throw new Error('INVALID_EMBEDDING_RESPONSE: estructura de vectores inválida.');
  }

  // 5. Crear Índice en memoria
  const index = new InMemoryVectorIndex();
  const items = cardsWithIds.map((card, i) => ({
    id: card.id,
    vector: vectors[i],
    metadata: { question: card.originalCard.question }
  }));
  
  index.insert(items); // Última barrera matemática para validar dimensiones consistentes

  // Índice O(1) para acceso a tarjetas en callbacks de telemetría
  const cardLookup = new Map(cardsWithIds.map(card => [card.id, card.originalCard]));

  const onDuplicateDetected = ({ survivorId, removedId, similarity, survivorScore, removedScore }) => {
    try {
      const survivorCard = cardLookup.get(survivorId);
      const removedCard = cardLookup.get(removedId);
      if (!survivorCard || !removedCard) return;

      const formatForTelemetry = (card) => {
        const text = [card.question ?? "", card.answer ?? ""].join(" ").trim();
        const snippet = text.length > 80 ? `${text.substring(0, 80)}...` : text;
        // NOTA: MD5 se utiliza estrictamente como identificador estable no criptográfico para telemetría.
        const hash = crypto.createHash('md5').update(text).digest('hex').slice(0, 8);
        return { snippet, hash };
      };

      logAiEvent('semantic_v3_dedup_collapse', {
        survivor: formatForTelemetry(survivorCard),
        removed: formatForTelemetry(removedCard),
        similarity: Number(similarity.toFixed(4)),
        survivorScore,
        removedScore
      });
    } catch (error) {
      // Decisión consciente: la telemetría no debe romper el pipeline principal.
      logAiEvent('semantic_v3_telemetry_error', { error: error.message });
    }
  };

  // 6. Ejecutar DuplicateResolver
  const survivorIds = resolveDuplicates({ 
    index, 
    cards: cardsWithIds.map(c => ({ id: c.id, qualityScore: c.qualityScore })), 
    threshold: deduplicationThreshold,
    onDuplicateDetected
  });
  
  const survivorSet = new Set(survivorIds);
  const survivorCards = cardsWithIds.filter(c => survivorSet.has(c.id));
  const duplicatesRemoved = inputCount - survivorIds.length;

  // 7. Ejecutar DiversitySelector (MMR)
  const selectedIds = selectDiverse({ 
    index, 
    cards: survivorCards.map(c => ({ id: c.id, qualityScore: c.qualityScore })), 
    targetCount, 
    lambda: mmrLambda 
  });

  const selectedSet = new Set(selectedIds);
  const finalCards = survivorCards.filter(c => selectedSet.has(c.id));
  const outputCount = finalCards.length;
  const mmrDiscarded = survivorIds.length - outputCount;

  // 8. Mapear de vuelta a las tarjetas originales y devolver estadísticas
  return {
    selectedCards: finalCards.map(c => c.originalCard),
    stats: {
      inputCount,
      duplicatesRemoved,
      mmrDiscarded,
      outputCount,
      conceptsDetected: survivorIds.length,
      conceptsCovered: outputCount,
      coverageRate: survivorIds.length > 0
        ? Number((outputCount / survivorIds.length).toFixed(4))
        : 0
    }
  };
}

module.exports = { processSemanticBatch };
