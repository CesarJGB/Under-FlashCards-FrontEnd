// backend/src/services/semantic/core/InMemoryVectorIndex.js

const { cosineSimilarity } = require('./cosineSimilarity');

class InMemoryVectorIndex {
  constructor() {
    /** @type {Map<string, { vector: number[], metadata?: unknown }>} */
    this.store = new Map();
    /** @type {number | null} */
    this.dimension = null;
  }

  /**
   * @param {IndexedItem[]} items 
   */
  insert(items) {
    for (const item of items) {
      if (this.store.has(item.id)) {
        throw new Error(`ID duplicado en índice semántico: ${item.id}`);
      }

      if (this.dimension === null) {
        this.dimension = item.vector.length;
      } else if (item.vector.length !== this.dimension) {
        throw new Error(
          `Dimensión de vector inválida. Esperada: ${this.dimension}, Recibida: ${item.vector.length}`
        );
      }

      this.store.set(item.id, { vector: item.vector, metadata: item.metadata });
    }
  }

  /**
   * @param {string} id 
   */
  remove(id) {
    this.store.delete(id);
  }

  /**
   * @param {string} idA 
   * @param {string} idB 
   * @returns {number} Similitud [0, 1]
   */
  similarity(idA, idB) {
    const itemA = this.store.get(idA);
    const itemB = this.store.get(idB);
    
    if (!itemA || !itemB) {
      return 0;
    }
    
    return cosineSimilarity(itemA.vector, itemB.vector);
  }

  /**
   * @param {string} id 
   * @param {number} threshold 
   * @returns {Neighbor[]}
   */
  getNeighbors(id, threshold) {
    const target = this.store.get(id);
    if (!target) return [];

    const neighbors = [];
    for (const [currentId, currentData] of this.store.entries()) {
      if (currentId === id) continue; // Excluirse a sí mismo

      const sim = cosineSimilarity(target.vector, currentData.vector);
      if (sim >= threshold) {
        neighbors.push({ id: currentId, similarity: sim });
      }
    }

    return neighbors.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * @param {string} id 
   * @param {number} k 
   * @returns {Neighbor[]}
   */
  getKNearest(id, k) {
    const target = this.store.get(id);
    if (!target) return [];

    const allNeighbors = [];
    for (const [currentId, currentData] of this.store.entries()) {
      if (currentId === id) continue;

      const sim = cosineSimilarity(target.vector, currentData.vector);
      allNeighbors.push({ id: currentId, similarity: sim });
    }

    return allNeighbors.sort((a, b) => b.similarity - a.similarity).slice(0, k);
  }
}

module.exports = { InMemoryVectorIndex };
