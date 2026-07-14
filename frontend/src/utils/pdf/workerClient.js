function createAbortError() {
  const error = new Error('La exportación fue cancelada.');
  error.name = 'AbortError';
  return error;
}

function createWorkerError(message) {
  const error = new Error(message);
  error.name = 'PdfWorkerError';
  return error;
}

export function renderPdfInWorker(payload, { signal, onProgress, onWarning } = {}) {
  if (typeof Worker === 'undefined') {
    return Promise.reject(createWorkerError('Este navegador no admite la generación de PDF en segundo plano.'));
  }

  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = new Worker(new URL('./pdfExport.worker.js', import.meta.url), { type: 'module' });
    } catch {
      reject(createWorkerError('No se pudo iniciar el proceso de PDF en segundo plano.'));
      return;
    }
    const jobId = typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;
    let settled = false;

    const cleanup = () => {
      signal?.removeEventListener('abort', handleAbort);
      worker.terminate();
    };
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const handleAbort = () => {
      worker.postMessage({ type: 'cancel', jobId });
      finish(() => reject(createAbortError()));
    };

    if (signal?.aborted) {
      handleAbort();
      return;
    }

    signal?.addEventListener('abort', handleAbort, { once: true });

    worker.onmessage = (event) => {
      if (settled) return;
      const message = event.data;
      if (message.jobId !== jobId) return;

      if (message.type === 'progress') {
        onProgress?.(message.progress);
        return;
      }

      if (message.type === 'warning') {
        onWarning?.(message.warning);
        return;
      }

      if (message.type === 'complete') {
        finish(() => resolve(message.result));
        return;
      }

      if (message.type === 'error') {
        const error = new Error(message.error?.message || 'No se pudo generar el PDF en segundo plano.');
        error.name = message.error?.name || 'PdfWorkerError';
        finish(() => reject(error));
      }
    };

    worker.onerror = () => {
      finish(() => reject(createWorkerError('El proceso de PDF en segundo plano falló.')));
    };

    worker.onmessageerror = () => {
      finish(() => reject(createWorkerError('No se pudo comunicar con el proceso de PDF en segundo plano.')));
    };

    worker.postMessage({ type: 'start', jobId, payload });
  });
}
