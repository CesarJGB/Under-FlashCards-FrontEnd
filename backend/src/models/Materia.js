// backend/src/models/Materia.js
const mongoose = require('mongoose');
const knowledgeMetricsSchema = require('./subdocuments/KnowledgeMetrics');

const materiaSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    
    activeParciales: { type: [Number], default: [1, 2, 3] },

    // Inyección del Radar de Conocimiento (Nivel Asignatura Global)
    knowledgeMetrics: {
      type: knowledgeMetricsSchema,
      default: () => ({}) // Se inicializa con los defaults del subdocumento
    }
  },
  { timestamps: true }
);

materiaSchema.index({ name: 1, userId: 1 }, { unique: true });

materiaSchema.methods.serialize = function () {
  return {
    id: this._id,
    _id: this._id,
    name: this.name,
    userId: this.userId,
    activeParciales: this.activeParciales,
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

module.exports = mongoose.model('Materia', materiaSchema);
