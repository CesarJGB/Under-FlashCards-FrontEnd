import { Loader2, X } from 'lucide-react';
import { useId } from 'react';
import { useBodyScrollLock } from '../lib/scrollLock';
import useModalAccessibility from '../hooks/useModalAccessibility';

export default function PdfExportOverlay({ isOpen, progress, onCancel, title = 'Generando tu PDF', itemLabel = 'tarjetas' }) {
  const ownerId = useId();
  useBodyScrollLock(Boolean(isOpen), `pdf-export-overlay-${ownerId}`);
  const dialogRef = useModalAccessibility({ open: Boolean(isOpen), onClose: onCancel });
  if (!isOpen) return null;

  const total = progress?.total || 0;
  const current = progress?.current || 0;
  const percentage = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

  return (
    <div ref={dialogRef} tabIndex={-1} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/35 p-5 outline-none backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-2xl animate-[fadeIn_0.15s_ease]">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-black text-slate-900 dark:text-white">{title}</h2>
            <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
              {progress?.message || 'Preparando el documento...'}
            </p>
          </div>
          {typeof onCancel === 'function' && (
            <button
              type="button"
              onClick={onCancel}
              className="min-h-11 min-w-11 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              title="Cancelar exportación"
              aria-label="Cancelar exportación"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {total > 0 && (
          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
              <span>{current} de {total} {itemLabel}</span>
              <span>{percentage}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 transition-[width] duration-200" style={{ width: `${percentage}%` }} />
            </div>
          </div>
        )}

        <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
          Puedes cancelar en cualquier momento.
        </p>
      </div>
    </div>
  );
}
