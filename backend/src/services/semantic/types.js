// backend/src/services/semantic/types.js

/**
 * @typedef {Object} IndexedItem
 * @property {string} id - ID temporal único (ej. "semantic_0").
 * @property {number[]} vector - El vector denso del embedding.
 * @property {unknown} [metadata] - Metadata opcional para depuración.
 */

/**
 * @typedef {Object} Neighbor
 * @property {string} id - ID del vecino encontrado.
 * @property {number} similarity - Similitud coseno normalizada (0 a 1).
 */

/**
 * Contrato conceptual para proveedores de embeddings (Duck Typing).
 * @typedef {Object} EmbeddingProvider
 * @property {(texts: string[], signal?: AbortSignal) => Promise<number[][]>} embed
 */

module.exports = {};
