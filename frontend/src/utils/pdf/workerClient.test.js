import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPdfInWorker } from './workerClient.js';

test('activa el fallback cuando Worker no está disponible', async () => {
  const previousWorker = globalThis.Worker;
  try {
    delete globalThis.Worker;
    await assert.rejects(renderPdfInWorker({ documentType: 'schedule' }), (error) => error.name === 'PdfWorkerError');
  } finally {
    if (previousWorker) globalThis.Worker = previousWorker;
  }
});

test('envía cancelación al worker y rechaza con AbortError', async () => {
  const previousWorker = globalThis.Worker;
  let receivedCancel = false;
  let terminated = false;
  class FakeWorker {
    postMessage(message) {
      if (message.type === 'cancel') receivedCancel = true;
    }
    terminate() { terminated = true; }
  }
  globalThis.Worker = FakeWorker;
  try {
    const controller = new AbortController();
    const promise = renderPdfInWorker({ documentType: 'schedule' }, { signal: controller.signal });
    controller.abort();
    await assert.rejects(promise, (error) => error.name === 'AbortError');
    assert.equal(receivedCancel, true);
    assert.equal(terminated, true);
  } finally {
    if (previousWorker) globalThis.Worker = previousWorker;
    else delete globalThis.Worker;
  }
});
