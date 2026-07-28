// backend/src/services/semantic/core/InMemoryVectorIndex.js

const { cosineSimilarity } = require('./cosineSimilarity');

class InMemoryVectorIndex {
  constructor() {
    this.store = new Map();
    this.dimension = null;
  }

  insert(items) {
    for (const item of items) {
      if (this.store.has(item.id)) {
        throw new Error(`ID duplicado en índice semántico: ${item.id}`);
      }

      if (!Array.isArray(item.vector) || item.vector.length === 0) {
        throw new Error(`Vector inválido para ID ${item.id}:Debe ser un arreglo no vacío.`);
      }

      // Validación estricta de números finitos
      for (const val of item.vector) {
        if (!Number.isFinite(val)) {
          throw new Error(`Vector inválido para ID ${item.id}: Contiene NaN o Infinity.`);
        }
      }

      if (this.dimension === null) {
        this.dimension = item.vector.length;
      } else if (item.vector.length !== this.dimension) {
        throw new Error(`Dimensión de vector inválida. Esperada: ${this.dimension}, Recibida: ${item.vector.length}`);
      }

      this.store.set(item.id, { vector: item.vector, metadata: item.metadata });
    }
  }

  remove(id) {
    this.store.delete(id);
  }

  clear() {
    this.store.clear();
    this.dimension = null;
  }

  similarity(idA, idB) {
    const itemA = this.store.get(idA);
    const itemB = this.store.get(idB);
    if (!itemA || !itemB) return 0;
    return cosineSimilarity(itemA.vector, itemB.vector);
  }

  getNeighbors(id, threshold) {
    const target = this.store.get(id);
    if (!target) return [];

    const neighbors = [];
    for (const [currentId, currentData] of this.store.entries()) {
      if (currentId === id) continue;
      const sim = cosineSimilarity(target.vector, currentData.vector);
      if (sim >= threshold) {
        neighbors.push({ id: currentId, similarity: sim });
      }
    }
    return neighbors.sort((a, b) => b.similarity - a.similarity);
  }

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
