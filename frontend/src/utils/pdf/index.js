import { getPdfExport } from './constants';
import { savePdfBuffer } from './download';
import { validateDeckImageBudget } from './images';
import { renderPdfInWorker } from './workerClient';

function isAbortError(error) {
  return error?.name === 'AbortError';
}

function createAbortError() {
  const error = new Error('La exportación fue cancelada.');
  error.name = 'AbortError';
  return error;
}

function awaitWithAbort(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(createAbortError());

  return new Promise((resolve, reject) => {
    const handleAbort = () => {
      cleanup();
      reject(createAbortError());
    };
    const cleanup = () => signal.removeEventListener('abort', handleAbort);

    signal.addEventListener('abort', handleAbort, { once: true });
    promise.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error) => {
        cleanup();
        reject(error);
      }
    );
  });
}

export async function exportDeckToPDF(deckTitle, cards, type = 'guide', options = {}) {
  if (!getPdfExport(type)) {
    throw new Error('El formato de exportación solicitado no es válido.');
  }

  validateDeckImageBudget(cards || []);

  const payload = { deckTitle, cards, type };
  let result;

  try {
    result = await renderPdfInWorker(payload, options);
  } catch (workerError) {
    if (isAbortError(workerError)) throw workerError;
    if (workerError?.name !== 'PdfWorkerError') throw workerError;

    options.onProgress?.({
      phase: 'fallback',
      current: 0,
      total: cards?.length || 0,
      message: 'Usando el modo de compatibilidad del navegador...',
    });
    const { renderPdf } = await awaitWithAbort(import('./renderPdf'), options.signal);
    if (options.signal?.aborted) throw createAbortError();
    result = await renderPdf({ ...payload, ...options });
  }

  savePdfBuffer(result.buffer, result.fileName);
  return result;
}
