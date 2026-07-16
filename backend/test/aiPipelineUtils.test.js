const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildGenerationBatches,
  calculateTargetPadding,
  chunkSourceText,
  selectDocumentsAcrossChunks,
} = require('../src/utils/aiSourceChunks');
const { createConcurrencyLimiter, mapWithConcurrency } = require('../src/utils/concurrency');
const { getTokenUsage, validateCards } = require('../src/services/aiService');

test('chunkSourceText preserves page markers and respects the configured segment length', () => {
  const source = [
    '--- [Texto de la Pagina 1] ---\nLa primera idea tiene contexto suficiente. La segunda idea mantiene el tema.',
    '--- [Texto de la Pagina 2] ---\nLa tercera idea pertenece a otra seccion. La cuarta idea cierra la pagina.',
    '--- [Texto de la Pagina 3] ---\nLa quinta idea cubre un concepto final. La sexta idea aporta un ejemplo.',
  ].join('\n');

  const chunks = chunkSourceText(source, 3, 100);

  assert.ok(chunks.length >= 3);
  assert.ok(chunks.every((chunk) => chunk.length <= 100));
  const reconstructed = chunks.join(' ').replace(/\s+/g, ' ');
  assert.match(reconstructed, /Texto de la Pagina 1/);
  assert.match(reconstructed, /Texto de la Pagina 2/);
  assert.match(reconstructed, /Texto de la Pagina 3/);
  assert.match(reconstructed, /concepto final/);
});

test('chunkSourceText keeps short documents intact instead of creating unusable fragments', () => {
  const source = 'Un concepto corto con una definicion y un ejemplo sencillo.';
  const chunks = chunkSourceText(source, 10, 30000);

  assert.deepEqual(chunks, [source]);
});

test('buildGenerationBatches covers every long-document segment without exceeding the batch size', () => {
  const source = Array.from({ length: 10 }, (_, index) => (
    `--- [Texto de la Pagina ${index + 1}] ---\n${'Contenido academico relevante. '.repeat(5)}`
  )).join('\n');

  const plan = buildGenerationBatches(source, 4, 2, 80);

  assert.ok(plan.sourceChunks.length > 4);
  assert.equal(plan.candidateTarget, plan.sourceChunks.length);
  assert.equal(plan.batches.length, plan.sourceChunks.length);
  assert.ok(plan.batches.every((batch) => batch.targetCount === 1));
  assert.ok(plan.batches.every((batch) => batch.targetCount <= 2));
  assert.deepEqual(
    plan.batches.map((batch) => batch.sourceChunkIndex),
    Array.from({ length: plan.sourceChunks.length }, (_, index) => index + 1)
  );
});

test('calculateTargetPadding scales its per-batch margin with the padded batch count', () => {
  assert.deepEqual(
    calculateTargetPadding(520, 12, { factor: 0.30, maximum: 80, perBatch: 1 }),
    { padding: 80, batchCount: 50 }
  );
  assert.deepEqual(
    calculateTargetPadding(520, 12, { factor: 0, maximum: 80, perBatch: 1 }),
    { padding: 48, batchCount: 48 }
  );
});

test('selectDocumentsAcrossChunks spreads a small deck across document coverage', () => {
  const byChunk = new Map([
    [1, [{ id: 'one' }]],
    [2, [{ id: 'two' }]],
    [3, [{ id: 'three' }]],
    [4, [{ id: 'four' }]],
    [5, [{ id: 'five' }]],
  ]);

  assert.deepEqual(
    selectDocumentsAcrossChunks(byChunk, 2).map((document) => document.id),
    ['one', 'five']
  );
});

test('selectDocumentsAcrossChunks round-robins when the deck needs several cards per segment', () => {
  const byChunk = new Map([
    [1, [{ id: 'one-a' }, { id: 'one-b' }]],
    [2, [{ id: 'two-a' }, { id: 'two-b' }]],
    [3, [{ id: 'three-a' }, { id: 'three-b' }]],
  ]);

  assert.deepEqual(
    selectDocumentsAcrossChunks(byChunk, 5).map((document) => document.id),
    ['one-a', 'two-a', 'three-a', 'one-b', 'two-b']
  );
});

test('mapWithConcurrency respects the configured worker limit and preserves input order', async () => {
  let activeWorkers = 0;
  let maximumActiveWorkers = 0;

  const results = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
    activeWorkers += 1;
    maximumActiveWorkers = Math.max(maximumActiveWorkers, activeWorkers);
    await new Promise((resolve) => setTimeout(resolve, 5));
    activeWorkers -= 1;
    return value * 2;
  });

  assert.deepEqual(results, [2, 4, 6, 8, 10]);
  assert.ok(maximumActiveWorkers <= 2);
  assert.equal(maximumActiveWorkers, 2);
});

test('createConcurrencyLimiter queues work globally and removes canceled waiters', async () => {
  const limiter = createConcurrencyLimiter(1);
  const releaseFirst = await limiter.acquire();
  const controller = new AbortController();
  const queued = limiter.acquire({ signal: controller.signal });

  controller.abort();
  await assert.rejects(queued, { name: 'AbortError' });

  let secondStarted = false;
  const second = limiter.acquire().then((release) => {
    secondStarted = true;
    release();
  });
  assert.equal(secondStarted, false);

  releaseFirst();
  await second;
  assert.equal(secondStarted, true);
});

test('getTokenUsage normalizes provider token counters', () => {
  assert.deepEqual(
    getTokenUsage({ usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 } }),
    { promptTokens: 11, completionTokens: 7, totalTokens: 18 }
  );
  assert.equal(getTokenUsage({}), null);
});

test('validateCards caps provider output and rejects invalid card fields', () => {
  const cards = [
    { question: 'Uno', answer: 'Respuesta uno' },
    { question: 'Dos', answer: 'Respuesta dos' },
    { question: 'Tres', answer: 'Respuesta tres' },
  ];

  assert.deepEqual(validateCards(cards, 2), cards.slice(0, 2));
  assert.throws(
    () => validateCards([{ question: 1, answer: 'Respuesta' }], 1),
    /formato/
  );
  assert.throws(
    () => validateCards([{ question: 'Pregunta', answer: 'Respuesta', status: 'desconocida' }], 1, { requireStatus: true }),
    /formato/
  );
  assert.throws(
    () => validateCards(cards.slice(0, 1), 2, { requireExactCount: true }),
    /cantidad/
  );
});
