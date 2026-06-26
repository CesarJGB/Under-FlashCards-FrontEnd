// FILE: frontend/src/lib/metricsEngine.js

/**
 * CONFIGURACIÓN DE PESOS PONDERADOS (Single Source of Truth para el cliente)
 * Modificar estos coeficientes altera el comportamiento del cálculo sin tocar la UI.
 * La suma de los pesos activos debe ser igual a 1.0.
 */
const CONFIG = {
  WEIGHTS: {
    accuracy: 0.40,   // Ratio de aciertos directos
    retention: 0.20,  // Impacto de la curva del olvido (tiempo transcurrido)
    fluidity: 0.15,   // Velocidad de respuesta (penaliza titubeo)
    volume: 0.15,     // Cantidad de repasos totales (madurez del conocimiento)
    resilience: 0.10, // Capacidad de recuperación ante errores pasados
    aiPrediction: 0.00 // RESERVADO: Futuro hook de telemetría de IA
  },
  TARGETS: {
    FLUID_RESPONSE_MS: 3000,   // Respuestas bajo 3 segundos obtienen puntuación de fluidez máxima
    MAX_RESPONSE_MS: 12000,    // Respuestas sobre 12 segundos se consideran titubeo extremo (0 puntos)
    MATURITY_REVIEWS: 20,      // Número de repasos necesarios para considerar "Volumen Máximo"
    RETENTION_HALF_LIFE_DAYS: 7 // Días en los que el dominio decae a la mitad si no se repasa
  }
};

/**
 * Normaliza el tiempo de respuesta en una escala de 0.0 a 1.0
 */
function calculateFluidityScore(avgTimeMs) {
  if (!avgTimeMs || avgTimeMs <= CONFIG.TARGETS.FLUID_RESPONSE_MS) return 1.0;
  if (avgTimeMs >= CONFIG.TARGETS.MAX_RESPONSE_MS) return 0.0;
  
  // Interpolación lineal inversa
  return 1 - ((avgTimeMs - CONFIG.TARGETS.FLUID_RESPONSE_MS) / 
    (CONFIG.TARGETS.MAX_RESPONSE_MS - CONFIG.TARGETS.FLUID_RESPONSE_MS));
}

/**
 * Aplica una curva de decaimiento temporal basada en la curva del olvido.
 * Mide el impacto del "tiempo desde el último repaso".
 */
function calculateRetentionScore(lastReviewedAt) {
  if (!lastReviewedAt) return 0.5; // Estado neutro si nunca se ha repasado
  
  const elapsedMs = Date.now() - new Date(lastReviewedAt).getTime();
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
  
  // Fórmula exponencial de retención básica: e^(-lambda * t)
  const lambda = Math.LN2 / CONFIG.TARGETS.RETENTION_HALF_LIFE_DAYS;
  return Math.max(0.1, Math.exp(-lambda * elapsedDays));
}

/**
 * Determina qué tan consolidado está el mazo según el volumen de repeticiones de sus tarjetas.
 */
function calculateVolumeScore(totalReviews) {
  if (!totalReviews) return 0.0;
  // Uso de escala logarítmica para evitar que repeticiones infinitas inflen el score artificialmente
  return Math.min(1.0, Math.log1p(totalReviews) / Math.log1p(CONFIG.TARGETS.MATURITY_REVIEWS));
}

/**
 * Evalúa el historial de errores. Si no hay errores consecutivos, el score es óptimo.
 */
function calculateResilienceScore(consecutiveErrors) {
  if (!consecutiveErrors || consecutiveErrors === 0) return 1.0;
  // Penalización exponencial por cada error no resuelto en rachas
  return Math.max(0.0, Math.pow(0.5, consecutiveErrors));
}

/**
 * MOTOR DE CÁLCULO GENERAL DE DOMINIO (Extensible y Desacoplado)
 * Recibe un set de flashcards pertenecientes a un Mazo o Materia y devuelve el objeto analítico consolidado.
 * Garantiza respuesta inmediata (0ms) en el cliente de forma predictiva.
 * * @param {Array} cards - Array de objetos Flashcard con campos de métricas inyectados.
 * @returns {Object} Analytics optimistas listos para inyectar en LocalStorage.
 */
export function calculateCollectionAnalytics(cards) {
  const totalCards = cards?.length || 0;
  
  if (totalCards === 0) {
    return {
      masteryPercentage: 0,
      avgResponseTime: 0,
      totalReviewsCount: 0,
      velocityIndex: 0,
      lastCalculatedAt: new Date().toISOString()
    };
  }

  let aggregateAccuracy = 0;
  let aggregateResponseTime = 0;
  let aggregateReviews = 0;
  let aggregateFluidity = 0;
  let aggregateRetention = 0;
  let aggregateResilience = 0;
  let cardsReviewedCount = 0;

  cards.forEach(card => {
    // 1. Extraer o estimar el accuracy inverso de la dificultad de la tarjeta
    // Si difficulty = 0.3 (por defecto), el accuracy basal es 0.7
    const currentCardDifficulty = card.difficulty ?? 0.3;
    const accuracyScore = 1.0 - currentCardDifficulty;
    aggregateAccuracy += accuracyScore;

    // 2. Acumular métricas directas si la tarjeta posee historial
    if (card.totalReviews && card.totalReviews > 0) {
      cardsReviewedCount++;
      aggregateReviews += card.totalReviews;
      
      // Simulación de tiempo si falta en el cliente para evitar NaN
      const cardTime = card.avgResponseTimeMs || (CONFIG.TARGETS.FLUID_RESPONSE_MS * 1.5);
      aggregateResponseTime += cardTime;
      aggregateFluidity += calculateFluidityScore(cardTime);
      aggregateResilience += calculateResilienceScore(card.consecutiveErrors);
    } else {
      // Fallbacks neutrales para tarjetas no tocadas dentro de la colección
      aggregateFluidity += 0.5;
      aggregateResilience += 1.0;
    }

    // 3. Evaluar decaimiento temporal (siempre aplica por la fecha)
    aggregateRetention += calculateRetentionScore(card.lastReviewedAt);
  });

  // Normalizaciones promedio basadas en la densidad del mazo
  const avgAccuracy = aggregateAccuracy / totalCards;
  const avgFluidity = aggregateFluidity / totalCards;
  const avgRetention = aggregateRetention / totalCards;
  const avgResilience = aggregateResilience / totalCards;
  const totalReviewsCount = aggregateReviews;
  const avgResponseTime = cardsReviewedCount > 0 ? (aggregateResponseTime / cardsReviewedCount) : 0;
  
  // Puntuación del volumen global del mazo
  const globalVolumeScore = calculateVolumeScore(totalReviewsCount / totalCards);

  // =========================================================================
  // MATRIZ DE AGREGACIÓN PONDERADA (Fórmula Core del Dominio)
  // =========================================================================
  const W = CONFIG.WEIGHTS;
  
  let masteryScore = 
    (avgAccuracy * W.accuracy) +
    (avgRetention * W.retention) +
    (avgFluidity * W.fluidity) +
    (globalVolumeScore * W.volume) +
    (avgResilience * W.resilience);

  // Hook extensible de IA: Reservado para futuras variables mutables sin romper esquemas
  const aiHookValue = 0.0; 
  masteryScore += (aiHookValue * W.aiPrediction);

  // Puntuación final acotada a porcentaje entero (0 - 100)
  const masteryPercentage = Math.min(100, Math.max(0, Math.round(masteryScore * 100)));

  // Índice de Velocidad de Aprendizaje (Tarjetas con progreso real sobre tiempo de revisión)
  const velocityIndex = parseFloat(((cardsReviewedCount * avgAccuracy) / Math.max(1, totalReviewsCount)).toFixed(2));

  return {
    masteryPercentage,
    avgResponseTime: Math.round(avgResponseTime),
    totalReviewsCount,
    velocityIndex,
    lastCalculatedAt: new Date().toISOString()
  };
}

/**
 * ACTUALIZACIÓN OPTIMISTA LOCAL DE LOCALSTORAGE
 * Intercepta el flujo del cliente tras finalizar una sesión para inyectar los datos a 0ms de latencia.
 */
export function syncOptimisticMateriaAnalytics(materiaId, updatedDecks) {
  try {
    const userId = JSON.parse(localStorage.getItem('user_session'))?.id;
    if (!userId) return;

    // Recuperar materias de la caché híbrida lineal
    const localMateriasKey = `materias_${userId}`;
    const materias = JSON.parse(localStorage.getItem(localMateriasKey)) || [];

    const targetMateriaIndex = materias.findIndex(m => m.id === materiaId);
    if (targetMateriaIndex !== -1) {
      // Recolectar todas las analíticas de los mazos mutados para promediar la materia de raíz
      let totalMastery = 0;
      let totalReviews = 0;
      let activeDecksCount = 0;

      updatedDecks.forEach(deck => {
        if (deck.materiaId === materiaId) {
          totalMastery += deck.analytics?.masteryPercentage ?? 0;
          totalReviews += deck.analytics?.totalReviewsCount ?? 0;
          activeDecksCount++;
        }
      });

      // Mutación in-place del objeto de analíticas en caché
      materias[targetMateriaIndex].analytics = {
        ...materias[targetMateriaIndex].analytics,
        masteryPercentage: activeDecksCount > 0 ? Math.round(totalMastery / activeDecksCount) : 0,
        totalReviewsCount: totalReviews,
        lastCalculatedAt: new Date().toISOString()
      };

      // Escritura atómica síncrona
      localStorage.setItem(localMateriasKey, JSON.stringify(materias));
    }
  } catch (error) {
    console.error("Error crítico en la sincronización optimista de métricas locales:", error);
  }
}
