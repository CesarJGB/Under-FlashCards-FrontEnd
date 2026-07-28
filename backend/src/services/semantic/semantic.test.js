// backend/src/services/semantic/semantic.test.js

const assert = require('assert');
const { InMemoryVectorIndex } = require('./core/InMemoryVectorIndex');
const { cosineSimilarity } = require('./core/cosineSimilarity');

function runTests() {
  console.log('Iniciando tests de Fase 1...');

  // 1. cosineSimilarity
  assert.strictEqual(cosineSimilarity([1, 0], [1, 0]), 1, 'Idénticos -> 1');
  assert.strictEqual(cosineSimilarity([1, 0], [0, 1]), 0, 'Ortogonales -> 0');
  assert.strictEqual(cosineSimilarity([0, 0], [1, 1]), 0, 'Vector cero -> 0');
  assert.strictEqual(cosineSimilarity([1, 0], [-1, 0]), 0, 'Opuestos -> 0 (normalizado)');
  assert.throws(() => cosineSimilarity([1, 0], [1, 1]), /dimensión/, 'Distinta dimensión lanza error');
  console.log('✓ cosineSimilarity validado.');

  // 2. InMemoryVectorIndex
  const index = new InMemoryVectorIndex();
  
  const items = [
    { id: 'sem_0', vector: [1, 0, 0], metadata: { text: 'farma' } },
    { id: 'sem_1', vector: [0.99, 0.01, 0], metadata: { text: 'farma' } },
    { id: 'sem_2', vector: [0, 1, 0], metadata: { text: 'foto' } }
  ];
  index.insert(items);

  // Validaciones de inserción
  assert.throws(() => index.insert([{ id: 'sem_0', vector: [1, 0, 0] }]), /ID duplicado/, 'ID duplicado lanza error');
  assert.throws(() => index.insert([{ id: 'sem_bad', vector: [1, 1] }]), /Dimensión/, 'Dimensión incorrecta lanza error');
  console.log('✓ Inserciones inválidas bloqueadas.');

  // Similitud directa
  assert.ok(index.similarity('sem_0', 'sem_1') > 0.99, 'Similitud directa alta');
  assert.strictEqual(index.similarity('sem_0', 'sem_2'), 0, 'Similitud directa cero');
  assert.strictEqual(index.similarity('sem_0', 'non_existent'), 0, 'Similitud con inexistente -> 0');
  console.log('✓ similarity() validado.');

  // getNeighbors
  const neighbors = index.getNeighbors('sem_0', 0.50);
  assert.strictEqual(neighbors.length, 1, 'sem_0 tiene 1 vecino (sem_1)');
  assert.strictEqual(neighbors[0].id, 'sem_1', 'El vecino es sem_1');
  console.log('✓ getNeighbors() validado.');

  // getKNearest
  const kNearest = index.getKNearest('sem_2', 1);
  assert.strictEqual(kNearest.length, 1, 'sem_2 tiene 1 KNearest');
  assert.strictEqual(kNearest[0].id, 'sem_1', 'El KNearest es sem_1');
  console.log('✓ getKNearest() validado.');

  // remove y efecto en consultas
  index.remove('sem_1');
  assert.strictEqual(index.getNeighbors('sem_0', 0.50).length, 0, 'Tras remove, sem_0 no tiene vecinos.');
  assert.strictEqual(index.similarity('sem_0', 'sem_1'), 0, 'Tras remove, similitud es 0.');
  console.log('✓ remove() validado.');

  console.log('\nTodos los tests de Fase 1 pasaron exitosamente.');
}

runTests();
