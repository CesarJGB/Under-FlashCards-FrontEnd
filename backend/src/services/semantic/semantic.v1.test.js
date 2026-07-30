// backend/src/services/semantic/semantic.v1.test.js

const assert = require('assert');
const { InMemoryVectorIndex } =
  require('./core/InMemoryVectorIndex');
const { cosineSimilarity } =
  require('./core/cosineSimilarity');
const { resolveDuplicates } =
  require('./algorithms/DuplicateResolver');
const { selectDiverse } =
  require('./algorithms/DiversitySelector');
const {
  calculateQualityScore,
  createLexicalContext
} = require('./qualityScorer');

function legacySelectDiverse({ index, cards, targetCount, lambda = 0.7 }) {
  if (!Number.isInteger(targetCount) || targetCount < 0) {
    throw new Error('targetCount debe ser un entero positivo.');
  }
  if (!Number.isFinite(lambda) || lambda < 0 || lambda > 1) {
    throw new Error('lambda debe ser un número entre 0 y 1.');
  }
  if (cards.length <= targetCount) return cards.map(card => card.id);

  const selected = [];
  const available = new Map(cards.map(card => [card.id, card]));

  let bestFirstCard = null;
  let maxScore = -Infinity;
  for (const card of cards) {
    const score = card.qualityScore ?? 1.0;
    if (score > maxScore) {
      maxScore = score;
      bestFirstCard = card;
    }
  }
  if (!bestFirstCard) return [];

  selected.push(bestFirstCard.id);
  available.delete(bestFirstCard.id);

  while (selected.length < targetCount && available.size > 0) {
    let bestCandidateId = null;
    let bestMmrScore = -Infinity;

    for (const [candidateId, candidate] of available.entries()) {
      let maxSimToSelected = 0;
      for (const selectedId of selected) {
        const similarity = index.similarity(candidateId, selectedId);
        if (similarity > maxSimToSelected) {
          maxSimToSelected = similarity;
        }
      }

      const relevance = candidate.qualityScore ?? 1.0;
      const mmrScore = (relevance * (1 - lambda)) - (maxSimToSelected * lambda);
      if (mmrScore > bestMmrScore) {
        bestMmrScore = mmrScore;
        bestCandidateId = candidateId;
      }
    }

    if (bestCandidateId) {
      selected.push(bestCandidateId);
      available.delete(bestCandidateId);
    } else {
      break;
    }
  }

  return selected;
}

function createDeterministicCards(size, seed = 12345) {
  let state = seed >>> 0;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };

  return Array.from({ length: size }, (_, index) => ({
    id: 'card_' + index,
    qualityScore: ((index * 37 + seed) % 101) / 100,
    vector: Array.from({ length: 8 }, () => next() * 2 - 1)
  }));
}

function testMmrEquivalence() {
  for (const size of [100, 120, 500, 1000]) {
    const cards = createDeterministicCards(size, size + 17);
    const targetBelowN = size === 1000 ? 120 : Math.floor(size / 2);

    for (const lambda of [0, 0.7, 1]) {
      for (const targetCount of [0, 1, targetBelowN, size]) {
        const legacyIndex = new InMemoryVectorIndex();
        const optimizedIndex = new InMemoryVectorIndex();
        legacyIndex.insert(cards);
        optimizedIndex.insert(cards);

        const expected = legacySelectDiverse({
          index: legacyIndex,
          cards,
          targetCount,
          lambda
        });
        const actual = selectDiverse({
          index: optimizedIndex,
          cards,
          targetCount,
          lambda
        });

        assert.deepStrictEqual(
          actual,
          expected,
          'MMR no equivalente para N=' + size +
            ', lambda=' + lambda +
            ', target=' + targetCount
        );
      }
    }
  }
}

function testMmrTiesAndIdenticalVectors() {
  const tieCards = [
    { id: 'A', qualityScore: 0.5, vector: [1, 0] },
    { id: 'B', qualityScore: 0.5, vector: [0, 1] },
    { id: 'C', qualityScore: 0.5, vector: [0, -1] }
  ];
  const tieIndex = new InMemoryVectorIndex();
  tieIndex.insert(tieCards);
  assert.deepStrictEqual(
    selectDiverse({ index: tieIndex, cards: tieCards, targetCount: 2, lambda: 0.7 }),
    ['A', 'B'],
    'El desempate exacto debe conservar la primera aparición'
  );

  const identicalCards = [
    { id: 'A', qualityScore: 0.8, vector: [1, 0] },
    { id: 'B', qualityScore: 0.8, vector: [1, 0] },
    { id: 'C', qualityScore: 0.7, vector: [0, 1] }
  ];
  const identicalIndex = new InMemoryVectorIndex();
  identicalIndex.insert(identicalCards);
  assert.deepStrictEqual(
    selectDiverse({
      index: identicalIndex,
      cards: identicalCards,
      targetCount: 2,
      lambda: 0.7
    }),
    ['A', 'C'],
    'MMR debe penalizar la tarjeta idéntica'
  );
}

function testVectorIndexContracts() {
  const index = new InMemoryVectorIndex();
  assert.throws(
    () => index.insert([{ id: 'nan', vector: [0.4, NaN, 0.2] }]),
    /NaN o Infinity/
  );
  assert.throws(
    () => index.insert([{ id: 'inf', vector: [0.4, Infinity, 0.2] }]),
    /NaN o Infinity/
  );
  assert.throws(
    () => index.insert([{ id: 'empty', vector: [] }]),
    /arreglo no vacío/
  );

  index.insert([
    { id: 'A', vector: [1, 0] },
    { id: 'B', vector: [0.99, 0.01] },
    { id: 'C', vector: [0, 1] }
  ]);

  assert.strictEqual(cosineSimilarity([0, 0], [1, 0]), 0);
  assert.strictEqual(
    index.similarity('A', 'B'),
    cosineSimilarity([1, 0], [0.99, 0.01]),
    'La similitud cacheada debe conservar el resultado público'
  );
  assert.strictEqual(index.similarity('missing', 'A'), 0);
  assert.deepStrictEqual(index.getNeighbors('missing', 0.5), []);
  assert.deepStrictEqual(index.getKNearest('missing', 2), []);

  assert.deepStrictEqual(
    index.getNeighbors('A', 0.9).map(neighbor => neighbor.id),
    ['B']
  );
  assert.deepStrictEqual(
    index.getKNearest('A', 2).map(neighbor => neighbor.id),
    ['B', 'C']
  );
  assert.ok(index.comparisonCount > 0);

  const zeroIndex = new InMemoryVectorIndex();
  zeroIndex.insert([
    { id: 'zero', vector: [0, 0] },
    { id: 'unit', vector: [1, 0] }
  ]);
  assert.strictEqual(zeroIndex.similarity('zero', 'unit'), 0);
  assert.deepStrictEqual(zeroIndex.getNeighbors('zero', 0), [
    { id: 'unit', similarity: 0 }
  ]);

  const tieNeighborIndex = new InMemoryVectorIndex();
  tieNeighborIndex.insert([
    { id: 'target', vector: [1, 0] },
    { id: 'first', vector: [0, 1] },
    { id: 'second', vector: [0, -1] }
  ]);
  assert.deepStrictEqual(
    tieNeighborIndex.getKNearest('target', 2).map(neighbor => neighbor.id),
    ['first', 'second'],
    'Los empates de vecinos deben conservar la aparición'
  );

  index.clear();
  assert.strictEqual(index.dimension, null);
  assert.strictEqual(index.comparisonCount, 0);
  assert.strictEqual(index.similarity('A', 'B'), 0);

  const dimensionIndex = new InMemoryVectorIndex();
  dimensionIndex.insert([{ id: 'one', vector: [1, 0, 0] }]);
  assert.throws(
    () => dimensionIndex.insert([{ id: 'two', vector: [1, 0] }]),
    /Dimensión/
  );
}

function testDuplicateResolver() {
  const index = new InMemoryVectorIndex();
  const cards = [
    { id: 'A', qualityScore: 0.9, vector: [1, 0] },
    { id: 'B', qualityScore: 0.8, vector: [0.99, 0.01] }
  ];
  index.insert(cards);
  const survivors = resolveDuplicates({ index, cards, threshold: 0.92 });
  assert.deepStrictEqual(survivors, ['A']);
  assert.strictEqual(index.similarity('A', 'B'), 0);
}

function testQualityScorer() {
  const segmentText = 'El fármaco X cura la enfermedad Y. CO₂ y Na+ son importantes.';
  const sourceEvidence = 'cura la enfermedad Y';
  const lexicalContext = createLexicalContext(segmentText);

  const baseArgs = {
    question: '¿Qué cura el fármaco X?',
    answer: 'La enfermedad Y.',
    sourceEvidence,
    status: 'sin_cambios',
    segmentText
  };
  const withoutContext = calculateQualityScore(baseArgs);
  const withContext = calculateQualityScore({
    ...baseArgs,
    lexicalContext
  });
  assert.deepStrictEqual(
    withContext,
    withoutContext,
    'El contexto léxico debe ser equivalente al cálculo original'
  );

  const beforeSize = lexicalContext.size;
  calculateQualityScore({
    ...baseArgs,
    sourceEvidence: 'una evidencia exclusiva distinta',
    lexicalContext
  });
  assert.strictEqual(
    lexicalContext.size,
    beforeSize,
    'El scorer no debe mutar el Set compartido'
  );

  const emptyContextResult = calculateQualityScore({
    question: 'Pregunta',
    answer: 'Respuesta',
    status: 'sin_cambios',
    segmentText: '',
    sourceEvidence: '',
    lexicalContext: new Set()
  });
  assert.strictEqual(emptyContextResult.breakdown.sourceCoverageScore, 0.8);
  assert.strictEqual(emptyContextResult.breakdown.coverageVerified, false);

  const whitespaceEvidence = calculateQualityScore({
    question: 'Pregunta',
    answer: 'Respuesta',
    status: 'sin_cambios',
    segmentText: '',
    sourceEvidence: '   ',
    lexicalContext: new Set()
  });
  assert.strictEqual(whitespaceEvidence.breakdown.sourceCoverageScore, 0);
  assert.strictEqual(whitespaceEvidence.breakdown.coverageVerified, true);
}

function runTests() {
  console.log('Iniciando pruebas deterministas de la V1 semántica...');
  testMmrEquivalence();
  testMmrTiesAndIdenticalVectors();
  testVectorIndexContracts();
  testDuplicateResolver();
  testQualityScorer();
  console.log('Todas las pruebas deterministas de la V1 pasaron.');
}

runTests();
