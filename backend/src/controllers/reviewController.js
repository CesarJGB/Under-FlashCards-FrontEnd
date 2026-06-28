// FILE: backend/src/controllers/reviewController.js
const Flashcard = require('../models/Flashcard');
const ReviewLog = require('../models/ReviewLog');
const Deck = require('../models/Deck');
const Subtema = require('../models/Subtema');
const Tema = require('../models/Tema');
const Materia = require('../models/Materia');
const StudySession = require('../models/StudySession');
const { enqueueForUser, flushUserQueue } = require('../utils/userQueue');

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

  const avgAccuracy = aggAccuracy / total;
  const avgSpeed = reviewedCount > 0 ? (aggSpeed / reviewedCount) : 0;
  const avgFluidity = aggFluidity / total;
  const avgRetention = aggRetention / total;
  const avgResilience = aggResilience / total;
  const avgConfidence = aggConfidence / total;
  const avgDifficulty = reviewedCount > 0 ? (1.0 - (aggAccuracy / total)) : 1.0;

  const globalVolume = getVolumeScore(isDeckLevel ? (aggReviews / total) : aggReviews);

  let masteryScore = 
    (avgAccuracy * WEIGHTS.accuracy) +
    (avgRetention * WEIGHTS.retention) +
    (avgFluidity * WEIGHTS.fluidity) +
    (globalVolume * WEIGHTS.volume) +
    (avgResilience * WEIGHTS.resilience);

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
  const { cardId, userId, wasCorrect, responseTimeMs, sessionId } = req.body;

  try {
    // 1. Mutación Atómica de la Flashcard (Nivel Micro) — pipeline update
    const difficultyDelta = wasCorrect ? -0.1 : 0.15;
    const easeFactorDelta = wasCorrect ? 0.15 : -0.2;

    const card = await Flashcard.findOneAndUpdate(
      { _id: cardId, deckId, userId },
      [
        {
          $set: {
            totalReviews: { $add: [{ $ifNull: ['$totalReviews', 0] }, 1] },
            lastReviewedAt: new Date(),
            consecutiveErrors: wasCorrect ? 0 : { $add: [{ $ifNull: ['$consecutiveErrors', 0] }, 1] },
            difficulty: {
              $max: [0.0, { $min: [1.0, { $add: [{ $ifNull: ['$difficulty', 0.3] }, difficultyDelta] }] }]
            },
            easeFactor: {
              $max: [1.3, { $add: [{ $ifNull: ['$easeFactor', 2.5] }, easeFactorDelta] }]
            }
          }
        }
      ],
      { new: true, updatePipeline: true }
    );

    if (!card) return res.status(404).json({ error: 'Flashcard no encontrada.' });

    // 2. Insertar entrada inmutable en el Libro Contable (Ledger)
    const log = new ReviewLog({
      userId,
      cardId,
      deckId,
      materiaId: (await Deck.findById(deckId))?.materiaId || null,
      sessionId: sessionId || null, // 🚀 Vínculo opcional a la sesión de estudio activa
      wasCorrect,
      responseTimeMs,
      currentDifficulty: card.difficulty,
      reviewNumber: card.totalReviews
    });
    await log.save();

    // 2.b Si la respuesta viene asociada a una sesión activa, incrementamos sus
    // contadores agregados de forma atómica (no bloquea ni depende de la cascada).
    if (sessionId) {
      StudySession.findByIdAndUpdate(sessionId, {
        $inc: {
          cardsAnswered: 1,
          correctCount: wasCorrect ? 1 : 0,
          incorrectCount: wasCorrect ? 0 : 1,
          totalResponseTimeMs: responseTimeMs || 0,
        }
      }).catch(err => console.error('[StudySession] Error al incrementar contadores:', err));
    }

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
// GENERADOR DE COLA INTELIGENTE PARA REPASO CONTINUO (Weighted Shuffle, 60/40)
// =========================================================================
exports.getContinuousSessionCards = async (req, res) => {
  const { deckId } = req.params;
  const { userId } = req.query; // Al ser GET, viaja en la URL (?userId=...)

  try {
    if (!userId) {
      return res.status(400).json({ error: 'El parámetro userId es requerido en el query string.' });
    }

    const BATCH_SIZE = 30;
    const NEW_CARD_RATIO = 0.6; // hasta 60% del lote puede ser tarjetas nunca repasadas
    const ERROR_CAP = 5; // techo para que consecutiveErrors no monopolice infinitamente

    // Traemos TODAS las tarjetas candidatas del deck (escala esperada: decenas, hasta ~100)
    const allCards = await Flashcard.find({ deckId, userId });

    if (allCards.length === 0) {
      return res.status(404).json({ error: 'No se encontraron flashcards activas para este mazo.' });
    }

    // Separamos en dos grupos: nunca repasadas vs. con historial
    const newCards = [];
    const reviewedCards = [];
    allCards.forEach(card => {
      const isNew = !card.totalReviews || card.totalReviews === 0;
      (isNew ? newCards : reviewedCards).push(card);
    });

    // Weighted shuffle (Efraimidis-Spirakis) dentro de cada grupo por separado
    const shuffleByWeight = (list, weightFn) => {
      return list
        .map(card => ({ card, key: Math.pow(Math.random(), 1 / weightFn(card)) }))
        .sort((a, b) => b.key - a.key)
        .map(w => w.card);
    };

    const shuffledNew = shuffleByWeight(newCards, () => 1 + Math.random() * 2);
    const shuffledReviewed = shuffleByWeight(
      reviewedCards,
      card => 1 + Math.min(card.consecutiveErrors ?? 0, ERROR_CAP) * 2 + (card.difficulty ?? 0.3) * 3
    );

    // Cupos objetivo respetando la proporción 60/40, ajustando si algún grupo no alcanza
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

    const combined = [...selectedNew, ...selectedReviewed];
    for (let i = combined.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [combined[i], combined[j]] = [combined[j], combined[i]];
    }

    return res.status(200).json({
      success: true,
      cards: combined
    });
  } catch (error) {
    console.error("Error al generar la cola de repaso continuo:", error);
    return res.status(500).json({ error: 'Fallo interno al construir la sesión continua.' });
  }
};

// =========================================================================
// SESIONES DE ESTUDIO (Bucle Activo / Repaso Continuo)
// =========================================================================

/**
 * Inicia una nueva sesión de estudio para un deck. El frontend llama esto
 * una sola vez, al montar el Reproductor Continuo (primer fetchQueue).
 */
exports.startSession = async (req, res) => {
  const { deckId } = req.params;
  const { userId } = req.body;

  try {
    if (!userId) {
      return res.status(400).json({ error: 'userId es requerido para iniciar una sesión.' });
    }

    const session = new StudySession({ userId, deckId });
    await session.save();

    return res.status(201).json({
      success: true,
      session: session.serialize()
    });
  } catch (error) {
    console.error('Error al iniciar sesión de estudio:', error);
    return res.status(500).json({ error: 'No se pudo iniciar la sesión de estudio.' });
  }
};

/**
 * Cierra una sesión activa (setea endedAt). El frontend llama esto al salir
 * del Reproductor Continuo, ya sea por botón "Salir" o desmontaje del componente.
 * Devuelve el resumen final serializado para mostrarlo en la UI si se desea.
 */
exports.closeSession = async (req, res) => {
  const { sessionId } = req.params;

  try {
    const session = await StudySession.findByIdAndUpdate(
      sessionId,
      { endedAt: new Date() },
      { new: true }
    );

    if (!session) {
      return res.status(404).json({ error: 'Sesión de estudio no encontrada.' });
    }

    return res.status(200).json({
      success: true,
      session: session.serialize()
    });
  } catch (error) {
    console.error('Error al cerrar sesión de estudio:', error);
    return res.status(500).json({ error: 'No se pudo cerrar la sesión de estudio.' });
  }
};

/**
 * Incrementa el contador de lotes completados de una sesión. El frontend llama
 * esto cada vez que el bucle recarga la cola de 30 tarjetas (fetchQueue(false)).
 */
exports.incrementSessionBatch = async (req, res) => {
  const { sessionId } = req.params;

  try {
    const session = await StudySession.findByIdAndUpdate(
      sessionId,
      { $inc: { batchesCompleted: 1 } },
      { new: true }
    );

    if (!session) {
      return res.status(404).json({ error: 'Sesión de estudio no encontrada.' });
    }

    return res.status(200).json({
      success: true,
      session: session.serialize()
    });
  } catch (error) {
    console.error('Error al incrementar lote de sesión:', error);
    return res.status(500).json({ error: 'No se pudo actualizar el progreso de la sesión.' });
  }
};

/**
 * Espera a que termine de procesarse toda la cascada de métricas pendiente
 * para un usuario (ver userQueue.js). El frontend llama esto justo antes de
 * cerrar una sesión de estudio, para garantizar que el resumen final que se
 * le muestra al usuario y el mastery que verá después en el deck reflejen
 * exactamente el mismo estado consolidado en la base de datos.
 */
exports.waitForUserQueue = async (req, res) => {
  const { userId } = req.params;

  try {
    await flushUserQueue(userId);
    return res.status(200).json({ success: true, drained: true });
  } catch (error) {
    // flushUserQueue ya atrapa sus propios errores internamente (ver userQueue.js),
    // así que llegar aquí sería un caso excepcional. No bloqueamos al usuario por esto.
    console.error('Error al esperar la cola de cascada del usuario:', error);
    return res.status(200).json({ success: true, drained: true, warning: 'No se pudo confirmar el drenado completo.' });
  }
};
