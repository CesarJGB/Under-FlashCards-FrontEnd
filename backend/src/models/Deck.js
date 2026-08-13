// backend/src/models/Deck.js
const mongoose = require('mongoose');
const knowledgeMetricsSchema = require('./subdocuments/KnowledgeMetrics');
const { getRandomDeckColor } = require('../utils/deckColors');
const { isValidCoverThumb } = require('../utils/imageDelivery');

const deckSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    coverColor: { type: String, default: () => getRandomDeckColor() },
    coverImage: { type: String, default: '' },
    coverImageThumb: { type: String, default: '' },
    cardBackgrounds: { type: [String], default: [] },
    isStarred: { type: Boolean, default: false },
    isDefault: { type: Boolean, default: false },
    isPublicReadOnly: { type: Boolean, default: false },
    aiGenerationLocks: {
      type: [{ token: { type: String, required: true }, expiresAt: { type: Date, required: true } }],
      default: [],
    },

    materiaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Materia', default: null, index: true },
    parcialNumber: { type: Number, enum: [1, 2, 3], default: null, index: true },
    temaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tema', default: null, index: true },
    subtemaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subtema', default: null, index: true },

    // REFACTORIZACIÓN: Estandarización bajo el esquema global del Radar
    knowledgeMetrics: {
      type: knowledgeMetricsSchema,
      default: () => ({})
    }
  },
  { timestamps: true }
);

// Índice compuesto optimizado para búsquedas y ordenamientos rápidos de debilidades conceptuales
deckSchema.index({ 'knowledgeMetrics.mastery': 1, userId: 1 });

deckSchema.methods.serialize = function (cardCount) {
  return {
    id: this._id,
    userId: this.userId,
    title: this.title,
    coverColor: this.coverColor,
    coverImage: this.coverImage,
    cardCount: typeof cardCount === 'number' ? cardCount : undefined,
    cardBackgrounds: this.cardBackgrounds || [], 
    isStarred: this.isStarred || false,
    isDefault: this.isDefault || false,
    isPublicReadOnly: this.isPublicReadOnly || false,
    
    materiaId: this.materiaId || null,
    parcialNumber: this.parcialNumber || null,
    temaId: this.temaId || null,
    subtemaId: this.subtemaId || null,
    
    // RETROCOMPATIBILIDAD CON EL FRONTEND: Mapeamos el nuevo Radar al viejo objeto analytics esperado por la UI
    analytics: {
      masteryPercentage: this.knowledgeMetrics?.mastery ?? 0,
      avgResponseTime: this.knowledgeMetrics?.speed ?? 0,
      totalReviewsCount: this.knowledgeMetrics?.reviews ?? 0,
      velocityIndex: this.knowledgeMetrics?.knowledgeScore ?? 0,
      lastCalculatedAt: this.knowledgeMetrics?.lastReview || this.createdAt,
    },
    
    createdAt: this.createdAt,
  };
};

/**
 * Resumen del mazo para la lista versionada (Corte 1, `?contract=indexed`):
 * idéntico a serialize() salvo que excluye por completo `cardBackgrounds`
 * (sin consumidores en el frontend). coverImage se conserva completa.
 * No incluye coverImageThumb: el contrato del Corte 1 no depende de que el
 * frontend entienda miniaturas.
 */
deckSchema.methods.serializeSummary = function (cardCount) {
  const summary = this.serialize(cardCount);
  delete summary.cardBackgrounds;
  return summary;
};

/**
 * Resumen ligero del mazo (Corte 2, `?contract=indexed&cover=thumbnail`):
 * nunca incluye cardBackgrounds. Si la miniatura almacenada es válida,
 * transporta coverImageThumb y omite coverImage completa; si no, conserva
 * coverImage completa como fallback y no inventa miniatura. La validación
 * vive en imageDelivery.js (fuente única).
 */
deckSchema.methods.serializeLightSummary = function (cardCount) {
  const summary = this.serializeSummary(cardCount);
  if (isValidCoverThumb(this.coverImageThumb)) {
    delete summary.coverImage;
    summary.coverImageThumb = this.coverImageThumb;
  }
  return summary;
};

module.exports = mongoose.model('Deck', deckSchema);
