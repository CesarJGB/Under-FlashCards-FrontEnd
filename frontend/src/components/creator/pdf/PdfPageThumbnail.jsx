import { memo, useEffect, useRef, useState } from 'react';
import { CheckSquare, Loader2, Square, ZoomIn } from 'lucide-react';

function PdfPageThumbnail({ pdf, pageNum, isSelected, onToggle, onPreview, scrollRootRef }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState(false);

  useEffect(() => {
    const target = containerRef.current;
    if (!target) return undefined;

    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting || entry.intersectionRatio > 0),
      {
        root: scrollRootRef?.current || null,
        rootMargin: '160px 0px',
        threshold: 0.01,
      },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [scrollRootRef]);

  useEffect(() => {
    let cancelled = false;
    let renderTask = null;
    let page = null;
    const canvas = canvasRef.current;

    const clearCanvas = () => {
      if (!canvas) return;
      canvas.width = 0;
      canvas.height = 0;
    };

    if (!canvas || !isVisible) {
      setRendering(false);
      if (!isVisible) clearCanvas();
      return undefined;
    }

    setRendering(true);
    setRenderError(false);

    (async () => {
      try {
        page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 0.22 });
        if (cancelled || !canvasRef.current) return;

        canvas.height = Math.ceil(viewport.height);
        canvas.width = Math.ceil(viewport.width);
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) throw new Error('Canvas 2D no disponible.');

        renderTask = page.render({ canvasContext: context, viewport });
        await renderTask.promise;
        if (!cancelled) setRendering(false);
      } catch (error) {
        if (cancelled || error?.name === 'RenderingCancelledException') return;
        console.warn(`[PdfPageThumbnail.v1] Error rendering page ${pageNum}:`, error);
        if (!cancelled) {
          setRenderError(true);
          setRendering(false);
        }
      } finally {
        try {
          page?.cleanup();
        } catch {
          // The page can already be destroyed when the document changes.
        }
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
      clearCanvas();
    };
  }, [isVisible, pageNum, pdf]);

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col items-center rounded-xl border bg-white p-2 transition-all ${isSelected ? 'border-indigo-400 bg-indigo-50/10 ring-2 ring-indigo-500/5' : 'border-slate-200 shadow-3xs hover:border-slate-300'}`}
    >
      <div className="relative flex min-h-[110px] w-full flex-col items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
        {!isVisible && (
          <span className="px-2 text-center text-[10px] font-semibold text-slate-400">Miniatura bajo demanda</span>
        )}
        {isVisible && renderError && (
          <span className="px-2 text-center text-[10px] font-semibold text-slate-400">Vista previa no disponible</span>
        )}
        {rendering && <Loader2 className="absolute z-[1] h-4 w-4 animate-spin text-slate-300" />}
        <canvas ref={canvasRef} className={`block h-auto w-full ${!isVisible || renderError ? 'hidden' : ''}`} aria-label={`Vista previa de la página ${pageNum}`} />

        <button
          type="button"
          onClick={() => onToggle(pageNum)}
          className="absolute right-1.5 top-1.5 z-10 cursor-pointer rounded-lg border border-slate-100 bg-white/95 p-1.5 shadow-3xs transition-all hover:bg-white active:scale-90"
          title={isSelected ? 'Quitar página' : 'Incluir página'}
          aria-label={isSelected ? `Quitar página ${pageNum}` : `Incluir página ${pageNum}`}
        >
          {isSelected ? <CheckSquare className="h-4 w-4 text-indigo-600" /> : <Square className="h-4 w-4 text-slate-300" />}
        </button>

        <button
          type="button"
          onClick={() => onPreview(pageNum)}
          className="absolute bottom-1.5 right-1.5 z-10 flex cursor-pointer items-center justify-center rounded-lg border border-slate-100 bg-white/95 p-1.5 shadow-3xs transition-all hover:bg-white active:scale-90"
          title="Ver página"
          aria-label={`Ver página ${pageNum}`}
        >
          <ZoomIn className="h-4 w-4 stroke-[2.5] text-indigo-600" />
        </button>
      </div>

      <span className={`mt-2 text-[10px] font-bold ${isSelected ? 'text-indigo-700' : 'text-slate-500'}`}>Pág. {pageNum}</span>
    </div>
  );
}

export default memo(PdfPageThumbnail);

