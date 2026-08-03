import { useCallback, useEffect, useRef, useState } from 'react';
import { exportScheduleToPDF } from '../utils/pdfExporter';
import { discardPreparedPdfDownload, preparePdfDownload } from '../utils/pdf/download';

const INITIAL_PROGRESS = { phase: 'idle', current: 0, total: 0, message: '' };

function isAbortError(error) {
  return error?.name === 'AbortError';
}

export default function useSchedulePdfExport() {
  const controllerRef = useRef(null);
  const mountedRef = useRef(true);
  const [progress, setProgress] = useState(INITIAL_PROGRESS);
  const [error, setError] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const updateState = useCallback((callback) => {
    if (mountedRef.current) callback();
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const exportPdf = useCallback(async (schedule, orientation) => {
    if (controllerRef.current) return null;
    if (!schedule) {
      updateState(() => setError('El horario todavía no termina de cargarse. Inténtalo de nuevo en un momento.'));
      return null;
    }

    // Must happen synchronously from the orientation button to preserve the
    // popup permission Safari/iOS grants to that user gesture.
    const downloadTarget = preparePdfDownload();
    const controller = new AbortController();
    controllerRef.current = controller;
    updateState(() => {
      setError('');
      setIsExporting(true);
      setProgress({ phase: 'preparing', current: 0, total: 0, message: 'Preparando el horario...' });
    });

    try {
      const result = await exportScheduleToPDF(schedule, orientation, {
        signal: controller.signal,
        downloadTarget,
        onProgress: (nextProgress) => updateState(() => setProgress(nextProgress)),
      });
      updateState(() => setProgress({
        phase: 'completed',
        current: result.pagesProcessed || 1,
        total: result.pagesProcessed || 1,
        message: 'PDF descargado.',
      }));
      return result;
    } catch (exportError) {
      discardPreparedPdfDownload(downloadTarget);
      if (isAbortError(exportError)) {
        updateState(() => setProgress({ phase: 'cancelled', current: 0, total: 0, message: 'La exportación fue cancelada.' }));
      } else {
        updateState(() => {
          setError(exportError.message || 'No se pudo generar el PDF. Inténtalo de nuevo.');
          setProgress(INITIAL_PROGRESS);
        });
      }
      return null;
    } finally {
      controllerRef.current = null;
      updateState(() => setIsExporting(false));
    }
  }, [updateState]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  return {
    exportPdf,
    cancel,
    progress,
    error,
    isExporting,
  };
}
