// backend/src/models/Materia.js
const mongoose = require('mongoose');
const knowledgeMetricsSchema = require('./subdocuments/KnowledgeMetrics');

const materiaSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    
    // Inyección del Radar de Conocimiento (Nivel Asignatura Global)
    knowledgeMetrics: {
      type: knowledgeMetricsSchema,
      default: () => ({}) // Se inicializa con los defaults del subdocumento
    }
  },
  { timestamps: true }
);

materiaSchema.index({ name: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Materia', materiaSchema);
