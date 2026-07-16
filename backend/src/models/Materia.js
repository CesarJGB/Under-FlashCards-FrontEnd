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
    ,
    // Evaluación jerárquica: árbol recursivo de criterios (folders/items)
    evaluationCriteria: { type: mongoose.Schema.Types.Mixed, default: [] },

    // Meta de calificación objetivo definida por el usuario (0-100)
    metaCalificacion: {
      type: Number,
      default: 70,
      min: 0,
      max: 100
    },

    publicProfile: {
      enabled: { type: Boolean, default: false },
      shareId: { type: String, default: null },
      sharedAt: { type: Date, default: null }
    }
  },
  { timestamps: true }
);

materiaSchema.index({ name: 1, userId: 1 }, { unique: true });
materiaSchema.index(
  { 'publicProfile.shareId': 1 },
  {
    unique: true,
    // Un perfil no publicado usa null; solo los enlaces públicos deben ser únicos.
    partialFilterExpression: { 'publicProfile.shareId': { $type: 'string' } }
  }
);

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
    // Incluir criterios de evaluación en la serialización (siempre devolver array)
    evaluationCriteria: this.evaluationCriteria || [],
    // Meta de calificación objetivo (fallback preventivo)
    metaCalificacion: this.metaCalificacion ?? 70,
    publicProfile: {
      enabled: !!this.publicProfile?.enabled,
      shareId: this.publicProfile?.shareId || null,
      sharedAt: this.publicProfile?.sharedAt || null
    }
  };
};

module.exports = mongoose.model('Materia', materiaSchema);
