import { renderPdf } from './renderPdf';

const controllers = new Map();

self.onmessage = async (event) => {
  const { type, jobId, payload } = event.data;

  if (type === 'cancel') {
    controllers.get(jobId)?.abort();
    return;
  }

  if (type !== 'start') return;

  const controller = new AbortController();
  controllers.set(jobId, controller);

  try {
    const result = await renderPdf({
      ...payload,
      signal: controller.signal,
      onProgress: (progress) => self.postMessage({ type: 'progress', jobId, progress }),
      onWarning: (warning) => self.postMessage({ type: 'warning', jobId, warning }),
    });

    self.postMessage({
      type: 'complete',
      jobId,
      result,
    }, [result.buffer]);
  } catch (error) {
    self.postMessage({
      type: 'error',
      jobId,
      error: {
        name: error?.name || 'Error',
        message: error?.message || 'No se pudo generar el PDF.',
      },
    });
  } finally {
    controllers.delete(jobId);
  }
};
