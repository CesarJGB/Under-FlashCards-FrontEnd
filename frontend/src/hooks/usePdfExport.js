import { useCallback, useEffect, useRef, useState } from 'react';
import { exportDeckToPDF } from '../utils/pdfExporter';

const INITIAL_PROGRESS = {
  phase: 'idle',
  current: 0,
  total: 0,
  message: '',
};

function isAbortError(error) {
  return error?.name === 'AbortError';
}

export default function usePdfExport() {
  const controllerRef = useRef(null);
  const mountedRef = useRef(true);
  const [progress, setProgress] = useState(INITIAL_PROGRESS);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [isExporting, setIsExporting] = useState(false);

  const updateState = useCallback((setter) => {
    if (mountedRef.current) setter();
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    if (controllerRef.current) return;
    setProgress(INITIAL_PROGRESS);
    setError('');
    setWarnings([]);
  }, []);

  const exportPdf = useCallback(async ({ deck, cards, loadCards, type }) => {
    if (controllerRef.current) return null;

    const controller = new AbortController();
    controllerRef.current = controller;
    updateState(() => {
      setError('');
      setWarnings([]);
      setIsExporting(true);
      setProgress({
        phase: 'loading',
        current: 0,
        total: 0,
        message: 'Cargando las tarjetas del mazo...',
      });
    });

    try {
      const resolvedCards = Array.isArray(cards)
        ? cards
        : await loadCards?.(controller.signal);

      if (!Array.isArray(resolvedCards) || resolvedCards.length === 0) {
        throw new Error('No hay tarjetas en este mazo para exportar a PDF.');
      }

      const result = await exportDeckToPDF(deck.title, resolvedCards, type, {
        signal: controller.signal,
        onProgress: (nextProgress) => updateState(() => setProgress(nextProgress)),
        onWarning: (warning) => updateState(() => setWarnings((current) => [...current, warning])),
      });

      updateState(() => setProgress({
        phase: 'completed',
        current: resolvedCards.length,
        total: resolvedCards.length,
        message: 'PDF descargado.',
      }));
      return result;
    } catch (exportError) {
      if (isAbortError(exportError)) {
        updateState(() => {
          setWarnings([]);
          setProgress({
            phase: 'cancelled',
            current: 0,
            total: 0,
            message: 'La exportación fue cancelada.',
          });
        });
      } else {
        updateState(() => {
          setError(exportError.message || 'No se pudo generar el PDF. Inténtalo de nuevo.');
          setWarnings([]);
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
    reset,
    progress,
    error,
    warnings,
    isExporting,
  };
}
