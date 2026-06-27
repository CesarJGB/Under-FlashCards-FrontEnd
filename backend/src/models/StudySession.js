// FILE: backend/src/models/StudySession.js
const mongoose = require('mongoose');

const studySessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    deckId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Deck',
      required: true,
      index: true,
    },

    // =========================================================================
    // VENTANA TEMPORAL DE LA SESIÓN
    // =========================================================================
    startedAt: {
      type: Date,
      default: Date.now,
    },
    endedAt: {
      type: Date,
      default: null, // null mientras la sesión está activa (bucle en curso)
    },

    // =========================================================================
    // CONTADORES AGREGADOS EN VIVO (se incrementan en cada respuesta)
    // =========================================================================
    cardsAnswered: {
      type: Number,
      default: 0,
    },
    correctCount: {
      type: Number,
      default: 0,
    },
    incorrectCount: {
      type: Number,
      default: 0,
    },
    totalResponseTimeMs: {
      type: Number,
      default: 0, // suma cruda; el promedio se deriva (totalResponseTimeMs / cardsAnswered)
    },
    batchesCompleted: {
      type: Number,
      default: 0, // cuántas veces se recargó la cola de 30 (fetchQueue) dentro de esta sesión
    },
  },
  { timestamps: true }
);

/**
 * Serializador: incluye el promedio derivado de tiempo de respuesta,
 * para no obligar al frontend a calcularlo.
 */
studySessionSchema.methods.serialize = function () {
  return {
    id: this._id,
    userId: this.userId,
    deckId: this.deckId,
    startedAt: this.startedAt,
    endedAt: this.endedAt,
    cardsAnswered: this.cardsAnswered,
    correctCount: this.correctCount,
    incorrectCount: this.incorrectCount,
    avgResponseTimeMs: this.cardsAnswered > 0
      ? Math.round(this.totalResponseTimeMs / this.cardsAnswered)
      : 0,
    batchesCompleted: this.batchesCompleted,
    accuracyRate: this.cardsAnswered > 0
      ? parseFloat((this.correctCount / this.cardsAnswered).toFixed(2))
      : 0,
  };
};

module.exports = mongoose.model('StudySession', studySessionSchema);
