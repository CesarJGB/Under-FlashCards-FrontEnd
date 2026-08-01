import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckSquare, ChevronLeft, ChevronRight, Loader2, Square, X } from 'lucide-react';

export default function PdfCarousel({ pdf, initialPage, totalPages, selectedPages, onToggle, onClose }) {
  const [currentPage, setCurrentPage] = useState(() => Math.min(totalPages, Math.max(1, initialPage)));
  const [loading, setLoading] = useState(true);
  const [renderError, setRenderError] = useState(false);
  const canvasRef = useRef(null);
  const touchStart = useRef(null);

  useEffect(() => {
    setCurrentPage(Math.min(totalPages, Math.max(1, initialPage)));
  }, [initialPage, totalPages]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') setCurrentPage((page) => Math.max(1, page - 1));
      if (event.key === 'ArrowRight') setCurrentPage((page) => Math.min(totalPages, page + 1));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, totalPages]);

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
        page = await pdf.getPage(currentPage);
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
        console.warn('[PdfCarousel] Error rendering page:', error);
        if (!cancelled) {
          setRenderError(true);
          setLoading(false);
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
  }, [currentPage, pdf]);

  const goPrev = () => setCurrentPage((page) => Math.max(1, page - 1));
  const goNext = () => setCurrentPage((page) => Math.min(totalPages, page + 1));
  const isSelected = selectedPages.includes(currentPage);

  const handleTouchStart = (event) => { touchStart.current = event.touches[0]?.clientX ?? null; };
  const handleTouchEnd = (event) => {
    if (touchStart.current === null) return;
    const touchEnd = event.changedTouches[0]?.clientX ?? touchStart.current;
    const difference = touchStart.current - touchEnd;
    touchStart.current = null;
    if (difference > 50) goNext();
    if (difference < -50) goPrev();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-0 backdrop-blur-md animate-[fadeIn_0.15s_ease]">
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[90vh] sm:max-w-xl sm:rounded-2xl" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} role="dialog" aria-modal="true" aria-label={`Vista previa de la página ${currentPage}`}>
        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent px-4 py-4">
          <button type="button" onClick={onClose} className="cursor-pointer rounded-full bg-white/20 p-2 text-white backdrop-blur-md transition-colors hover:bg-white/30" aria-label="Cerrar vista previa"><X className="h-5 w-5" /></button>
          <button type="button" onClick={() => onToggle(currentPage)} className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${isSelected ? 'border-indigo-400 bg-indigo-600 text-white' : 'border-white/30 bg-white/20 text-white'}`}>
            {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            {isSelected ? 'Seleccionada' : 'Seleccionar'}
          </button>
        </div>

        <div className="relative flex flex-1 items-start justify-center overflow-auto bg-slate-100 p-2 pb-20 pt-20">
          {loading && <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100/60"><Loader2 className="h-6 w-6 animate-spin text-indigo-600" /></div>}
          {renderError && <div className="flex min-h-[350px] flex-col items-center justify-center gap-2 text-xs font-semibold text-slate-500"><AlertTriangle className="h-6 w-6 text-amber-500" />No se pudo renderizar esta página.</div>}
          <canvas ref={canvasRef} className={`h-auto max-w-full rounded-lg bg-white shadow-xl ${renderError ? 'hidden' : ''}`} />
        </div>

        <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between bg-gradient-to-t from-black/60 to-transparent px-6 py-6">
          <button type="button" disabled={currentPage === 1} onClick={goPrev} className="cursor-pointer rounded-full bg-white/20 p-3 text-white transition-all active:scale-90 disabled:cursor-not-allowed disabled:opacity-20" aria-label="Página anterior"><ChevronLeft className="h-6 w-6" /></button>
          <div className="rounded-full bg-white/90 px-4 py-1.5 text-xs font-black text-slate-900 shadow-sm">{currentPage} / {totalPages}</div>
          <button type="button" disabled={currentPage === totalPages} onClick={goNext} className="cursor-pointer rounded-full bg-white/20 p-3 text-white transition-all active:scale-90 disabled:cursor-not-allowed disabled:opacity-20" aria-label="Página siguiente"><ChevronRight className="h-6 w-6" /></button>
        </div>
      </div>
    </div>
  );
}
