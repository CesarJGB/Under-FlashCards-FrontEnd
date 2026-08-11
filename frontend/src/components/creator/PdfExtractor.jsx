// FILE: frontend/src/components/creator/PdfExtractor.jsx
// Entrega v3. Guardar este archivo con extensión .jsx.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  FileText,
  FileUp,
  Layers,
  Plus,
  X,
} from 'lucide-react';
import ActionSheet from '../common/ActionSheet';
import PdfProcessingActionSheet from './PdfProcessingActionSheet';
import {
  PDF_EXTRACTION_DEFAULTS,
  PdfExtractionError,
  createExtractionSummary,
  extractPdfDocument,
  isAbortError,
} from './pdf/pdfExtractionEngine';
import PdfCarousel from './pdf/PdfCarousel';
import PdfPageSelectionSheet from './PdfPageSelectionSheet';

const DEFAULT_MAX_PDF_FILE_MB = 100;
const DEFAULT_MAX_PDF_PAGES = 500;
const MAX_PDF_IMAGE_PIXELS = 16_000_000;
const PROGRESS_UPDATE_INTERVAL_MS = 125;

const configuredMaxFileMb = Number.parseInt(import.meta.env.VITE_MAX_PDF_FILE_MB, 10);
const configuredMaxPages = Number.parseInt(import.meta.env.VITE_MAX_PDF_PAGES, 10);
const configuredMaxCharacters = Number.parseInt(import.meta.env.VITE_MAX_AI_DOCUMENT_TEXT_LENGTH, 10);

const MAX_FILE_BYTES = (Number.isInteger(configuredMaxFileMb) && configuredMaxFileMb > 0
  ? configuredMaxFileMb
  : DEFAULT_MAX_PDF_FILE_MB) * 1024 * 1024;
const MAX_PAGES = Number.isInteger(configuredMaxPages) && configuredMaxPages > 0
  ? configuredMaxPages
  : DEFAULT_MAX_PDF_PAGES;
const MAX_CHARACTERS = Number.isInteger(configuredMaxCharacters) && configuredMaxCharacters > 0
  ? configuredMaxCharacters
  : PDF_EXTRACTION_DEFAULTS.maxCharacters;

let pdfJsPromise = null;

function buildPageList(totalPages) {
  return Array.from({ length: totalPages }, (_, index) => index + 1);
}

function normalizePages(pages, totalPages) {
  return [...new Set(pages)]
    .map(Number)
    .filter((page) => Number.isInteger(page) && page >= 1 && page <= totalPages)
    .sort((left, right) => left - right);
}

function formatPartialPages(pages) {
  if (!pages.length) return 'Sin páginas seleccionadas';

  const ranges = [];
  let start = pages[0];
  let previous = pages[0];

  for (let index = 1; index < pages.length; index += 1) {
    const page = pages[index];
    if (page === previous + 1) {
      previous = page;
      continue;
    }
    ranges.push(start === previous ? String(start) : start + '–' + previous);
    start = page;
    previous = page;
  }

  ranges.push(start === previous ? String(start) : start + '–' + previous);
  return 'Páginas ' + ranges.join(', ');
}

function createSourceMetadata(fileName, pages, totalPages, result) {
  const selectedPages = normalizePages(pages, totalPages);
  const isFullDocument = selectedPages.length === totalPages;
  const pageCount = selectedPages.length;
  const pageLabel = isFullDocument
    ? 'Documento completo · ' + totalPages + (totalPages === 1 ? ' página' : ' páginas')
    : formatPartialPages(selectedPages) + ' · ' + pageCount + (pageCount === 1 ? ' página' : ' páginas');

  return {
    fileName,
    scope: isFullDocument ? 'all' : 'custom',
    selectedPages,
    totalPages,
    pageLabel,
    textCharacterCount: result?.plainText?.length || result?.stats?.sourceCharacters || 0,
  };
}

async function loadPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.mjs?url'),
    ])
      .then(([pdfjsLib, workerModule]) => {
        if (pdfjsLib.GlobalWorkerOptions.workerSrc !== workerModule.default) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;
        }
        return pdfjsLib;
      })
      .catch((error) => {
        pdfJsPromise = null;
        throw error;
      });
  }

  return pdfJsPromise;
}

async function hasPdfSignature(file) {
  try {
    return (await file.slice(0, 5).text()) === '%PDF-';
  } catch {
    return false;
  }
}

function getReadablePdfError(error, passwordRequired = false) {
  if (passwordRequired) return 'Este PDF está protegido con contraseña. Desbloquéalo antes de importarlo.';
  if (error?.code === 'PDF_TOO_LARGE') {
    return 'El PDF supera el límite de ' + (MAX_FILE_BYTES / 1024 / 1024).toFixed(0) + ' MB.';
  }
  if (error?.code === 'PDF_TOO_MANY_PAGES') {
    return 'El PDF supera el límite de ' + MAX_PAGES.toLocaleString('es-MX') + ' páginas.';
  }
  if (error?.code === 'NO_USABLE_TEXT') {
    return 'No se encontró texto legible. Este documento parece escaneado y requiere OCR.';
  }
  if (error?.code === 'PDF_EXTRACTION_ABORTED') return 'Extracción cancelada.';
  if (error?.code === 'PAGE_TEXT_READ_FAILED') {
    return 'Una o más páginas no pudieron leerse y quedaron marcadas en el diagnóstico.';
  }
  return error?.message || 'No se pudo procesar el PDF. Revisa que no esté dañado o protegido.';
}

function createOperation(id, kind) {
  return { id, kind, controller: new AbortController() };
}

function createCompletionSnapshot(result) {
  const stats = result?.stats || {};
  const hasWarnings = Boolean(
    stats.pagesRequiringOcr > 0
    || stats.failedPages > 0
    || stats.notProcessedPages > 0
    || stats.truncated
    || stats.highComplexityPages > 0,
  );

  return {
    summary: createExtractionSummary(result),
    hasWarnings,
    details: [
      (stats.sourceCharacters || 0).toLocaleString('es-MX') + ' caracteres extraídos.',
      stats.regionCount
        ? stats.regionCount.toLocaleString('es-MX') + ' regiones estructuradas detectadas.'
        : 'No se detectaron regiones estructuradas adicionales.',
      hasWarnings
        ? 'El diagnóstico conserva las advertencias del documento para que puedas revisarlas.'
        : 'El texto está listo para usarse en la generación de tarjetas.',
    ],
  };
}

export default function PdfExtractor({ onTextExtracted, onExtractionComplete, ocrProvider }) {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [fileName, setFileName] = useState('');
  const [completedFileName, setCompletedFileName] = useState('');
  const [totalPages, setTotalPages] = useState(0);
  const [selectedPages, setSelectedPages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(null);
  const [localError, setLocalError] = useState('');
  const [previewPageNum, setPreviewPageNum] = useState(null);
  const [processingProgress, setProcessingProgress] = useState(null);
  const [completionSnapshot, setCompletionSnapshot] = useState(null);
  const [showCompletionSheet, setShowCompletionSheet] = useState(false);
  const [isImportSheetOpen, setIsImportSheetOpen] = useState(false);
  const [isAnalysisSheetOpen, setIsAnalysisSheetOpen] = useState(false);
  const [isPageSelectionOpen, setIsPageSelectionOpen] = useState(false);

  const fileInputRef = useRef(null);
  const pdfDocRef = useRef(null);
  const loadingTaskRef = useRef(null);
  const objectUrlRef = useRef(null);
  const operationIdRef = useRef(0);
  const activeOperationRef = useRef(null);
  const isMountedRef = useRef(true);
  const passwordRequiredRef = useRef(false);
  const progressUpdateRef = useRef(0);

  const clearDocumentState = useCallback(() => {
    setPdfDoc(null);
    setFileName('');
    setTotalPages(0);
    setSelectedPages([]);
    setPreviewPageNum(null);
    setProcessingProgress(null);
    setStage(null);
  }, []);

  const releasePdfResources = useCallback(async () => {
    const currentPdfDoc = pdfDocRef.current;
    const currentLoadingTask = loadingTaskRef.current;
    const currentObjectUrl = objectUrlRef.current;

    pdfDocRef.current = null;
    loadingTaskRef.current = null;
    objectUrlRef.current = null;

    if (currentPdfDoc) {
      try { currentPdfDoc.cleanup(); } catch { /* best effort */ }
      try { await currentPdfDoc.destroy(); } catch { /* best effort */ }
    } else if (currentLoadingTask) {
      try { await currentLoadingTask.destroy(); } catch { /* best effort */ }
    }

    if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
  }, []);

  const abortActiveOperation = useCallback(() => {
    activeOperationRef.current?.controller.abort();
    activeOperationRef.current = null;
  }, []);

  const beginOperation = useCallback((kind) => {
    abortActiveOperation();
    const operation = createOperation(operationIdRef.current + 1, kind);
    operationIdRef.current = operation.id;
    activeOperationRef.current = operation;
    return operation;
  }, [abortActiveOperation]);

  const isCurrentOperation = useCallback((operation) => (
    isMountedRef.current
      && operationIdRef.current === operation.id
      && activeOperationRef.current?.id === operation.id
  ), []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      operationIdRef.current += 1;
      abortActiveOperation();
      void releasePdfResources();
    };
  }, [abortActiveOperation, releasePdfResources]);

  const isProcessing = loading && stage === 'extracting';

  const handleCancel = useCallback(() => {
    operationIdRef.current += 1;
    abortActiveOperation();
    void releasePdfResources();
    clearDocumentState();
    setLoading(false);
    setStage(null);
    setProcessingProgress(null);
    setIsAnalysisSheetOpen(false);
    setIsPageSelectionOpen(false);
    progressUpdateRef.current = 0;
  }, [abortActiveOperation, clearDocumentState, releasePdfResources]);

  const handleFileChange = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const hasValidExtension = file.name.toLowerCase().endsWith('.pdf');
    const hasValidType = !file.type || file.type === 'application/pdf' || file.type === 'application/x-pdf';
    if (!hasValidExtension && !hasValidType) {
      setLocalError('Selecciona un archivo PDF válido.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setLocalError('El PDF supera el límite de ' + (MAX_FILE_BYTES / 1024 / 1024).toFixed(0) + ' MB.');
      return;
    }
    if (!(await hasPdfSignature(file))) {
      setLocalError('El archivo no parece ser un PDF válido.');
      return;
    }

    const operation = beginOperation('loading');
    passwordRequiredRef.current = false;
    setShowCompletionSheet(false);
    setCompletedFileName('');
    setLoading(true);
    setStage('loading');
    setLocalError('');
    setCompletionSnapshot(null);
    setIsAnalysisSheetOpen(false);
    setIsPageSelectionOpen(false);
    clearDocumentState();
    await releasePdfResources();
    if (!isCurrentOperation(operation)) return;

    try {
      const pdfjsLib = await loadPdfJs();
      if (!isCurrentOperation(operation)) return;

      const objectUrl = URL.createObjectURL(file);
      objectUrlRef.current = objectUrl;
      const loadingTask = pdfjsLib.getDocument({
        url: objectUrl,
        maxImageSize: MAX_PDF_IMAGE_PIXELS,
        isEvalSupported: true,
        stopAtErrors: false,
      });
      loadingTaskRef.current = loadingTask;
      loadingTask.onPassword = () => {
        passwordRequiredRef.current = true;
        void loadingTask.destroy();
      };

      const loadedPdf = await loadingTask.promise;
      if (loadingTaskRef.current === loadingTask) loadingTaskRef.current = null;
      if (!isCurrentOperation(operation)) {
        await loadedPdf.destroy();
        return;
      }
      if (loadedPdf.numPages > MAX_PAGES) {
        throw new PdfExtractionError(
          'El PDF supera el límite de ' + MAX_PAGES.toLocaleString('es-MX') + ' páginas.',
          'PDF_TOO_MANY_PAGES',
          { totalPages: loadedPdf.numPages, maxPages: MAX_PAGES },
        );
      }

      pdfDocRef.current = loadedPdf;
      setPdfDoc(loadedPdf);
      setFileName(file.name);
      setTotalPages(loadedPdf.numPages);
      setSelectedPages(buildPageList(loadedPdf.numPages));
      setIsAnalysisSheetOpen(true);
    } catch (error) {
      if (!isCurrentOperation(operation)) return;
      console.error('[PdfExtractor] Error loading PDF:', error);
      await releasePdfResources();
      clearDocumentState();
      setLocalError(getReadablePdfError(error, passwordRequiredRef.current));
    } finally {
      if (isCurrentOperation(operation)) {
        activeOperationRef.current = null;
        setLoading(false);
        setStage(null);
      }
    }
  }, [beginOperation, clearDocumentState, isCurrentOperation, releasePdfResources]);

  const handleProcessText = useCallback(async (requestedPages) => {
    const activePdf = pdfDocRef.current;
    if (!activePdf || loading) return;

    const pagesToRead = normalizePages(
      requestedPages || buildPageList(activePdf.numPages),
      activePdf.numPages,
    );
    if (!pagesToRead.length) return;

    const operation = beginOperation('extracting');
    setShowCompletionSheet(false);
    setCompletedFileName('');
    setCompletionSnapshot(null);
    setLoading(true);
    setStage('extracting');
    setLocalError('');
    setSelectedPages(pagesToRead);
    setIsAnalysisSheetOpen(false);
    setIsPageSelectionOpen(false);
    progressUpdateRef.current = Date.now();
    setProcessingProgress({ current: 0, total: pagesToRead.length, phase: 'extracting' });

    try {
      const pdfjsLib = await loadPdfJs();
      if (!isCurrentOperation(operation)) return;

      const result = await extractPdfDocument(activePdf, pagesToRead, {
        maxCharacters: MAX_CHARACTERS,
        inspectGraphics: 'adaptive',
        signal: operation.controller.signal,
        pdfjsLib,
        ocrProvider,
        onProgress: (progress) => {
          if (!isCurrentOperation(operation)) return;
          const now = Date.now();
          const isFinalProgress = progress.phase === 'finalizing'
            && progress.current === progress.total;
          const isPhaseTransition = progress.phase !== 'extracting';
          if (!isFinalProgress && !isPhaseTransition
            && now - progressUpdateRef.current < PROGRESS_UPDATE_INTERVAL_MS) return;
          progressUpdateRef.current = now;
          setProcessingProgress({
            ...progress,
            phase: progress.phase || 'extracting',
          });
        },
      });

      if (!isCurrentOperation(operation)) return;
      const hasUsableText = result.pages.some((page) => page.blocks.length > 0);
      if (!hasUsableText) {
        throw new PdfExtractionError(
          'No se encontró texto legible en las páginas seleccionadas.',
          'NO_USABLE_TEXT',
          { result },
        );
      }

      const sourceMetadata = createSourceMetadata(fileName, pagesToRead, activePdf.numPages, result);
      setCompletionSnapshot(createCompletionSnapshot(result));
      setCompletedFileName(fileName);
      setShowCompletionSheet(true);
      onTextExtracted?.(result.plainText, result, sourceMetadata);
      onExtractionComplete?.(result, sourceMetadata);

      operationIdRef.current += 1;
      abortActiveOperation();
      await releasePdfResources();
      clearDocumentState();
      setLoading(false);
      setStage(null);
    } catch (error) {
      if (!isMountedRef.current || isAbortError(error)) return;
      console.error('[PdfExtractor] Extraction error:', error);
      setLocalError(getReadablePdfError(error));
    } finally {
      if (isMountedRef.current && isCurrentOperation(operation)) {
        activeOperationRef.current = null;
        setProcessingProgress(null);
        setLoading(false);
        setStage(null);
      }
    }
  }, [
    abortActiveOperation,
    beginOperation,
    clearDocumentState,
    fileName,
    isCurrentOperation,
    loading,
    onExtractionComplete,
    onTextExtracted,
    ocrProvider,
    releasePdfResources,
  ]);

  const extractionSummary = completionSnapshot?.summary || '';
  const extractionDetails = completionSnapshot?.details || [];

  const requestFile = () => {
    setLocalError('');
    fileInputRef.current?.click();
  };

  const handleFabClick = () => {
    if (loading) return;
    setLocalError('');
    if (pdfDocRef.current) {
      setIsAnalysisSheetOpen(true);
    } else {
      setIsImportSheetOpen(true);
    }
  };

  const handleOpenPartialSelection = () => {
    setSelectedPages([]);
    setIsPageSelectionOpen(true);
  };

  const handleSelectionConfirm = (pages) => {
    setIsPageSelectionOpen(false);
    void handleProcessText(pages, 'custom');
  };

  const handlePreview = (page) => {
    setIsPageSelectionOpen(false);
    setPreviewPageNum(page);
  };

  const handlePreviewClose = () => {
    setPreviewPageNum(null);
    if (pdfDocRef.current && !loading) setIsPageSelectionOpen(true);
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        onChange={handleFileChange}
        className="hidden"
        tabIndex={-1}
      />

      <button
        type="button"
        onClick={handleFabClick}
        disabled={loading}
        aria-label="Agregar PDF"
        title="Agregar PDF"
        className="fixed right-6 z-50 flex h-14 w-14 cursor-pointer items-center justify-center rounded-[1.3rem] border border-white/50 bg-white/10 shadow-[0_10px_30px_-6px_rgba(0,0,0,0.35),0_4px_10px_-2px_rgba(0,0,0,0.15),inset_0_1.5px_0.5px_0_rgba(255,255,255,0.9),inset_0_-1.5px_1px_-0.5px_rgba(0,0,0,0.18),inset_1px_0_1px_-0.5px_rgba(255,255,255,0.4),inset_-1px_0_1px_-0.5px_rgba(0,0,0,0.12)] ring-1 ring-inset ring-white/30 backdrop-blur-[3px] backdrop-saturate-100 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:scale-105 hover:bg-white/15 active:scale-95 before:pointer-events-none before:absolute before:inset-0 before:rounded-[1.3rem] before:bg-[radial-gradient(80%_60%_at_50%_-5%,rgba(255,255,255,0.45)_0%,rgba(255,255,255,0.08)_35%,transparent_70%)] before:opacity-90 after:pointer-events-none after:absolute after:inset-[1px] after:rounded-[1.2rem] after:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)] after:mix-blend-overlay disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/25 dark:bg-white/5 dark:ring-white/10 dark:hover:bg-white/10"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 6rem)' }}
      >
        <Plus className="relative h-7 w-7 stroke-[3] text-slate-800 drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)] dark:text-white dark:drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
      </button>

      <ActionSheet
        open={isImportSheetOpen}
        title="Agregar PDF"
        onClose={() => setIsImportSheetOpen(false)}
        options={[
          {
            id: 'add-pdf',
            icon: FileUp,
            label: 'Agregar PDF',
            description: 'Selecciona un documento desde tu dispositivo.',
            onSelect: requestFile,
          },
          {
            id: 'cancel-add-pdf',
            icon: X,
            label: 'Cancelar',
            description: 'Cerrar este menú.',
          },
        ]}
      />

      <ActionSheet
        open={isAnalysisSheetOpen && Boolean(pdfDoc)}
        title="PDF listo"
        onClose={() => setIsAnalysisSheetOpen(false)}
        options={[
          {
            id: 'analyze-complete-pdf',
            icon: FileText,
            label: 'Analizar PDF completo',
            description: totalPages + (totalPages === 1 ? ' página del documento.' : ' páginas del documento.'),
            onAfterClose: () => {
              void handleProcessText(buildPageList(totalPages), 'all');
            },
          },
          {
            id: 'select-pdf-parts',
            icon: Layers,
            label: 'Seleccionar parte',
            description: 'Elige únicamente las páginas que necesitas.',
            onAfterClose: handleOpenPartialSelection,
          },
        ]}
      />

      <PdfPageSelectionSheet
        open={isPageSelectionOpen}
        pdf={pdfDoc}
        totalPages={totalPages}
        selectedPages={selectedPages}
        onChange={setSelectedPages}
        onConfirm={handleSelectionConfirm}
        onClose={() => setIsPageSelectionOpen(false)}
        onPreview={handlePreview}
        disabled={loading}
      />

      {previewPageNum !== null && pdfDoc && (
        <PdfCarousel
          pdf={pdfDoc}
          initialPage={previewPageNum}
          totalPages={totalPages}
          selectedPages={selectedPages}
          onToggle={(page) => {
            setSelectedPages((previousPages) => (
              previousPages.includes(page)
                ? previousPages.filter((selectedPage) => selectedPage !== page)
                : normalizePages([...previousPages, page], totalPages)
            ));
          }}
          onClose={handlePreviewClose}
        />
      )}

      <ActionSheet
        open={Boolean(localError)}
        title="No se pudo cargar el PDF"
        onClose={() => setLocalError('')}
        options={[
          {
            id: 'dismiss-pdf-error',
            icon: AlertTriangle,
            label: 'Entendido',
            description: localError,
            danger: true,
          },
        ]}
      />

      <PdfProcessingActionSheet
        open={isProcessing || showCompletionSheet}
        status={showCompletionSheet ? 'success' : 'processing'}
        title={showCompletionSheet ? 'PDF analizado' : 'Analizando PDF'}
        fileName={showCompletionSheet ? completedFileName : fileName}
        message={showCompletionSheet
          ? 'La estructura del documento quedó lista para generar tus tarjetas.'
          : undefined}
        progress={isProcessing ? processingProgress : null}
        summary={showCompletionSheet ? extractionSummary : undefined}
        details={showCompletionSheet ? extractionDetails : undefined}
        onCancel={isProcessing ? handleCancel : undefined}
        onClose={() => setShowCompletionSheet(false)}
        autoCloseMs={2500}
      />
    </>
  );
}
