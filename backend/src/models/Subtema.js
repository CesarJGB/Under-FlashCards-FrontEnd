// backend/src/models/Subtema.js
const mongoose = require('mongoose');
const knowledgeMetricsSchema = require('./subdocuments/KnowledgeMetrics');

const subtemaSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    temaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tema', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    
    // Inyección del Radar de Conocimiento (Nivel Micro-concepto)
    knowledgeMetrics: {
      type: knowledgeMetricsSchema,
      default: () => ({})
    }
  },
  { timestamps: true }
);

subtemaSchema.methods.serialize = function () {
  return {
    id: this._id,
    _id: this._id,
    name: this.name,
    temaId: this.temaId,
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

module.exports = mongoose.model('Subtema', subtemaSchema);
