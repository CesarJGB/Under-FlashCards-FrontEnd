// backend/src/models/Tema.js
const mongoose = require('mongoose');
const knowledgeMetricsSchema = require('./subdocuments/KnowledgeMetrics');

const temaSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    materiaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Materia', required: true, index: true },
    parcialNumber: { type: Number, required: true, enum: [1, 2, 3], index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    
    // Inyección del Radar de Conocimiento (Nivel Temario de Parcial)
    knowledgeMetrics: {
      type: knowledgeMetricsSchema,
      default: () => ({})
    }
  },
  { timestamps: true }
);

temaSchema.methods.serialize = function () {
  return {
    id: this._id,
    _id: this._id,
    name: this.name,
    materiaId: this.materiaId,
    parcialNumber: this.parcialNumber,
    userId: this.userId,
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

module.exports = mongoose.model('Tema', temaSchema);
