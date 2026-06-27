// FILE: backend/src/models/ReviewLog.js

const mongoose = require('mongoose');

const reviewLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    cardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Flashcard',
      required: true,
      index: true,
    },
    deckId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Deck',
      required: true,
      index: true,
    },
    // Vinculación jerárquica para permitir agregaciones directas por asignatura
    materiaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Materia',
      default: null,
      index: true,
    },

    // Vinculación opcional a la sesión de estudio (Bucle Activo) en la que ocurrió este repaso.
    // null para repasos que no ocurren dentro de una sesión trackeada (ej. modo deck simple,
    // o logs históricos previos a la introducción de StudySession).
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudySession',
      default: null,
      index: true,
    },
    
    // Telemetría de la respuesta
    wasCorrect: {
      type: Boolean,
      required: true,
    },
    responseTimeMs: {
      type: Number,
      required: true, // Tiempo exacto que tardó el usuario en presionar "Mostrar Respuesta"
    },
    
    // Estado instantáneo del algoritmo antes/durante este repaso
    currentDifficulty: {
      type: Number,
      required: true,
      min: 0.0,
      max: 1.0,
    },
    reviewNumber: {
      type: Number,
      required: true, // Ordinal del repaso (ej: Repaso nº 5 de esta tarjeta)
    },
  },
  // Desactivamos updatedAt porque un log es un registro histórico inmutable (ledger)
  // Renombramos createdAt a timestamp para semántica analítica
  { timestamps: { createdAt: 'timestamp', updatedAt: false } }
);

// =========================================================================
// ÍNDICES COMPUESTOS DE ALTO RENDIMIENTO (Para consultas de agregación de IA)
// =========================================================================

// Optimiza el cálculo en caliente del dominio de una materia específica filtrando por los repasos recientes del usuario
reviewLogSchema.index({ userId: 1, materiaId: 1, timestamp: -1 });

// Optimiza la telemetría interna por mazo
reviewLogSchema.index({ userId: 1, deckId: 1, timestamp: -1 });

// Optimiza la reconstrucción de detalle de una sesión específica (qué tarjetas se vieron y en qué orden)
reviewLogSchema.index({ sessionId: 1, timestamp: 1 });


/**
 * Serializador nativo adjunto al esquema
 */
reviewLogSchema.methods.serialize = function () {
  return {
    id: this._id,
    userId: this.userId,
    cardId: this.cardId,
    deckId: this.deckId,
    materiaId: this.materiaId,
    sessionId: this.sessionId,
    wasCorrect: this.wasCorrect,
    responseTimeMs: this.responseTimeMs,
    currentDifficulty: this.currentDifficulty,
    reviewNumber: this.reviewNumber,
    timestamp: this.timestamp,
  };
};

module.exports = mongoose.model('ReviewLog', reviewLogSchema);
