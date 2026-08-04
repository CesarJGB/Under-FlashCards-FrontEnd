import test from 'node:test';
import assert from 'node:assert/strict';
import { renderScheduleWithFallback } from './index.js';

test('usa el renderer del navegador cuando el worker no puede iniciar', async () => {
  const phases = [];
  let fallbackCalls = 0;
  const workerError = new Error('Worker no disponible');
  workerError.name = 'PdfWorkerError';
  const expected = { buffer: new ArrayBuffer(4), fileName: 'horario.pdf', pagesProcessed: 1 };

  const result = await renderScheduleWithFallback(
    { documentType: 'schedule', scheduleName: 'Horario' },
    { onProgress: (progress) => phases.push(progress.phase) },
    {
      renderInWorker: async () => { throw workerError; },
      loadFallbackRenderer: async () => async () => { fallbackCalls += 1; return expected; },
    }
  );

  assert.equal(result, expected);
  assert.equal(fallbackCalls, 1);
  assert.deepEqual(phases, ['fallback']);
});

test('no activa fallback si el worker fue cancelado', async () => {
  const abortError = new Error('Cancelado');
  abortError.name = 'AbortError';
  let fallbackLoaded = false;
  await assert.rejects(renderScheduleWithFallback(
    { documentType: 'schedule' },
    {},
    {
      renderInWorker: async () => { throw abortError; },
      loadFallbackRenderer: async () => { fallbackLoaded = true; return async () => ({}); },
    }
  ), (error) => error.name === 'AbortError');
  assert.equal(fallbackLoaded, false);
});
