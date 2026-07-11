import { memo, useEffect, useRef, useState } from 'react';
import { CheckSquare, Loader2, Square, ZoomIn } from 'lucide-react';

function PdfPageThumbnail({ pdf, pageNum, isSelected, onToggle, onPreview, scrollRootRef }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    const target = containerRef.current;
    if (!target) return undefined;

    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting || entry.intersectionRatio > 0);
      },
      {
        root: scrollRootRef.current,
        rootMargin: '120px 0px',
        threshold: 0.01,
      }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [scrollRootRef]);

  useEffect(() => {
    let cancelled = false;
    let renderTask = null;

    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const clearCanvas = () => {
      canvas.width = 0;
      canvas.height = 0;
    };

    if (!isVisible) {
      setRendering(false);
      clearCanvas();
      return undefined;
    }

    setRendering(true);

    (async () => {
      try {
        const page = await pdf.getPage(pageNum);

        try {
          const viewport = page.getViewport({ scale: 0.22 });
          if (cancelled || !canvasRef.current) return;

          canvas.height = viewport.height;
          canvas.width = viewport.width;

          const context = canvas.getContext('2d');
          if (!context) return;

          renderTask = page.render({
            canvasContext: context,
            viewport,
          });

          await renderTask.promise;
        } finally {
          page.cleanup();
        }

        if (!cancelled) {
          setRendering(false);
        }
      } catch (error) {
        if (cancelled || error?.name === 'RenderingCancelledException') return;
        console.error(`[PdfPageThumbnail] Error rendering page ${pageNum}:`, error);
        setRendering(false);
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
      className={`flex flex-col items-center p-2 border rounded-xl transition-all bg-white relative ${
        isSelected
          ? 'border-indigo-400 bg-indigo-50/10 ring-2 ring-indigo-500/5'
          : 'border-slate-200 hover:border-slate-300 shadow-3xs'
      }`}
    >
      <div className="w-full flex flex-col items-center justify-center min-h-[110px] bg-slate-50 rounded-lg overflow-hidden border border-slate-100 relative">
        {!isVisible && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-[10px] font-semibold text-slate-400 gap-1 px-2 text-center">
            <span>Miniatura bajo demanda</span>
            <span>Se renderiza al entrar en pantalla</span>
          </div>
        )}

        {rendering && (
          <Loader2 className="w-4 h-4 animate-spin text-slate-300 absolute z-[1]" />
        )}

        <canvas ref={canvasRef} className={`w-full h-auto block ${!isVisible ? 'hidden' : ''}`} />

        <button
          type="button"
          onClick={() => onToggle(pageNum)}
          className="absolute top-1.5 right-1.5 z-10 p-1.5 bg-white/95 hover:bg-white rounded-lg shadow-3xs border border-slate-100 cursor-pointer transition-all active:scale-90"
          title={isSelected ? 'Quitar pagina' : 'Incluir pagina'}
        >
          {isSelected ? (
            <CheckSquare className="w-4 h-4 text-indigo-600" />
          ) : (
            <Square className="w-4 h-4 text-slate-300" />
          )}
        </button>

        <button
          type="button"
          onClick={() => onPreview(pageNum)}
          className="absolute bottom-1.5 right-1.5 z-10 p-1.5 bg-white/95 hover:bg-white rounded-lg shadow-3xs border border-slate-100 cursor-pointer transition-all active:scale-90 flex items-center justify-center"
          title="Ver en pantalla completa"
        >
          <ZoomIn className="w-4 h-4 text-indigo-600 stroke-[2.5]" />
        </button>
      </div>

      <span className={`text-[10px] font-bold mt-2 ${isSelected ? 'text-indigo-700' : 'text-slate-500'}`}>
        Pag. {pageNum}
      </span>
    </div>
  );
}

export default memo(PdfPageThumbnail);
