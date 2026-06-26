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

module.exports = mongoose.model('Tema', temaSchema);
