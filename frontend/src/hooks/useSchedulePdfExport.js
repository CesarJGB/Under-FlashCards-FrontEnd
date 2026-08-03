import { useCallback, useEffect, useRef, useState } from 'react';
import { exportScheduleToPDF } from '../utils/pdfExporter';

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
    if (!schedule || controllerRef.current) return null;
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
      if (isAbortError(exportError)) {
        updateState(() => setProgress({ phase: 'cancelled', current: 0, total: 0, message: 'La exportaciÃ³n fue cancelada.' }));
      } else {
        updateState(() => {
          setError(exportError.message || 'No se pudo generar el PDF. IntÃ©ntalo de nuevo.');
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