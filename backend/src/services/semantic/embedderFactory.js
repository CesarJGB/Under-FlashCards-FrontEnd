// backend/src/services/semantic/embedderFactory.js
const { OpenAIEmbedder } = require('./providers/OpenAIEmbedder');

/**
 * Fábrica de proveedores de embeddings.
 * Aísla al controlador de los detalles de infraestructura del proveedor.
 */
function createSemanticEmbedder() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('MISSING_OPENAI_API_KEY');
  }
  return new OpenAIEmbedder(apiKey);
}

module.exports = { createSemanticEmbedder };
