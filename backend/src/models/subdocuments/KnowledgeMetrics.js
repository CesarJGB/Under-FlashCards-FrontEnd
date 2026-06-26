
// backend/src/models/subdocuments/KnowledgeMetrics.js
const mongoose = require('mongoose');

const knowledgeMetricsSchema = new mongoose.Schema({
  accuracy: { type: Number, default: 0, min: 0, max: 1 },       // Tasa de aciertos (0.0 a 1.0)
  speed: { type: Number, default: 0 },                          // Fluidez (ms promedio de respuesta)
  reviews: { type: Number, default: 0 },                        // Volumen total de repasos acumulados
  mastery: { type: Number, default: 0, min: 0, max: 100 },      // % final calculado (Acentuación SaaS)
  confidence: { type: Number, default: 0, min: 0, max: 5 },     // Certeza autopercibida (Escala SM2)
  difficulty: { type: Number, default: 0, min: 0, max: 1 },     // Fricción real (0.0 a 1.0)
  lastReview: { type: Date, default: null },                    // Curva del Olvido
  knowledgeScore: { type: Number, default: 0 }                  // Puntuación absoluta de ordenamiento
}, { _id: false }); // Desactivamos el _id interno para que actúe como un objeto plano embebido

module.exports = knowledgeMetricsSchema;
