// FILE: backend/src/models/Flashcard.js

const mongoose = require('mongoose');

const flashcardSchema = new mongoose.Schema(
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
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
    easeFactor: { type: Number, default: 2.5 },
    bgImageIndex: { type: Number, default: -1 },
    textAlign: { type: String, enum: ['left', 'center', 'right'], default: 'center' },
    fontSize: { type: String, default: 'text-base' },
    contentImage: { type: String, default: '' },
    imageSide: { type: String, enum: ['question', 'answer', ''], default: '' },

    // =========================================================================
    // NUEVOS CAMPOS DE TELEMETRÍA Y MÉTRICAS DE CONOCIMIENTO (NIVEL MICRO)
    // =========================================================================
    difficulty: { 
      type: Number, 
      default: 0.3, // Escala de 0.0 (Dominio total/Regalo) a 1.0 (Máxima dificultad)
      min: 0.0,
      max: 1.0,
      index: true 
    },
    totalReviews: { 
      type: Number, 
      default: 0 
    }, // Cantidad de repasos individuales para calcular madurez de retención
    consecutiveErrors: { 
      type: Number, 
      default: 0 
    }, // Control de rachas de fallos para el índice de resiliencia
    lastReviewedAt: { 
      type: Date, 
      default: null 
    } // Esencial para ponderar el tiempo transcurrido desde el último repaso
  },
  { timestamps: true }
);

/**
 * Serializador nativo adjunto al esquema
 * Exporta el estado telemetrado de la flashcard garantizando la carga reactiva optimista.
 */
flashcardSchema.methods.serialize = function (cardBackgrounds = []) {
  return {
    id: this._id,
    userId: this.userId,
    deckId: this.deckId,
    question: this.question,
    answer: this.answer,
    easeFactor: this.easeFactor,
    bgImage: (cardBackgrounds && this.bgImageIndex >= 0) ? (cardBackgrounds[this.bgImageIndex] || '') : '',
    textAlign: this.textAlign,
    fontSize: this.fontSize,
    contentImage: this.contentImage || '', 
    imageSide: this.imageSide || '',       
    
    // Inyección atómica de variables para el motor de métricas del frontend
    difficulty: this.difficulty ?? 0.3,
    totalReviews: this.totalReviews ?? 0,
    consecutiveErrors: this.consecutiveErrors ?? 0,
    lastReviewedAt: this.lastReviewedAt || null,

    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('Flashcard', flashcardSchema);
