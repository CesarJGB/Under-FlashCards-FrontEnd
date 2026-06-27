// FILE: backend/src/controllers/reviewController.js
const Flashcard = require('../models/Flashcard');
const ReviewLog = require('../models/ReviewLog');
const Deck = require('../models/Deck');
const Subtema = require('../models/Subtema');
const Tema = require('../models/Tema');
const Materia = require('../models/Materia');
const { enqueueForUser } = require('../utils/userQueue');

// =========================================================================
// COEFICIENTES CORE DEL RADAR (Single Source of Truth del Servidor)
// =========================================================================
const WEIGHTS = { accuracy: 0.40, retention: 0.20, fluidity: 0.15, volume: 0.15, resilience: 0.10 };
const TARGETS = { FLUID_MS: 3000, MAX_MS: 12000, MATURITY_REVIEWS: 20, HALF_LIFE_DAYS: 7 };

// --- Helpers Matemáticos de Normalización ---
function getFluidityScore(ms) {
  if (!ms || ms <= TARGETS.FLUID_MS) return 1.0;
  if (ms >= TARGETS.MAX_MS) return 0.0;
  return 1 - ((ms - TARGETS.FLUID_MS) / (TARGETS.MAX_MS - TARGETS.FLUID_MS));
}

function getRetentionScore(lastDate) {
  if (!lastDate) return 0.5;
  const days = (Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0.1, Math.exp(-(Math.LN2 / TARGETS.HALF_LIFE_DAYS) * days));
}

function getVolumeScore(reviews) {
  if (!reviews) return 0.0;
  return Math.min(1.0, Math.log1p(reviews) / Math.log1p(TARGETS.MATURITY_REVIEWS));
}

function getResilienceScore(errors) {
  if (!errors || errors === 0) return 1.0;
  return Math.max(0.0, Math.pow(0.5, errors));
}

// =========================================================================
// MOTOR DE CÁLCULO DE RADAR (Calibración de Acumulación Estricta y Lineal)
// =========================================================================
function calculateRadarMetrics(items, isDeckLevel = false, currentReview = null) {
  const total = items.length;
  if (total === 0) return { accuracy: 0, speed: 0, reviews: 0, mastery: 0, confidence: 0, difficulty: 0, lastReview: null, knowledgeScore: 0 };

  let aggAccuracy = 0, aggSpeed = 0, aggReviews = 0, aggFluidity = 0, aggRetention = 0, aggResilience = 0, aggConfidence = 0;
  let reviewedCount = 0, latestReviewDate = null;

  items.forEach(item => {
    let metrics;

    if (isDeckLevel) {
      // 🎯 NIVEL MICRO: Evaluación de Flashcards individuales
      const hasHistory = item.totalReviews && item.totalReviews > 0;
      
      const cardSpeed = (currentReview && String(item._id) === String(currentReview.cardId))
        ? currentReview.responseTimeMs 
        : (TARGETS.FLUID_MS * 1.5);

      metrics = {
        accuracy: hasHistory ? (1.0 - (item.difficulty ?? 0.3)) : 0,
        speed: hasHistory ? cardSpeed : 0,
        reviews: item.totalReviews ?? 0,
        confidence: hasHistory ? (item.easeFactor ?? 2.5) : 0,
        difficulty: item.difficulty ?? 0.3,
        lastReview: item.lastReviewedAt,
        fluidity: hasHistory ? getFluidityScore(cardSpeed) : 0,
        retention: hasHistory ? getRetentionScore(item.lastReviewedAt) : 0,
        // REFACTORIZACIÓN: Si la tarjeta no se ha visto, aporta 0 en resiliencia para evitar saltos del 10%
        resilience: hasHistory ? getResilienceScore(item.consecutiveErrors) : 0 
      };

      if (hasHistory) reviewedCount++;
    } else {
      // 🏢 NIVEL MACRO: Consolidación jerárquica (Subtemas, Temas, Materias)
      const hasData = item.knowledgeMetrics && item.knowledgeMetrics.reviews > 0;

      metrics = {
        accuracy: item.knowledgeMetrics?.accuracy ?? 0,
        speed: item.knowledgeMetrics?.speed ?? 0,
        reviews: item.knowledgeMetrics?.reviews ?? 0,
        confidence: item.knowledgeMetrics?.confidence ?? 0,
        difficulty: item.knowledgeMetrics?.difficulty ?? 0,
        lastReview: item.knowledgeMetrics?.lastReview,
        fluidity: hasData ? getFluidityScore(item.knowledgeMetrics?.speed) : 0,
        retention: hasData ? getRetentionScore(item.knowledgeMetrics?.lastReview) : 0,
        resilience: hasData ? (item.knowledgeMetrics?.mastery / 100) : 0 
      };

      if (hasData) reviewedCount++;
    }

    aggAccuracy += metrics.accuracy;
    aggSpeed += metrics.speed;
    aggReviews += metrics.reviews;
    aggFluidity += metrics.fluidity;
    aggRetention += metrics.retention;
    aggResilience += metrics.resilience;
    aggConfidence += metrics.confidence;

    if (metrics.lastReview && (!latestReviewDate || new Date(metrics.lastReview) > new Date(latestReviewDate))) {
      latestReviewDate = metrics.lastReview;
    }
  });

  // Promedios basados rigurosamente en la densidad total del mazo/contenedor
  const avgAccuracy = aggAccuracy / total;
  const avgSpeed = reviewedCount > 0 ? (aggSpeed / reviewedCount) : 0;
  const avgFluidity = aggFluidity / total;
  const avgRetention = aggRetention / total;
  const avgResilience = aggResilience / total;
  const avgConfidence = aggConfidence / total;
  const avgDifficulty = reviewedCount > 0 ? (1.0 - (aggAccuracy / total)) : 1.0;

  // El volumen mide el progreso real en base a la meta de madurez
  const globalVolume = getVolumeScore(isDeckLevel ? (aggReviews / total) : aggReviews);

  // =========================================================================
  // FUSIÓN DE MATRIZ PONDERADA REALISTA (Gamificación UI/UX estricta)
  // =========================================================================
  let masteryScore = 
    (avgAccuracy * WEIGHTS.accuracy) +
    (avgRetention * WEIGHTS.retention) +
    (avgFluidity * WEIGHTS.fluidity) +
    (globalVolume * WEIGHTS.volume) +
    (avgResilience * WEIGHTS.resilience);

  // Forzado de Cero Absoluto si no se registra actividad real en el mazo
  const mastery = reviewedCount === 0 ? 0 : Math.min(100, Math.max(0, Math.round(masteryScore * 100)));
  const knowledgeScore = parseFloat(((reviewedCount * avgAccuracy) / Math.max(1, aggReviews)).toFixed(2));

  return {
    accuracy: parseFloat(avgAccuracy.toFixed(2)),
    speed: Math.round(avgSpeed),
    reviews: aggReviews,
    mastery,
    confidence: parseFloat(avgConfidence.toFixed(2)),
    difficulty: parseFloat(avgDifficulty.toFixed(2)),
    lastReview: latestReviewDate,
    knowledgeScore
  };
}

// =========================================================================
// ACTION HANDLER: REGISTRO DE REPASO Y PROPAGACIÓN EN CASCADA
// =========================================================================
exports.registerReview = async (req, res) => {
  const { deckId } = req.params;
  const { cardId, userId, wasCorrect, responseTimeMs } = req.body;

  try {
    // 1. Mutación Atómica de la Flashcard (Nivel Micro) — FIX: pipeline update
    // en vez de find() + mutar + save(), para eliminar la ventana de race condition
    const difficultyDelta = wasCorrect ? -0.1 : 0.15;
    const easeFactorDelta = wasCorrect ? 0.15 : -0.2;

    const card = await Flashcard.findOneAndUpdate(
      { _id: cardId, deckId, userId },
      [
        {
          $set: {
            totalReviews: { $add: ['$totalReviews', 1] },
            lastReviewedAt: new Date(),
            consecutiveErrors: wasCorrect ? 0 : { $add: ['$consecutiveErrors', 1] },
            difficulty: {
              $max: [0.0, { $min: [1.0, { $add: ['$difficulty', difficultyDelta] }] }]
            },
            easeFactor: {
              $max: [1.3, { $add: ['$easeFactor', easeFactorDelta] }]
            }
          }
        }
      ],
            { new: true, updatePipeline: true }
    );


    if (!card) return res.status(404).json({ error: 'Flashcard no encontrada.' });

    // 2. Insertar entrada inmutable en el Libro Contable (Ledger) — SIN CAMBIOS
    const log = new ReviewLog({
      userId,
      cardId,
      deckId,
      materiaId: (await Deck.findById(deckId))?.materiaId || null,
      wasCorrect,
      responseTimeMs,
      currentDifficulty: card.difficulty,
      reviewNumber: card.totalReviews
    });
    await log.save();

        // =========================================================================
    // DISPARADOR EN CASCADA VERTICAL (Actualización de Radares hacia arriba)
    // Encolado por usuario para evitar carreras de escritura entre cascadas
    // disparadas casi simultáneamente (ej. respuestas muy rápidas en el modo continuo).
    // =========================================================================
    const currentReviewContext = { cardId, responseTimeMs };

    enqueueForUser(userId, () => runCascade(deckId, currentReviewContext));

    return res.status(201).json({
      success: true,
      log: log.serialize()
    });

  } catch (error) {
    console.error("Error crítico en cascada del Radar:", error);
    return res.status(500).json({ error: 'Fallo interno en el motor de métricas.' });
  }
};

// =========================================================================
// CASCADA: recalcula y persiste los radares de Deck -> Subtema -> Tema -> Materia
// Se ejecuta siempre dentro de la cola serializada por userId (ver userQueue.js)
// =========================================================================
async function runCascade(deckId, currentReviewContext) {
  // Nivel A: Recalcular el Mazo (Deck)
  const allCards = await Flashcard.find({ deckId });
  const deck = await Deck.findById(deckId);
  if (!deck) return;

  deck.knowledgeMetrics = calculateRadarMetrics(allCards, true, currentReviewContext);
  await deck.save();

  // Nivel B: Recalcular Subtema (Si está mapeado)
  if (deck.subtemaId) {
    const sisterDecks = await Deck.find({ subtemaId: deck.subtemaId });
    await Subtema.findByIdAndUpdate(deck.subtemaId, {
      knowledgeMetrics: calculateRadarMetrics(sisterDecks)
    });
  }

  // Nivel C: Recalcular Tema
  if (deck.temaId) {
    const childSubtemas = await Subtema.find({ temaId: deck.temaId });
    if (childSubtemas.length > 0) {
      await Tema.findByIdAndUpdate(deck.temaId, { knowledgeMetrics: calculateRadarMetrics(childSubtemas) });
    } else {
      const directDecks = await Deck.find({ temaId: deck.temaId, subtemaId: null });
      await Tema.findByIdAndUpdate(deck.temaId, { knowledgeMetrics: calculateRadarMetrics(directDecks) });
    }
  }

  // Nivel D: Recalcular Materia (Raíz Global)
  if (deck.materiaId) {
    const childTemas = await Tema.find({ materiaId: deck.materiaId });
    await Materia.findByIdAndUpdate(deck.materiaId, {
      knowledgeMetrics: calculateRadarMetrics(childTemas)
    });
  }
}

// =========================================================================
// NUEVO: GENERADOR DE COLA INTELIGENTE PARA REPASO CONTINUO
// =========================================================================
exports.getContinuousSessionCards = async (req, res) => {
  const { deckId } = req.params;
  const { userId } = req.query; // Al ser GET, viaja en la URL (?userId=...)

  try {
    if (!userId) {
      return res.status(400).json({ error: 'El parámetro userId es requerido en el query string.' });
    }

    // Ataque directo a las debilidades:
    // 1. Tarjetas con mayor racha de errores en el presente inmediato (consecutiveErrors DESC)
    // 2. Tarjetas con mayor fricción histórica acumulada (difficulty DESC)
    const prioritizedCards = await Flashcard.find({ deckId, userId })
      .sort({ consecutiveErrors: -1, difficulty: -1 })
      .limit(30); // Lote óptimo balanceado para mutar la cola tras cada ciclo

    if (prioritizedCards.length === 0) {
      return res.status(404).json({ error: 'No se encontraron flashcards activas para este mazo.' });
    }

    return res.status(200).json({
      success: true,
      cards: prioritizedCards
    });
  } catch (error) {
    console.error("Error al generar la cola de repaso continuo:", error);
    return res.status(500).json({ error: 'Fallo interno al construir la sesión continua.' });
  }
};
