import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, FileText, FileUp, Loader2 } from 'lucide-react';

import PdfPageThumbnail from './pdf/PdfPageThumbnail';
import PdfCarousel from './pdf/PdfCarousel';

const PAGE_BLOCK_SIZE = 24;
const EXTRACTION_YIELD_EVERY = 6;

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

export default function PdfExtractor({ onTextExtracted }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [fileName, setFileName] = useState('');
  const [totalPages, setTotalPages] = useState(0);
  const [selectedPages, setSelectedPages] = useState([]);
  const [scope, setScope] = useState('all');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [previewPageNum, setPreviewPageNum] = useState(null);
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(null);

  const scrollRootRef = useRef(null);
  const pdfDocRef = useRef(null);
  const loadingTaskRef = useRef(null);
  const objectUrlRef = useRef(null);
  const loadRequestIdRef = useRef(0);
  const extractionCancelledRef = useRef(false);
  const isMountedRef = useRef(true);

  const clearDocumentState = useCallback(() => {
    setPdfDoc(null);
    setFileName('');
    setTotalPages(0);
    setSelectedPages([]);
    setScope('all');
    setPreviewPageNum(null);
    setCurrentBlockIndex(0);
    setProcessingProgress(null);
  }, []);

  const releasePdfResources = useCallback(async () => {
    extractionCancelledRef.current = true;

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
        /* noop */
      }

      try {
        await currentPdfDoc.destroy();
      } catch {
        /* noop */
      }
    } else if (currentLoadingTask) {
      try {
        await currentLoadingTask.destroy();
      } catch {
        /* noop */
      }
    }

    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
    }
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      loadRequestIdRef.current += 1;
      extractionCancelledRef.current = true;
      void releasePdfResources();
    };
  }, [releasePdfResources]);

  const handleResetDocument = useCallback(async () => {
    loadRequestIdRef.current += 1;
    extractionCancelledRef.current = true;
    setLoading(false);
    setLocalError('');
    clearDocumentState();
    await releasePdfResources();
  }, [clearDocumentState, releasePdfResources]);

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

  const currentBlockSelectionCount = useMemo(() => {
    return blockPages.reduce((count, pageNum) => count + (selectedPageSet.has(pageNum) ? 1 : 0), 0);
  }, [blockPages, selectedPageSet]);

  const isProcessing = loading && processingProgress !== null;

  const togglePage = useCallback((pageNum) => {
    setSelectedPages((prev) => {
      if (prev.includes(pageNum)) {
        return prev.filter((page) => page !== pageNum);
      }

      return [...prev, pageNum].sort((a, b) => a - b);
    });
  }, []);

  const handlePreview = useCallback((pageNum) => {
    setPreviewPageNum(pageNum);
  }, []);

  const handleSelectAllPages = useCallback(() => {
    setSelectedPages(buildPageList(totalPages));
  }, [totalPages]);

  const handleClearAllPages = useCallback(() => {
    setSelectedPages([]);
  }, []);

  const handleSelectCurrentBlock = useCallback(() => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      blockPages.forEach((pageNum) => next.add(pageNum));
      return Array.from(next).sort((a, b) => a - b);
    });
  }, [blockPages]);

  const handleClearCurrentBlock = useCallback(() => {
    setSelectedPages((prev) => prev.filter((pageNum) => !blockPageSet.has(pageNum)));
  }, [blockPageSet]);

  const handleFileChange = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      event.target.value = '';

      if (!file) return;

      const isPdfFile = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (!isPdfFile) {
        setLocalError('Selecciona un archivo PDF valido.');
        return;
      }

      const requestId = loadRequestIdRef.current + 1;
      loadRequestIdRef.current = requestId;
      extractionCancelledRef.current = false;

      setLoading(true);
      setLocalError('');
      clearDocumentState();
      await releasePdfResources();

      if (!isMountedRef.current || requestId !== loadRequestIdRef.current) {
        return;
      }

      try {
        const pdfjsLib = await loadPdfJs();

        if (!isMountedRef.current || requestId !== loadRequestIdRef.current) {
          return;
        }

        const objectUrl = URL.createObjectURL(file);
        objectUrlRef.current = objectUrl;

        const loadingTask = pdfjsLib.getDocument({ url: objectUrl });
        loadingTaskRef.current = loadingTask;

        const loadedPdf = await loadingTask.promise;
        if (!isMountedRef.current || requestId !== loadRequestIdRef.current) {
          await loadedPdf.destroy();
          return;
        }

        pdfDocRef.current = loadedPdf;
        setPdfDoc(loadedPdf);
        setFileName(file.name);
        setTotalPages(loadedPdf.numPages);
        setSelectedPages(buildPageList(loadedPdf.numPages));
        setScope('all');
        setCurrentBlockIndex(0);
      } catch (error) {
        if (!isMountedRef.current || requestId !== loadRequestIdRef.current) {
          return;
        }

        console.error('[PdfExtractor] Error loading PDF:', error);
        clearDocumentState();
        await releasePdfResources();
        setLocalError('No se pudo procesar la estructura del PDF. Asegurate de que no este protegido.');
      } finally {
        if (isMountedRef.current && requestId === loadRequestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [clearDocumentState, releasePdfResources]
  );

  const handleProcessText = useCallback(async () => {
    const activePdf = pdfDocRef.current;
    if (!activePdf) return;

    const pagesToRead = scope === 'all'
      ? buildPageList(totalPages)
      : [...selectedPages].sort((a, b) => a - b);

    extractionCancelledRef.current = false;
    setLoading(true);
    setLocalError('');
    setProcessingProgress({ current: 0, total: pagesToRead.length });

    try {
      const extractedChunks = [];

      for (let index = 0; index < pagesToRead.length; index += 1) {
        if (extractionCancelledRef.current) {
          throw new Error('La extraccion fue cancelada antes de terminar.');
        }

        const pageNum = pagesToRead[index];

        try {
          const page = await activePdf.getPage(pageNum);

          try {
            const textContent = await page.getTextContent();
            const pageStrings = textContent.items
              .map((item) => (typeof item?.str === 'string' ? item.str : ''))
              .filter(Boolean);

            if (pageStrings.length > 0) {
              extractedChunks.push(`\n--- [Texto de la Pagina ${pageNum}] ---\n${pageStrings.join(' ')}`);
            }
          } finally {
            page.cleanup();
          }
        } catch (pageError) {
          if (!extractionCancelledRef.current) {
            console.warn(`[PdfExtractor] Error in page ${pageNum}, skipping...`, pageError);
          }
        }

        const processedPages = index + 1;
        if (processedPages === pagesToRead.length || processedPages % EXTRACTION_YIELD_EVERY === 0) {
          setProcessingProgress({ current: processedPages, total: pagesToRead.length });
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      const completeText = extractedChunks.join('').trim();
      if (!completeText) {
        throw new Error('El PDF parece estar compuesto unicamente por imagenes escaneadas. No se detectaron capas de texto legibles.');
      }

      onTextExtracted(completeText);
      await handleResetDocument();

      if (isMountedRef.current) {
        setIsOpen(false);
      }
    } catch (error) {
      if (isMountedRef.current) {
        setLocalError(error.message || 'Error durante el volcado de texto.');
      }
    } finally {
      extractionCancelledRef.current = false;

      if (isMountedRef.current) {
        setProcessingProgress(null);
        setLoading(false);
      }
    }
  }, [handleResetDocument, onTextExtracted, scope, selectedPages, totalPages]);

  const blockStartPage = blockPages[0] ?? 0;
  const blockEndPage = blockPages[blockPages.length - 1] ?? 0;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-3xs">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100/70 transition-colors cursor-pointer text-left"
      >
        <div className="flex items-center gap-2">
          <FileUp className="w-4 h-4 text-indigo-500 shrink-0" />
          <span className="text-xs font-bold text-slate-700">¿Quieres importar apuntes desde un PDF?</span>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {isOpen && (
        <div className="p-4 border-t border-slate-200/60 bg-white flex flex-col gap-3 animate-[slideUp_0.15s_ease]">
          {!pdfDoc ? (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl py-7 px-4 bg-slate-50/50 hover:bg-slate-50 transition-all cursor-pointer group text-center">
              {loading ? (
                <Loader2 className="w-7 h-7 text-indigo-500 animate-spin mb-2" />
              ) : (
                <FileText className="w-7 h-7 text-slate-300 group-hover:text-indigo-400 transition-colors mb-2" />
              )}
              <span className="text-xs font-bold text-slate-600">Haz clic para cargar tu documento</span>
              <span className="text-[10px] text-slate-400 mt-0.5">El modulo PDF se carga solo cuando eliges un archivo</span>
              <input type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" disabled={loading} />
            </label>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                <div className="flex items-center gap-2 truncate max-w-[75%]">
                  <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span className="text-xs font-semibold text-slate-700 truncate">{fileName}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void handleResetDocument();
                  }}
                  className="text-slate-400 hover:text-red-500 text-xs font-bold p-1 transition-colors cursor-pointer"
                >
                  Cambiar
                </button>
              </div>

              <div className="flex bg-slate-100 p-1 border border-slate-200/60 rounded-xl items-center w-full grid grid-cols-2">
                <button
                  type="button"
                  onClick={() => setScope('all')}
                  className={`text-center py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    scope === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  Todo el documento ({totalPages} pag.)
                </button>
                <button
                  type="button"
                  onClick={() => setScope('custom')}
                  className={`text-center py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    scope === 'custom' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  Elegir paginas
                </button>
              </div>

              {scope === 'custom' && (
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3 text-[11px] font-bold text-slate-500 border-b border-slate-200 pb-2 flex-wrap">
                    <span>Seleccionadas: {selectedPages.length} de {totalPages}</span>
                    <div className="flex gap-3 flex-wrap">
                      <button type="button" onClick={handleSelectAllPages} className="hover:text-slate-800 cursor-pointer">Todas</button>
                      <button type="button" onClick={handleClearAllPages} className="hover:text-slate-800 cursor-pointer">Ninguna</button>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl bg-white p-2.5 flex flex-col gap-2 shadow-2xs">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <p className="text-[11px] font-bold text-slate-700">Bloque {currentBlockIndex + 1} de {totalBlocks}</p>
                        <p className="text-[10px] text-slate-400">Paginas {blockStartPage} - {blockEndPage} de {totalPages} | {currentBlockSelectionCount} seleccionadas en este bloque</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={handleSelectCurrentBlock}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-[10px] font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          Bloque +
                        </button>
                        <button
                          type="button"
                          onClick={handleClearCurrentBlock}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-[10px] font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          Bloque -
                        </button>
                        <button
                          type="button"
                          onClick={() => setCurrentBlockIndex((prev) => Math.max(0, prev - 1))}
                          disabled={currentBlockIndex === 0}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Bloque anterior"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCurrentBlockIndex((prev) => Math.min(totalBlocks - 1, prev + 1))}
                          disabled={currentBlockIndex >= totalBlocks - 1}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Bloque siguiente"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div
                      ref={scrollRootRef}
                      className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-1.5 bg-slate-50 border border-slate-200 rounded-xl"
                    >
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

              <button
                type="button"
                disabled={loading || (scope === 'custom' && selectedPages.length === 0)}
                onClick={handleProcessText}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-45 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer h-9 mt-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {isProcessing && processingProgress
                      ? `Extrayendo ${processingProgress.current}/${processingProgress.total}`
                      : 'Preparando documento...'}
                  </>
                ) : (
                  <>Volcar texto visual seleccionado al editor</>
                )}
              </button>

              {processingProgress && (
                <p className="text-[11px] text-slate-500 text-center font-medium">
                  Extraccion incremental activa: {processingProgress.current} de {processingProgress.total} paginas procesadas.
                </p>
              )}
            </div>
          )}

          {localError && (
            <p className="text-[11px] font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 animate-[fadeIn_0.12s_ease]">
              {localError}
            </p>
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
