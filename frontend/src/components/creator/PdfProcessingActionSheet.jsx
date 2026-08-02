import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, X } from 'lucide-react';
import { useBodyScrollLock } from '../../lib/scrollLock';
import '../common/ProcessingActionSheet.css';

const PDF_PAGE_PATH = 'M90,0 L90,120 L11,120 C4.92486775,120 0,115.075132 0,109 L0,11 C0,4.92486775 4.92486775,0 11,0 L90,0 Z M71.5,81 L18.5,81 C17.1192881,81 16,82.1192881 16,83.5 C16,84.8254834 17.0315359,85.9100387 18.3356243,85.9946823 L18.5,86 L71.5,86 C72.8807119,86 74,84.8807119 74,83.5 C74,82.1745166 72.9684641,81.0899613 71.6643757,81.0053177 L71.5,81 Z M71.5,57 L18.5,57 C17.1192881,57 16,58.1192881 16,59.5 C16,60.8254834 17.0315359,61.9100387 18.3356243,61.9946823 L18.5,62 L71.5,62 C72.8807119,62 74,60.8807119 74,59.5 C74,58.1192881 72.8807119,57 71.5,57 Z M71.5,33 L18.5,33 C17.1192881,33 16,34.1192881 16,35.5 C16,36.8807119 72.8807119,33 71.5,33 Z';

const PHASES = [
  {
    id: 'extracting',
    label: 'Extrayendo contenido',
    detail: 'Leyendo texto y detectando la estructura de cada página.',
    start: 0,
    end: 76,
  },
  {
    id: 'post-processing',
    label: 'Limpiando estructura',
    detail: 'Eliminando marcas, encabezados y pies repetidos.',
    start: 76,
    end: 94,
  },
  {
    id: 'finalizing',
    label: 'Preparando resultado',
    detail: 'Uniendo el texto y el diagnóstico del documento.',
    start: 94,
    end: 100,
  },
];

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatCount(value) {
  return toFiniteNumber(value).toLocaleString('es-MX');
}

function normalizeDetails(details) {
  if (!details) return [];
  return (Array.isArray(details) ? details : [details]).filter(Boolean);
}

function getPhase(progress) {
  return PHASES.find((phase) => phase.id === progress?.phase) || PHASES[0];
}

function getProgressPercent(progress, phase) {
  const current = Math.max(0, toFiniteNumber(progress?.current));
  const total = Math.max(0, toFiniteNumber(progress?.total));
  const phasePercent = total > 0 ? Math.min(1, current / total) : 0;
  return Math.round(phase.start + ((phase.end - phase.start) * phasePercent));
}

function getProgressDetail(progress, phase) {
  if (progress?.message) return progress.message;
  if (phase.id === 'extracting') {
    const current = progress?.pageNumber ?? progress?.current ?? 0;
    return `Página ${formatCount(current)} de ${formatCount(progress?.total)}`;
  }
  return phase.detail;
}

function PdfAnimation({ completed }) {
  return (
    <div
      className={`processing-sheet__pdf-loader${completed ? ' is-complete' : ''}`}
      aria-hidden="true"
    >
      <div>
        <ul>
          {[0, 1, 2, 3, 4].map((page) => (
            <li key={page}>
              <svg viewBox="0 0 90 120" fill="currentColor" role="presentation" focusable="false">
                <path d={PDF_PAGE_PATH} />
              </svg>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function PdfProcessingActionSheet({
  open,
  status = 'processing',
  title,
  fileName,
  message,
  progress,
  summary,
  details,
  onClose,
  onCancel,
  cancelLabel = 'Cancelar',
  autoCloseMs = 0,
}) {
  const dialogRef = useRef(null);
  const id = useId();
  const titleId = `${id}-title`;
  const isComplete = status === 'success';
  const isProcessing = status === 'processing';
  const phase = getPhase(progress);
  const phaseIndex = PHASES.findIndex((item) => item.id === phase.id);
  const percent = isComplete ? 100 : getProgressPercent(progress, phase);
  const detailItems = normalizeDetails(details);
  const resolvedTitle = title || 'Analizando PDF';
  const resolvedMessage = isComplete
    ? (message || 'La estructura del documento quedó lista para generar tus tarjetas.')
    : (message || phase.detail);

  useBodyScrollLock(Boolean(open), `pdf-processing-sheet-${id}`);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (isProcessing) onCancel?.();
      else onClose?.();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isProcessing, onCancel, onClose, open]);

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    const focusTimer = window.setTimeout(() => dialogRef.current?.focus(), 0);

    return () => {
      window.clearTimeout(focusTimer);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open || !isComplete || !autoCloseMs || typeof onClose !== 'function') return undefined;
    const closeTimer = window.setTimeout(onClose, autoCloseMs);
    return () => window.clearTimeout(closeTimer);
  }, [autoCloseMs, isComplete, onClose, open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div className="processing-sheet__backdrop fixed inset-0 z-[110]" aria-hidden="true" />

      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="processing-sheet__panel fixed inset-x-0 bottom-0 z-[120] max-h-[calc(100dvh-0.5rem)] overflow-y-auto rounded-t-[2rem] bg-white shadow-2xl outline-none"
      >
        <div className="flex justify-center pb-2 pt-3" aria-hidden="true">
          <div className="h-1 w-10 rounded-full bg-slate-200" />
        </div>

        <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-1 text-center">
          <div className="processing-sheet__animation-stage">
            <PdfAnimation completed={isComplete} />
          </div>

          <div role="status" aria-live="polite" className="mx-auto max-w-md">
            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-500">
              {isComplete ? 'Proceso terminado' : 'Extracción inteligente'}
            </p>
            <h2 id={titleId} className="text-lg font-black leading-tight text-slate-900">
              {resolvedTitle}
            </h2>
            {fileName && <p className="mt-1 truncate text-xs font-semibold text-slate-400">{fileName}</p>}
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">{resolvedMessage}</p>

            {!isComplete && progress && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-xs font-bold text-slate-700">{phase.label}</span>
                  <span className="shrink-0 text-xs font-black tabular-nums text-indigo-600">{percent}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 transition-[width] duration-300"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="mt-2 text-center text-[11px] font-semibold text-slate-500">
                  {getProgressDetail(progress, phase)}
                </p>

                <ol className="mt-3 space-y-1.5 border-t border-slate-200 pt-2.5">
                  {PHASES.map((item, index) => {
                    const completed = index < phaseIndex;
                    const active = index === phaseIndex;
                    return (
                      <li
                        key={item.id}
                        className={`flex items-center gap-2 text-[11px] font-semibold ${
                          completed ? 'text-emerald-600' : active ? 'text-indigo-700' : 'text-slate-400'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          completed ? 'bg-emerald-500' : active ? 'bg-indigo-500' : 'bg-slate-300'
                        }`}
                        />
                        {item.label}
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}

            {isComplete && (
              <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-3 py-2.5 text-left">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  <p className="text-xs font-bold leading-relaxed text-emerald-800">{summary || 'La operación terminó correctamente.'}</p>
                </div>
                {detailItems.length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-emerald-200/70 pt-2 text-[11px] font-medium leading-relaxed text-emerald-800">
                    {detailItems.map((detail, index) => <p key={`${String(detail)}-${index}`}>{detail}</p>)}
                  </div>
                )}
              </div>
            )}

            {isProcessing && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                {cancelLabel}
              </button>
            )}
          </div>
        </div>
      </section>
    </>,
    document.body,
  );
}
