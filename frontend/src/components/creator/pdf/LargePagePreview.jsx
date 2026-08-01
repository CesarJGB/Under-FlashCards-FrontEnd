import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, X, ZoomIn } from 'lucide-react';

export default function LargePagePreview({ pdf, pageNum, onClose }) {
  const canvasRef = useRef(null);
  const backdropRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [renderError, setRenderError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let renderTask = null;
    let page = null;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    setLoading(true);
    setRenderError(false);
    canvas.width = 0;
    canvas.height = 0;

    (async () => {
      try {
        page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.4 });
        if (cancelled || !canvasRef.current) return;
        canvas.height = Math.ceil(viewport.height);
        canvas.width = Math.ceil(viewport.width);
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) throw new Error('Canvas 2D no disponible.');
        renderTask = page.render({ canvasContext: context, viewport });
        await renderTask.promise;
        if (!cancelled) setLoading(false);
      } catch (error) {
        if (cancelled || error?.name === 'RenderingCancelledException') return;
        console.warn('[LargePagePreview] Error rendering page:', error);
        if (!cancelled) {
          setLoading(false);
          setRenderError(true);
        }
      } finally {
        try { page?.cleanup(); } catch { /* best effort */ }
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
      canvas.width = 0;
      canvas.height = 0;
    };
  }, [pageNum, pdf]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div ref={backdropRef} onClick={(event) => event.target === backdropRef.current && onClose()} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-xs animate-[fadeIn_0.12s_ease]">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-[scaleUp_0.15s_ease]" role="dialog" aria-modal="true" aria-label={`Vista previa de la página ${pageNum}`}>
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
          <div className="flex items-center gap-2"><ZoomIn className="h-4 w-4 text-indigo-600" /><span className="text-xs font-bold text-slate-700">Página {pageNum}</span></div>
          <button type="button" onClick={onClose} className="cursor-pointer rounded-xl p-1.5 text-slate-400 transition-all hover:bg-slate-200/60 hover:text-slate-700" aria-label="Cerrar vista previa"><X className="h-4 w-4 stroke-[2.5]" /></button>
        </div>
        <div className="relative flex min-h-[350px] flex-1 items-start justify-center overflow-auto bg-slate-100/60 p-3">
          {loading && <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-slate-100/90 text-xs font-bold text-slate-500"><Loader2 className="h-5 w-5 animate-spin text-indigo-600" />Preparando vista previa...</div>}
          {renderError && <div className="flex flex-col items-center justify-center gap-2 text-xs font-semibold text-slate-500"><AlertTriangle className="h-5 w-5 text-amber-500" />Vista previa no disponible.</div>}
          <canvas ref={canvasRef} className={`h-auto max-w-full rounded-xl border border-slate-200 bg-white shadow-md ${renderError ? 'hidden' : ''}`} />
        </div>
      </div>
    </div>
  );
}
