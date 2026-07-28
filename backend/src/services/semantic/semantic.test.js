// backend/src/services/semantic/semantic.test.js

const assert = require('assert');
const { InMemoryVectorIndex } = require('./core/InMemoryVectorIndex');
const { cosineSimilarity } = require('./core/cosineSimilarity');
const { resolveDuplicates } = require('./algorithms/DuplicateResolver');
const { selectDiverse } = require('./algorithms/DiversitySelector');

function runTests() {
  console.log('Iniciando tests de Fase 1 y 2...');

  // --- Tests Fase 1 (Resumidos) ---
  const index = new InMemoryVectorIndex();
  assert.throws(() => index.insert([{ id: 'bad', vector: [0.4, NaN, 0.2] }]), /NaN o Infinity/, 'Bloquea NaN');
  index.clear();
  console.log('✓ Fase 1: Infraestructura matemática validada.');

  // --- Tests Fase 2: Algoritmos ---
  
  // Escenario:
  // A (farma, score 0.8) y B (farma, score 0.9) son duplicados.
  // C (foto, score 0.5) y D (foto, score 0.5) son ortogonales a A/B.
  const cards = [
    { id: 'sem_0', vector: [1, 0, 0], qualityScore: 0.8 }, // A
    { id: 'sem_1', vector: [0.99, 0.01, 0], qualityScore: 0.9 }, // B (Mejor que A)
    { id: 'sem_2', vector: [0, 1, 0], qualityScore: 0.5 }, // C
    { id: 'sem_3', vector: [0, 0.95, 0.05], qualityScore: 0.5 }  // D
  ];
  
  index.insert(cards);

  // Test DuplicateResolver
  const survivors = resolveDuplicates({ index, cards, threshold: 0.92 });
  assert.strictEqual(survivors.length, 3, 'Deben sobrevivir 3 tarjetas (1 duplicado eliminado)');
  assert.ok(!survivors.includes('sem_0'), 'sem_0 (score 0.8) debe ser eliminado por sem_1 (score 0.9)');
  assert.ok(survivors.includes('sem_1'), 'sem_1 debe sobrevivir');
  assert.strictEqual(index.similarity('sem_0', 'sem_1'), 0, 'sem_0 debe haber sido removido del índice');
  console.log('✓ Fase 2: DuplicateResolver funciona (calidad > similitud).');

  // Test DiversitySelector (MMR)
  // Pedimos 2 tarjetas. Debe elegir sem_1 (farma) y una de foto (sem_2 o sem_3).
  // sem_2 y sem_3 son idénticos en calidad, MMR elegirá uno al azar o por orden de iteración.
  const selectedIds = selectDiverse({ index, cards: survivors.map(id => cards.find(c => c.id === id)), targetCount: 2, lambda: 0.7 });
  assert.strictEqual(selectedIds.length, 2, 'Debe seleccionar exactamente 2');
  assert.ok(selectedIds.includes('sem_1'), 'La mejor tarjeta (sem_1) debe estar en la selección');
  
  // Verificar que no eligió dos de fotosíntesis si quedaron vivas ambas
  const hasFoto = selectedIds.includes('sem_2') || selectedIds.includes('sem_3');
  assert.ok(hasFoto, 'Debe incluir una tarjeta de fotosíntesis por diversidad');
  
  // Caso extremo: pedir más de las disponibles
  const overSelection = selectDiverse({ index, cards: survivors.map(id => cards.find(c => c.id === id)), targetCount: 10 });
  assert.strictEqual(overSelection.length, 3, 'Si pide más de los disponible, devuelve todos los disponibles');
  console.log('✓ Fase 2: DiversitySelector (MMR) funciona correctamente.');

  console.log('\nTodos los tests pasaron exitosamente.');
}

runTests();
