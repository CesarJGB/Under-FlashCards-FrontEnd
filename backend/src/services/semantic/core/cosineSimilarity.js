// backend/src/services/semantic/core/cosineSimilarity.js

/**
 * Calcula la similitud coseno entre dos vectores y la normaliza al rango [0, 1].
 * 
 * @param {number[]} vecA 
 * @param {number[]} vecB 
 * @returns {number} Similitud entre 0 y 1.
 */
function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error('Los vectores deben tener la misma dimensión.');
  }

  let dotProduct = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }

  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);

  if (magA === 0 || magB === 0) {
    return 0; // Vector nulo, no hay similitud direccional.
  }

  const rawSimilarity = dotProduct / (magA * magB);
  
  // Normalización estricta a [0, 1] para evitar negativos o errores de float > 1
  return Math.max(0, Math.min(1, rawSimilarity));
}

module.exports = { cosineSimilarity };
