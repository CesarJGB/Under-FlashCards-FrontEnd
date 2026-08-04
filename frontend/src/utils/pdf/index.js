import { getPdfExport } from './constants.js';
import { savePdfBuffer } from './download.js';
import { validateDeckImageBudget } from './images.js';
import { renderPdfInWorker } from './workerClient.js';

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
    const { renderPdf } = await awaitWithAbort(import('./renderPdf.js'), options.signal);
    if (options.signal?.aborted) throw createAbortError();
    result = await renderPdf({ ...payload, ...options });
  }

  savePdfBuffer(result.buffer, result.fileName);
  return result;
}

export async function exportScheduleToPDF(schedule, orientation = 'portrait', options = {}) {
  if (!schedule || typeof schedule !== 'object') {
    throw new Error('No hay un horario disponible para exportar.');
  }

  const payload = {
    documentType: 'schedule',
    scheduleName: schedule?.name || 'Horario',
    classes: Array.isArray(schedule?.classes) ? schedule.classes : [],
    daysCount: schedule?.daysCount || 5,
    subjectColors: Array.isArray(schedule?.subjectColors) ? schedule.subjectColors : [],
    orientation: orientation === 'landscape' ? 'landscape' : 'portrait',
  };
  const result = await renderScheduleWithFallback(payload, options);

  savePdfBuffer(result.buffer, result.fileName, { target: options.downloadTarget });
  return result;
}

export async function renderScheduleWithFallback(payload, options = {}, dependencies = {}) {
  const renderInWorker = dependencies.renderInWorker || renderPdfInWorker;
  const loadFallbackRenderer = dependencies.loadFallbackRenderer || (
    async () => (await import('./schedule/schedulePdfRenderer.js')).renderSchedulePdf
  );

  try {
    return await renderInWorker(payload, options);
  } catch (workerError) {
    if (isAbortError(workerError)) throw workerError;
    if (workerError?.name !== 'PdfWorkerError') throw workerError;

    options.onProgress?.({
      phase: 'fallback',
      current: 0,
      total: 0,
      message: 'Usando el modo de compatibilidad del navegador...',
    });
    const renderSchedule = await awaitWithAbort(loadFallbackRenderer(), options.signal);
    if (options.signal?.aborted) throw createAbortError();
    return renderSchedule({ ...payload, ...options });
  }
}
