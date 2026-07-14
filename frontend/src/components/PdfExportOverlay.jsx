import { Loader2, X } from 'lucide-react';

export default function PdfExportOverlay({ isOpen, progress, onCancel }) {
  if (!isOpen) return null;

  const total = progress?.total || 0;
  const current = progress?.current || 0;
  const percentage = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/35 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Generando PDF">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl animate-[fadeIn_0.15s_ease]">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-black text-slate-900">Generando tu PDF</h2>
            <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">
              {progress?.message || 'Preparando el documento...'}
            </p>
          </div>
          {typeof onCancel === 'function' && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              title="Cancelar exportación"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {total > 0 && (
          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold text-slate-500">
              <span>{current} de {total} tarjetas</span>
              <span>{percentage}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 transition-[width] duration-200" style={{ width: `${percentage}%` }} />
            </div>
          </div>
        )}

        <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
          Los mazos grandes o con muchas imágenes pueden tardar un poco más. Puedes cancelar en cualquier momento.
        </p>
      </div>
    </div>
  );
}
