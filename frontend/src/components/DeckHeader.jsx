import { useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRightLeft,
  Download,
  FileJson,
  FileText,
  Loader2,
  MoreHorizontal,
  X,
} from 'lucide-react';
import ActionSheet from './common/ActionSheet';

export default function DeckHeader({
  deck,
  mode,
  setMode,
  onBack,
  onExport,
  onExportPDF,
  isExportingPdf = false,
  pdfProgress,
  pdfError,
  pdfWarnings = [],
  onCancelPdfExport,
  onHeightChange,
}) {
  const [downloadSheetOpen, setDownloadSheetOpen] = useState(false);
  const [pdfSheetOpen, setPdfSheetOpen] = useState(false);
  const [modeSheetOpen, setModeSheetOpen] = useState(false);
  const headerRef = useRef(null);

  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header || typeof onHeightChange !== 'function') return undefined;

    const updateHeight = () => {
      onHeightChange(Math.ceil(header.getBoundingClientRect().height));
    };

    updateHeight();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateHeight);
      return () => window.removeEventListener('resize', updateHeight);
    }

    const observer = new ResizeObserver(updateHeight);
    observer.observe(header);
    return () => observer.disconnect();
  }, [onHeightChange]);

  const isEditorMode = mode === 'edit';
  const isReviewMode = mode === 'review';
  const nextMode = isReviewMode ? 'edit' : 'review';

  const downloadOptions = [
    {
      id: 'deck',
      label: 'Descargar mazo',
      description: 'Guarda una copia de tus tarjetas en formato JSON.',
      icon: FileJson,
      onSelect: () => {
        setDownloadSheetOpen(false);
        onExport?.();
      },
    },
    {
      id: 'pdf',
      label: 'Descargar PDF',
      description: 'Elige el formato de PDF que quieres generar.',
      icon: FileText,
      onSelect: () => {
        setDownloadSheetOpen(false);
        setPdfSheetOpen(true);
      },
    },
    {
      id: 'cancel',
      label: 'Cancelar',
      icon: X,
      onSelect: () => setDownloadSheetOpen(false),
    },
  ];

  const pdfOptions = [
    {
      id: 'guide',
      label: 'Guía de estudio',
      description: 'PDF continuo para lectura.',
      icon: FileText,
      onSelect: () => onExportPDF?.('guide'),
    },
    {
      id: 'cards',
      label: 'Tarjetas imprimibles',
      description: 'Tarjetas listas para imprimir y recortar.',
      icon: Download,
      onSelect: () => onExportPDF?.('cards'),
    },
    {
      id: 'questions',
      label: 'Banco de preguntas',
      description: 'Preguntas numeradas para autoevaluarte.',
      icon: FileText,
      onSelect: () => onExportPDF?.('questions'),
    },
    {
      id: 'answers',
      label: 'Banco de respuestas',
      description: 'Respuestas numeradas correspondientes.',
      icon: FileText,
      onSelect: () => onExportPDF?.('answers'),
    },
    {
      id: 'cancel',
      label: 'Cancelar',
      icon: X,
      onSelect: () => setPdfSheetOpen(false),
    },
  ];

  const modeOptions = [
    {
      id: nextMode,
      label: isReviewMode ? 'Cambiar a modo edición' : 'Cambiar a modo repaso',
      icon: ArrowRightLeft,
      onSelect: () => setMode(nextMode),
    },
  ];

  return (
    <>
      <header
        ref={headerRef}
        className="fixed top-0 left-0 right-0 z-50 flex min-h-[64px] w-full items-center justify-center isolate border-b border-slate-200 bg-white/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95"
      >
        {isEditorMode && (
          <div className="absolute left-4 z-20 flex items-center animate-[fadeIn_0.1s_ease]">
            <button
              type="button"
              onClick={onBack}
              title="Volver a la biblioteca"
              aria-label="Volver a la biblioteca"
              className="flex min-h-11 min-w-11 aspect-square cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-3xs transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-[0.97] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        <div
          className="pointer-events-none flex min-w-[96px] flex-col items-center justify-center text-center leading-tight"
          aria-live="polite"
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            Modo
          </span>
          <span className="text-sm font-bold text-slate-900 dark:text-white">
            {isReviewMode ? 'repaso' : 'edición'}
          </span>
        </div>

        <div className="absolute right-4 z-20 flex items-center gap-2">
          {isEditorMode && (
            <button
              type="button"
              onClick={() => !isExportingPdf && setDownloadSheetOpen(true)}
              disabled={isExportingPdf}
              title="Descargar"
              aria-label="Abrir opciones de descarga"
              className="flex min-h-11 min-w-11 aspect-square cursor-pointer items-center justify-center rounded-xl bg-slate-900 p-2.5 text-white shadow-sm transition-all hover:bg-slate-800 active:scale-[0.97] disabled:cursor-wait disabled:opacity-80 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              {isExportingPdf ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          )}

          {(isEditorMode || isReviewMode) && (
            <button
              type="button"
              onClick={() => setModeSheetOpen(true)}
              title="Cambiar modo"
              aria-label={isReviewMode ? 'Cambiar a modo edición' : 'Cambiar a modo repaso'}
              className="flex min-h-11 min-w-11 aspect-square cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-3xs transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-[0.97] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
            </button>
          )}

          {isExportingPdf && (
            <div className="absolute right-0 top-full z-30 mt-2 flex w-72 items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 shadow-sm dark:border-indigo-900/60 dark:bg-indigo-950/70 dark:text-indigo-200">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{pdfProgress?.message || 'Generando PDF...'}</span>
              {typeof onCancelPdfExport === 'function' && (
                <button
                  type="button"
                  onClick={onCancelPdfExport}
                  className="cursor-pointer rounded-lg p-1 text-indigo-500 transition-colors hover:bg-indigo-100 hover:text-indigo-700 dark:hover:bg-indigo-900/60"
                  title="Cancelar exportación"
                  aria-label="Cancelar exportación"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          )}

          {!isExportingPdf && pdfError && (
            <div role="alert" className="absolute right-0 top-full z-30 mt-2 w-72 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/70 dark:text-rose-200">
              {pdfError}
            </div>
          )}

          {!isExportingPdf && pdfWarnings.length > 0 && (
            <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/70 dark:text-amber-200">
              {pdfWarnings.length === 1 ? pdfWarnings[0].message : `El PDF se generó con ${pdfWarnings.length} advertencias.`}
            </div>
          )}
        </div>
      </header>

      <ActionSheet
        open={downloadSheetOpen}
        title="Descargar"
        options={downloadOptions}
        onClose={() => setDownloadSheetOpen(false)}
        compact
      />

      <ActionSheet
        open={pdfSheetOpen}
        title="Descargar PDF"
        options={pdfOptions}
        onClose={() => setPdfSheetOpen(false)}
        compact
      />

      <ActionSheet
        open={modeSheetOpen}
        title="Cambiar modo"
        options={modeOptions}
        onClose={() => setModeSheetOpen(false)}
        compact
      />
    </>
  );
}
