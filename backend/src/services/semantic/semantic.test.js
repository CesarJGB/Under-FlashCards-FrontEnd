// backend/src/services/semantic/semantic.test.js

const assert = require('assert');
const { InMemoryVectorIndex } = require('./core/InMemoryVectorIndex');
const { cosineSimilarity } = require('./core/cosineSimilarity');
const { resolveDuplicates } = require('./algorithms/DuplicateResolver');
const { selectDiverse } = require('./algorithms/DiversitySelector');

function runTests() {
  console.log('Iniciando auditoría de Fase 2...');

  // 1. InMemoryVectorIndex
  const index = new InMemoryVectorIndex();
  
  assert.throws(() => index.insert([{ id: 'nan', vector: [0.4, NaN, 0.2] }]), /NaN o Infinity/, 'Debe bloquear NaN');
  assert.throws(() => index.insert([{ id: 'inf', vector: [0.4, Infinity, 0.2] }]), /NaN o Infinity/, 'Debe bloquear Infinity');
  assert.throws(() => index.insert([{ id: 'empty', vector: [] }]), /arreglo no vacío/, 'Debe bloquear vector vacío');
  
  index.clear();
  index.insert([{ id: 'dim1', vector: [1, 0, 0] }]);
  assert.throws(() => index.insert([{ id: 'dim2', vector: [1, 0] }]), /Dimensión/, 'Debe bloquear dimensión inconsistente');
  
  index.clear();
  assert.strictEqual(index.dimension, null, 'clear() debe resetear la dimensión');
  index.insert([{ id: 'new', vector: [0.5, 0.5] }]); // Debe funcionar tras clear()
  assert.strictEqual(index.dimension, 2, 'Nueva dimensión asignada correctamente tras clear()');
  console.log('✓ Validaciones de InMemoryVectorIndex correctas.');

  // 2. DuplicateResolver
  // Caso A: Score diferente
  const indexA = new InMemoryVectorIndex();
  const cardsA = [
    { id: 'A', qualityScore: 0.9, vector: [1, 0] },
    { id: 'B', qualityScore: 0.8, vector: [0.99, 0.01] } // Duplicado de A
  ];
  indexA.insert(cardsA);
  const survA = resolveDuplicates({ index: indexA, cards: cardsA, threshold: 0.92 });
  assert.ok(survA.includes('A') && !survA.includes('B'), 'Caso A: Sobrevive el de mayor score');
  assert.strictEqual(indexA.similarity('A', 'B'), 0, 'Caso A: B fue eliminado del índice');

  // Caso B: Empate exacto
  const indexB = new InMemoryVectorIndex();
  const cardsB = [
    { id: 'A', qualityScore: 0.8, vector: [1, 0] },
    { id: 'B', qualityScore: 0.8, vector: [0.99, 0.01] }
  ];
  indexB.insert(cardsB);
  const survB = resolveDuplicates({ index: indexB, cards: cardsB, threshold: 0.92 });
  assert.ok(survB.includes('A') && !survB.includes('B'), 'Caso B: En empate sobrevive la primera aparición');

  // Caso C: Undefined score
  const indexC = new InMemoryVectorIndex();
  const cardsC = [
    { id: 'A', vector: [1, 0] }, // undefined -> 1.0
    { id: 'B', qualityScore: 0.8, vector: [0.99, 0.01] }
  ];
  indexC.insert(cardsC);
  const survC = resolveDuplicates({ index: indexC, cards: cardsC, threshold: 0.92 });
  assert.ok(survC.includes('A') && !survC.includes('C'), 'Caso C: Undefined usa 1.0 por defecto y sobrevive');
  console.log('✓ DuplicateResolver determinista y validado.');

  // 3. DiversitySelector (MMR)
  // Escenario: 5 tarjetas. 3 similares (farma), 2 diferentes (foto, quim)
  const indexM = new InMemoryVectorIndex();
  const cardsM = [
    { id: 'F1', qualityScore: 0.9, vector: [1, 0, 0] },      // Grupo Farma (Mejor calidad)
    { id: 'F2', qualityScore: 0.8, vector: [0.99, 0.01, 0] }, // Grupo Farma
    { id: 'F3', qualityScore: 0.8, vector: [0.98, 0.02, 0] }, // Grupo Farma
    { id: 'Q1', qualityScore: 0.7, vector: [0, 1, 0] },      // Diferente
    { id: 'B1', qualityScore: 0.7, vector: [0, 0, 1] }       // Diferente
  ];
  indexM.insert(cardsM);
  
  const selectedM = selectDiverse({ index: indexM, cards: cardsM, targetCount: 3, lambda: 0.7 });
  assert.strictEqual(selectedM.length, 3, 'Debe seleccionar exactamente 3');
  assert.ok(selectedM[0] === 'F1', 'La primera seleccionada debe ser la de mayor calidad general');
  
  // Verificar que no eligió las 3 del mismo grupo
  const farmaSelected = selectedM.filter(id => id.startsWith('F')).length;
  assert.ok(farmaSelected < 3, 'No debe seleccionar todas del mismo grupo semántico');
  assert.ok(selectedM.includes('Q1') || selectedM.includes('B1'), 'Debe incluir elementos diversos');
  console.log('✓ DiversitySelector (MMR) prioriza diversidad correctamente.');

  // 4. Contrato de Salida
  assert.ok(selectedM.every(id => typeof id === 'string'), 'Contrato: DiversitySelector devuelve solo IDs');
  assert.ok(survA.every(id => typeof id === 'string'), 'Contrato: DuplicateResolver devuelve solo IDs');
  console.log('✓ Contratos de salida (IDs temporales) cumplidos.');

  console.log('\nAuditoría de Fase 2 finalizada con éxito. Listo para commit.');
}

runTests();
