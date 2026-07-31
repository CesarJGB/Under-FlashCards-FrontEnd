import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileText,
  FileUp,
  Loader2,
  X,
} from 'lucide-react';

import {
  PDF_EXTRACTION_DEFAULTS,
  PdfExtractionError,
  createExtractionSummary,
  extractPdfDocument,
  isAbortError,
} from './pdf/pdfExtractionEngine';
import PdfPageThumbnail from './pdf/PdfPageThumbnail';
import PdfCarousel from './pdf/PdfCarousel';

const PAGE_BLOCK_SIZE = 24;
const MAX_PDF_FILE_BYTES = 50 * 1024 * 1024;
const MAX_PDF_PAGES = 500;
const MAX_PDF_IMAGE_PIXELS = 16_000_000;

const configuredMaxFileMb = Number.parseInt(import.meta.env.VITE_MAX_PDF_FILE_MB, 10);
const configuredMaxPages = Number.parseInt(import.meta.env.VITE_MAX_PDF_PAGES, 10);
const configuredMaxCharacters = Number.parseInt(import.meta.env.VITE_MAX_AI_DOCUMENT_TEXT_LENGTH, 10);

const MAX_FILE_BYTES = Number.isInteger(configuredMaxFileMb) && configuredMaxFileMb > 0
  ? configuredMaxFileMb * 1024 * 1024
  : MAX_PDF_FILE_BYTES;
const MAX_PAGES = Number.isInteger(configuredMaxPages) && configuredMaxPages > 0
  ? configuredMaxPages
  : MAX_PDF_PAGES;
const MAX_CHARACTERS = Number.isInteger(configuredMaxCharacters) && configuredMaxCharacters > 0
  ? configuredMaxCharacters
  : PDF_EXTRACTION_DEFAULTS.maxCharacters;

let pdfJsPromise = null;

const buildPageList = (totalPages) => Array.from({ length: totalPages }, (_, index) => index + 1);

const loadPdfJs = async () => {
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
};

async function hasPdfSignature(file) {
  try {
    const header = await file.slice(0, 5).text();
    return header === '%PDF-';
  } catch {
    return false;
  }
}

function getReadablePdfError(error, passwordRequired = false) {
  if (passwordRequired) {
    return 'Este PDF está protegido con contraseña. Desbloquéalo antes de importarlo.';
  }

  if (error?.code === 'PDF_TOO_LARGE') {
    return `El PDF supera el límite de ${(MAX_FILE_BYTES / 1024 / 1024).toFixed(0)} MB.`;
  }

  if (error?.code === 'PDF_TOO_MANY_PAGES') {
    return `El PDF supera el límite de ${MAX_PAGES.toLocaleString('es-MX')} páginas.`;
  }

  if (error?.code === 'NO_USABLE_TEXT') {
    return 'No se encontró texto legible. Este documento parece escaneado y requiere OCR.';
  }

  if (error?.code === 'PDF_EXTRACTION_ABORTED') return 'Extracción cancelada.';
  return error?.message || 'No se pudo procesar el PDF. Revisa que no esté dañado o protegido.';
}

function createOperation(id, kind) {
  return { id, kind, controller: new AbortController() };
}

export default function PdfExtractor({
  onTextExtracted,
  onExtractionComplete,
  ocrProvider,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [fileName, setFileName] = useState('');
  const [totalPages, setTotalPages] = useState(0);
  const [selectedPages, setSelectedPages] = useState([]);
  const [scope, setScope] = useState('all');
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(null);
  const [localError, setLocalError] = useState('');
  const [previewPageNum, setPreviewPageNum] = useState(null);
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(null);
  const [loadProgress, setLoadProgress] = useState(null);
  const [lastResult, setLastResult] = useState(null);

  const scrollRootRef = useRef(null);
  const pdfDocRef = useRef(null);
  const loadingTaskRef = useRef(null);
  const objectUrlRef = useRef(null);
  const operationIdRef = useRef(0);
  const activeOperationRef = useRef(null);
  const isMountedRef = useRef(true);
  const passwordRequiredRef = useRef(false);

  const clearDocumentState = useCallback(() => {
    setPdfDoc(null);
    setFileName('');
    setTotalPages(0);
    setSelectedPages([]);
    setScope('all');
    setPreviewPageNum(null);
    setCurrentBlockIndex(0);
    setProcessingProgress(null);
    setLoadProgress(null);
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
      try {
        currentPdfDoc.cleanup();
      } catch {
        // PDF.js cleanup is best effort.
      }

      try {
        await currentPdfDoc.destroy();
      } catch {
        // A destroyed loading task can reject during a normal replacement.
      }
    } else if (currentLoadingTask) {
      try {
        await currentLoadingTask.destroy();
      } catch {
        // The task may already have completed or been cancelled.
      }
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

  const isCurrentOperation = useCallback((operation) => {
    return isMountedRef.current
      && operationIdRef.current === operation.id
      && activeOperationRef.current?.id === operation.id;
  }, []);

  const resetDocument = useCallback(async ({ preserveResult = false } = {}) => {
    operationIdRef.current += 1;
    abortActiveOperation();
    await releasePdfResources();
    clearDocumentState();
    setLoading(false);
    setLocalError('');
    if (!preserveResult) setLastResult(null);
  }, [abortActiveOperation, clearDocumentState, releasePdfResources]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      operationIdRef.current += 1;
      abortActiveOperation();
      void releasePdfResources();
    };
  }, [abortActiveOperation, releasePdfResources]);

  const totalBlocks = useMemo(() => {
    if (!totalPages) return 0;
    return Math.ceil(totalPages / PAGE_BLOCK_SIZE);
  }, [totalPages]);

  useEffect(() => {
    if (!totalBlocks) {
      setCurrentBlockIndex(0);
      return;
    }

    if (currentBlockIndex > totalBlocks - 1) {
      setCurrentBlockIndex(totalBlocks - 1);
    }
  }, [currentBlockIndex, totalBlocks]);

  const blockPages = useMemo(() => {
    if (!totalPages || scope !== 'custom') return [];

    const startPage = currentBlockIndex * PAGE_BLOCK_SIZE + 1;
    const endPage = Math.min(totalPages, startPage + PAGE_BLOCK_SIZE - 1);
    return Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index);
  }, [currentBlockIndex, scope, totalPages]);

  const selectedPageSet = useMemo(() => new Set(selectedPages), [selectedPages]);
  const blockPageSet = useMemo(() => new Set(blockPages), [blockPages]);
  const currentBlockSelectionCount = useMemo(
    () => blockPages.reduce((count, pageNum) => count + (selectedPageSet.has(pageNum) ? 1 : 0), 0),
    [blockPages, selectedPageSet],
  );

  const isProcessing = loading && stage === 'extracting';
  const isLoadingPdf = loading && stage === 'loading';

  const togglePage = useCallback((pageNum) => {
    if (loading) return;

    setSelectedPages((previous) => {
      if (previous.includes(pageNum)) return previous.filter((page) => page !== pageNum);
      return [...previous, pageNum].sort((a, b) => a - b);
    });
  }, [loading]);

  const handlePreview = useCallback((pageNum) => {
    if (!loading) setPreviewPageNum(pageNum);
  }, [loading]);

  const handleSelectAllPages = useCallback(() => {
    setSelectedPages(buildPageList(totalPages));
  }, [totalPages]);

  const handleClearAllPages = useCallback(() => {
    setSelectedPages([]);
  }, []);

  const handleSelectCurrentBlock = useCallback(() => {
    setSelectedPages((previous) => {
      const next = new Set(previous);
      blockPages.forEach((pageNum) => next.add(pageNum));
      return Array.from(next).sort((a, b) => a - b);
    });
  }, [blockPages]);

  const handleClearCurrentBlock = useCallback(() => {
    setSelectedPages((previous) => previous.filter((pageNum) => !blockPageSet.has(pageNum)));
  }, [blockPageSet]);

  const handleCancel = useCallback(() => {
    operationIdRef.current += 1;
    abortActiveOperation();
    setLoading(false);
    setStage(null);
    setProcessingProgress(null);
    setLoadProgress(null);
    setLocalError('Operación cancelada.');
  }, [abortActiveOperation]);

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
      setLocalError(`El PDF supera el límite de ${(MAX_FILE_BYTES / 1024 / 1024).toFixed(0)} MB.`);
      return;
    }

    if (!(await hasPdfSignature(file))) {
      setLocalError('El archivo no parece ser un PDF válido.');
      return;
    }

    const operation = beginOperation('loading');
    passwordRequiredRef.current = false;
    setLoading(true);
    setStage('loading');
    setLocalError('');
    setLastResult(null);
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
      loadingTask.onProgress = ({ loaded, total }) => {
        if (!isCurrentOperation(operation) || !total) return;
        setLoadProgress({ current: loaded, total });
      };
      loadingTask.onPassword = () => {
        passwordRequiredRef.current = true;
        void loadingTask.destroy();
      };

      const loadedPdf = await loadingTask.promise;
      if (!isCurrentOperation(operation)) {
        await loadedPdf.destroy();
        return;
      }

      if (loadedPdf.numPages > MAX_PAGES) {
        throw new PdfExtractionError(
          `El PDF supera el límite de ${MAX_PAGES.toLocaleString('es-MX')} páginas.`,
          'PDF_TOO_MANY_PAGES',
          { totalPages: loadedPdf.numPages, maxPages: MAX_PAGES },
        );
      }

      pdfDocRef.current = loadedPdf;
      setPdfDoc(loadedPdf);
      setFileName(file.name);
      setTotalPages(loadedPdf.numPages);
      setSelectedPages(buildPageList(loadedPdf.numPages));
      setScope('all');
      setCurrentBlockIndex(0);
      setStage(null);
    } catch (error) {
      if (!isCurrentOperation(operation)) return;
      console.error('[PdfExtractor.v1] Error loading PDF:', error);
      await releasePdfResources();
      clearDocumentState();
      setLocalError(getReadablePdfError(error, passwordRequiredRef.current));
    } finally {
      if (isCurrentOperation(operation)) {
        activeOperationRef.current = null;
        setLoading(false);
        setStage(null);
        setLoadProgress(null);
      }
    }
  }, [beginOperation, clearDocumentState, isCurrentOperation, releasePdfResources]);

  const handleProcessText = useCallback(async () => {
    const activePdf = pdfDocRef.current;
    if (!activePdf || loading) return;

    const pagesToRead = scope === 'all'
      ? buildPageList(totalPages)
      : [...selectedPages].sort((a, b) => a - b);
    if (!pagesToRead.length) return;

    const operation = beginOperation('extracting');
    setLoading(true);
    setStage('extracting');
    setLocalError('');
    setProcessingProgress({ current: 0, total: pagesToRead.length });

    try {
      const result = await extractPdfDocument(activePdf, pagesToRead, {
        maxCharacters: MAX_CHARACTERS,
        signal: operation.controller.signal,
        pdfjsLib: await loadPdfJs(),
        ocrProvider,
        onProgress: (progress) => {
          if (!isCurrentOperation(operation)) return;
          setProcessingProgress({ current: progress.current, total: progress.total });
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

      setLastResult(result);
      onTextExtracted?.(result.plainText, result);
      onExtractionComplete?.(result);

      operationIdRef.current += 1;
      abortActiveOperation();
      await releasePdfResources();
      clearDocumentState();
      setLoading(false);
      setStage(null);
      setIsOpen(false);
    } catch (error) {
      if (!isMountedRef.current || isAbortError(error)) return;
      console.error('[PdfExtractor.v1] Extraction error:', error);
      setLocalError(getReadablePdfError(error));
    } finally {
      if (isMountedRef.current && isCurrentOperation(operation)) {
        activeOperationRef.current = null;
        setProcessingProgress(null);
        setLoading(false);
        setStage(null);
      }
    }
  }, [abortActiveOperation, beginOperation, clearDocumentState, isCurrentOperation, loading, onExtractionComplete, onTextExtracted, ocrProvider, releasePdfResources, scope, selectedPages, totalPages]);

  const blockStartPage = blockPages[0] ?? 0;
  const blockEndPage = blockPages[blockPages.length - 1] ?? 0;
  const extractionSummary = lastResult ? createExtractionSummary(lastResult) : '';
  const extractionHasWarnings = Boolean(lastResult && (
    lastResult.stats.pagesRequiringOcr > 0
    || lastResult.stats.failedPages > 0
    || lastResult.stats.truncated
  ));

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-3xs">
      <button
        type="button"
        onClick={() => setIsOpen((previous) => !previous)}
        className="flex w-full cursor-pointer items-center justify-between bg-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-100/70"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <FileUp className="h-4 w-4 shrink-0 text-indigo-500" />
          <span className="text-xs font-bold text-slate-700">Importar apuntes desde un PDF</span>
        </div>
        {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>

      {lastResult && !isOpen && (
        <div className={`flex items-center gap-2 border-t px-4 py-2 text-[10px] font-semibold ${extractionHasWarnings ? 'border-amber-100 bg-amber-50 text-amber-800' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>
          {extractionHasWarnings ? <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> : <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
          <span className="truncate">PDF importado · {extractionSummary}</span>
        </div>
      )}

      {isOpen && (
        <div className="flex flex-col gap-3 border-t border-slate-200/60 bg-white p-4 animate-[slideUp_0.15s_ease]">
          {!pdfDoc ? (
            <div className="flex flex-col gap-2">
              <label className={`group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-4 py-7 text-center transition-all hover:bg-slate-50 ${loading ? 'pointer-events-none opacity-70' : ''}`}>
                {isLoadingPdf ? (
                  <Loader2 className="mb-2 h-7 w-7 animate-spin text-indigo-500" />
                ) : (
                  <FileText className="mb-2 h-7 w-7 text-slate-300 transition-colors group-hover:text-indigo-400" />
                )}
                <span className="text-xs font-bold text-slate-600">
                  {isLoadingPdf ? 'Analizando documento...' : 'Haz clic para cargar tu documento'}
                </span>
                <span className="mt-0.5 text-[10px] text-slate-400">
                  PDF local · hasta {(MAX_FILE_BYTES / 1024 / 1024).toFixed(0)} MB · {MAX_PAGES.toLocaleString('es-MX')} páginas
                </span>
                <input type="file" accept="application/pdf,.pdf" onChange={handleFileChange} className="hidden" disabled={loading} />
              </label>

              {loadProgress && (
                <div className="flex flex-col gap-1">
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${Math.min(100, (loadProgress.current / loadProgress.total) * 100)}%` }} />
                  </div>
                  <span className="text-center text-[10px] font-medium text-slate-400">Cargando documento...</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                <div className="flex max-w-[75%] items-center gap-2 truncate">
                  <FileText className="h-4 w-4 shrink-0 text-indigo-500" />
                  <span className="truncate text-xs font-semibold text-slate-700">{fileName}</span>
                </div>
                <button
                  type="button"
                  onClick={() => void resetDocument()}
                  disabled={loading}
                  className="cursor-pointer p-1 text-xs font-bold text-slate-400 transition-colors hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Cambiar
                </button>
              </div>

              <div className="grid w-full grid-cols-2 items-center rounded-xl border border-slate-200/60 bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setScope('all')}
                  disabled={loading}
                  className={`cursor-pointer rounded-lg py-1.5 text-center text-xs font-bold transition-all disabled:cursor-not-allowed ${scope === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'}`}
                >
                  Todo ({totalPages})
                </button>
                <button
                  type="button"
                  onClick={() => setScope('custom')}
                  disabled={loading}
                  className={`cursor-pointer rounded-lg py-1.5 text-center text-xs font-bold transition-all disabled:cursor-not-allowed ${scope === 'custom' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'}`}
                >
                  Elegir páginas
                </button>
              </div>

              {scope === 'custom' && (
                <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2 text-[11px] font-bold text-slate-500">
                    <span>Seleccionadas: {selectedPages.length} de {totalPages}</span>
                    <div className="flex flex-wrap gap-3">
                      <button type="button" onClick={handleSelectAllPages} disabled={loading} className="cursor-pointer hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40">Todas</button>
                      <button type="button" onClick={handleClearAllPages} disabled={loading} className="cursor-pointer hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40">Ninguna</button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[11px] font-bold text-slate-700">Bloque {currentBlockIndex + 1} de {totalBlocks}</p>
                        <p className="text-[10px] text-slate-400">Páginas {blockStartPage}–{blockEndPage} · {currentBlockSelectionCount} seleccionadas</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button type="button" onClick={handleSelectCurrentBlock} disabled={loading} className="cursor-pointer rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40">Bloque +</button>
                        <button type="button" onClick={handleClearCurrentBlock} disabled={loading} className="cursor-pointer rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40">Bloque −</button>
                        <button type="button" onClick={() => setCurrentBlockIndex((previous) => Math.max(0, previous - 1))} disabled={loading || currentBlockIndex === 0} className="cursor-pointer rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40" title="Bloque anterior" aria-label="Bloque anterior"><ChevronLeft className="h-4 w-4" /></button>
                        <button type="button" onClick={() => setCurrentBlockIndex((previous) => Math.min(totalBlocks - 1, previous + 1))} disabled={loading || currentBlockIndex >= totalBlocks - 1} className="cursor-pointer rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40" title="Bloque siguiente" aria-label="Bloque siguiente"><ChevronRight className="h-4 w-4" /></button>
                      </div>
                    </div>

                    <div ref={scrollRootRef} className="grid max-h-56 grid-cols-2 gap-2.5 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-1.5 sm:grid-cols-3">
                      {blockPages.map((pageNum) => (
                        <PdfPageThumbnail
                          key={pageNum}
                          pdf={pdfDoc}
                          pageNum={pageNum}
                          isSelected={selectedPageSet.has(pageNum)}
                          onToggle={togglePage}
                          onPreview={handlePreview}
                          scrollRootRef={scrollRootRef}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={loading || (scope === 'custom' && selectedPages.length === 0)}
                  onClick={handleProcessText}
                  className="flex h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2 text-xs font-bold text-white shadow-xs transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Extrayendo {processingProgress?.current ?? 0}/{processingProgress?.total ?? pagesToReadLabel(scope, selectedPages, totalPages)}
                    </>
                  ) : (
                    <>Extraer texto seleccionado</>
                  )}
                </button>
                {loading && (
                  <button type="button" onClick={handleCancel} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600" title="Cancelar" aria-label="Cancelar">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {processingProgress && (
                <div className="flex flex-col gap-1">
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${Math.min(100, (processingProgress.current / processingProgress.total) * 100)}%` }} />
                  </div>
                  <p className="text-center text-[10px] font-medium text-slate-500">Extracción estructurada en curso · {processingProgress.current} de {processingProgress.total} páginas</p>
                </div>
              )}
            </div>
          )}

          {lastResult && (
            <div className="flex flex-col gap-1.5 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[10px] text-emerald-800">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <span className="font-semibold">{extractionSummary}</span>
              </div>
              {(lastResult.stats.pagesRequiringOcr > 0 || lastResult.stats.failedPages > 0 || lastResult.stats.truncated) && (
                <div className="flex items-start gap-2 border-t border-emerald-200/70 pt-1.5 text-amber-800">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    {lastResult.stats.pagesRequiringOcr > 0 && `${lastResult.stats.pagesRequiringOcr} página(s) pueden requerir OCR. `}
                    {lastResult.stats.failedPages > 0 && `${lastResult.stats.failedPages} página(s) no se pudieron leer. `}
                    {lastResult.stats.truncated && 'El texto alcanzó el límite permitido.'}
                  </span>
                </div>
              )}
            </div>
          )}

          {localError && (
            <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-600 animate-[fadeIn_0.12s_ease]">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{localError}</span>
            </div>
          )}
        </div>
      )}

      {previewPageNum !== null && pdfDoc && (
        <PdfCarousel
          pdf={pdfDoc}
          initialPage={previewPageNum}
          totalPages={totalPages}
          selectedPages={selectedPages}
          onToggle={togglePage}
          onClose={() => setPreviewPageNum(null)}
        />
      )}
    </div>
  );
}

function pagesToReadLabel(scope, selectedPages, totalPages) {
  return scope === 'all' ? totalPages : selectedPages.length;
}
