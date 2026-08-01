import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, FileText, X } from 'lucide-react';
import { useBodyScrollLock } from '../../lib/scrollLock';
import './ProcessingActionSheet.css';

const AI_LABEL = 'AI GENERATION';

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatCount(value) {
  return toFiniteNumber(value).toLocaleString('es-MX');
}

function getProgressLabel(variant, progress) {
  if (progress?.label) return progress.label;
  if (variant === 'pdf') {
    const currentPage = progress?.pageNumber ?? progress?.current ?? 0;
    return progress?.phase === 'loading'
      ? 'Cargando documento...'
      : `Analizando página ${formatCount(currentPage)}...`;
  }
  return progress?.message || 'Preparando tarjetas...';
}

function AiAnimation({ completed }) {
  return (
    <div
      className={`processing-sheet__ai-loader-wrapper${completed ? ' is-complete' : ''}`}
      aria-hidden="true"
    >
      <div className="processing-sheet__ai-loader" />
      <div className="processing-sheet__ai-word">
        {AI_LABEL.split('').map((letter, index) => (
          <span
            key={`${letter}-${index}`}
            className={`processing-sheet__ai-letter${letter === ' ' ? ' is-space' : ''}`}
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            {letter === ' ' ? '\u00a0' : letter}
          </span>
        ))}
      </div>
    </div>
  );
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
              <FileText />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function normalizeDetails(details) {
  if (!details) return [];
  return (Array.isArray(details) ? details : [details]).filter(Boolean);
}

export default function ProcessingActionSheet({
  open,
  variant = 'ai',
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
  const isPdf = variant === 'pdf';
  const isComplete = status === 'success';
  const isProcessing = status === 'processing';
  const current = Math.max(0, toFiniteNumber(isPdf ? progress?.current : progress?.generated));
  const total = Math.max(0, toFiniteNumber(isPdf ? progress?.total : (progress?.total ?? progress?.target)));
  const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  const generated = Math.max(0, toFiniteNumber(progress?.generated));
  const audited = Math.max(0, toFiniteNumber(progress?.audited));
  const accepted = Math.max(0, toFiniteNumber(progress?.accepted));
  const target = Math.max(0, toFiniteNumber(progress?.target ?? progress?.total));
  const detailItems = normalizeDetails(details);
  const resolvedTitle = title || (isPdf ? 'Analizando PDF' : 'Generando tarjetas');
  const resolvedMessage = message || progress?.message || (isPdf ? 'Procesando el documento...' : 'La IA está preparando tus tarjetas...');

  useBodyScrollLock(Boolean(open), `processing-action-sheet-${id}`);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (isProcessing) {
        onCancel?.();
      } else {
        onClose?.();
      }
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
            {isPdf ? <PdfAnimation completed={isComplete} /> : <AiAnimation completed={isComplete} />}
          </div>

          <div role="status" aria-live="polite" className="mx-auto max-w-md">
            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-500">
              {isComplete ? 'Proceso terminado' : isPdf ? 'Extracción inteligente' : 'Generación inteligente'}
            </p>
            <h2 id={titleId} className="text-lg font-black leading-tight text-slate-900">
              {resolvedTitle}
            </h2>
            {fileName && <p className="mt-1 truncate text-xs font-semibold text-slate-400">{fileName}</p>}
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">{resolvedMessage}</p>

            {!isComplete && progress && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-xs font-bold text-slate-700">{getProgressLabel(variant, progress)}</span>
                  <span className="shrink-0 text-xs font-black tabular-nums text-indigo-600">{percent}%</span>
                </div>
                {total > 0 && (
                  <div className="h-1.5 overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 transition-[width] duration-300"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                )}
                {isPdf ? (
                  <p className="mt-2 text-center text-[11px] font-semibold text-slate-500">
                    {progress.phase === 'loading'
                      ? 'Preparando las páginas del documento'
                      : `Página ${formatCount(progress.pageNumber ?? progress.current)} de ${formatCount(progress.total)}`}
                  </p>
                ) : (
                  <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[10px] font-semibold text-slate-500">
                    <span><strong className="block text-sm font-black text-slate-800">{formatCount(generated)}</strong>generadas</span>
                    <span><strong className="block text-sm font-black text-slate-800">{formatCount(audited)}</strong>auditadas</span>
                    <span><strong className="block text-sm font-black text-indigo-600">{formatCount(accepted)}{target ? `/${formatCount(target)}` : ''}</strong>listas</span>
                  </div>
                )}
              </div>
            )}

            {isComplete && (
              <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-3 py-2.5 text-left">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  <p className="text-xs font-bold leading-relaxed text-emerald-800">{summary || 'La operación terminó correctamente.'}</p>
                </div>
                {variant === 'ai' && (
                  <div className="mt-2 grid grid-cols-3 gap-1 border-t border-emerald-200/70 pt-2 text-center text-[10px] font-semibold text-emerald-700">
                    <span><strong className="block text-sm font-black">{formatCount(generated)}</strong>generadas</span>
                    <span><strong className="block text-sm font-black">{formatCount(audited)}</strong>auditadas</span>
                    <span><strong className="block text-sm font-black">{formatCount(accepted)}</strong>listas</span>
                  </div>
                )}
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
