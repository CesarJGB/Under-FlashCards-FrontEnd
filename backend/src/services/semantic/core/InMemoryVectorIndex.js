// backend/src/services/semantic/core/InMemoryVectorIndex.js

class InMemoryVectorIndex {
  constructor() {
    this.store = new Map();
    this.dimension = null;
    this.comparisonCount = 0;
  }

  /**
   * @param {Array<{id: string, vector: number[], metadata?: unknown}>} items
   */
  insert(items) {
    for (const item of items) {
      if (!item || !item.id) throw new Error("Item inválido: falta ID.");
      if (this.store.has(item.id)) {
        throw new Error(`ID duplicado en índice semántico: ${item.id}`);
      }
      if (!Array.isArray(item.vector) || item.vector.length === 0) {
        throw new Error(`Vector inválido para ID ${item.id}: debe ser un arreglo no vacío.`);
      }

      let magnitudeSquared = 0;
      for (const val of item.vector) {
        if (!Number.isFinite(val)) {
          throw new Error(`Vector inválido para ID ${item.id}: contiene NaN o Infinity.`);
        }
        magnitudeSquared += val * val;
      }

      if (this.dimension === null) {
        this.dimension = item.vector.length;
      } else if (item.vector.length !== this.dimension) {
        throw new Error(
          `Dimensión de vector inválida. Esperada: ${this.dimension}, Recibida: ${item.vector.length}`
        );
      }

      this.store.set(item.id, {
        vector: item.vector,
        metadata: item.metadata,
        magnitude: Math.sqrt(magnitudeSquared)
      });
    }
  }

  _similarityOptimized(vecA, magA, vecB, magB) {
    this.comparisonCount += 1;

    if (magA === 0 || magB === 0) {
      return 0;
    }

    let dotProduct = 0;
    for (let i = 0; i < vecA.length; i += 1) {
      dotProduct += vecA[i] * vecB[i];
    }

    const rawSimilarity = dotProduct / (magA * magB);
    return Math.max(0, Math.min(1, rawSimilarity));
  }

  remove(id) {
    this.store.delete(id);
  }

  /**
   * Reinicia completamente el índice.
   * Borra los vectores almacenados y permite iniciar un nuevo espacio vectorial.
   */
  clear() {
    this.store.clear();
    this.dimension = null;
    this.comparisonCount = 0;
  }

  similarity(idA, idB) {
    const itemA = this.store.get(idA);
    const itemB = this.store.get(idB);
    if (!itemA || !itemB) return 0;
    return this._similarityOptimized(
      itemA.vector,
      itemA.magnitude,
      itemB.vector,
      itemB.magnitude
    );
  }

  getNeighbors(id, threshold) {
    const target = this.store.get(id);
    if (!target) return [];

    const neighbors = [];
    for (const [currentId, currentData] of this.store.entries()) {
      if (currentId === id) continue;
      const sim = this._similarityOptimized(
        target.vector,
        target.magnitude,
        currentData.vector,
        currentData.magnitude
      );
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
      const sim = this._similarityOptimized(
        target.vector,
        target.magnitude,
        currentData.vector,
        currentData.magnitude
      );
      allNeighbors.push({ id: currentId, similarity: sim });
    }
    return allNeighbors.sort((a, b) => b.similarity - a.similarity).slice(0, k);
  }
}

module.exports = { InMemoryVectorIndex };

