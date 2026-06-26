// backend/src/models/subdocuments/KnowledgeMetrics.js
const mongoose = require('mongoose');

const knowledgeMetricsSchema = new mongoose.Schema({
  accuracy: { type: Number, default: 0, min: 0, max: 1 },       // Tasa de aciertos (0.0 a 1.0)
  speed: { type: Number, default: 0 },                          // Tiempo promedio de respuesta en ms
  reviews: { type: Number, default: 0 },                        // Volumen total de repasos en este nodo
  mastery: { type: Number, default: 0, min: 0, max: 100 },      // Porcentaje evolutivo final (0 - 100)
  confidence: { type: Number, default: 0, min: 0, max: 5 },     // Nivel de certeza autopercibido promedio
  difficulty: { type: Number, default: 0, min: 0, max: 1 },     // Fricción real del contenido (0.0 a 1.0)
  lastReview: { type: Date, default: null },                    // Timestamp del último repaso (Curva de olvido)
  knowledgeScore: { type: Number, default: 0 }                  // Puntuación matemática pura para ordenamientos
}, { _id: false }); // _id false porque es un objeto embebido atómico

module.exports = knowledgeMetricsSchema;
