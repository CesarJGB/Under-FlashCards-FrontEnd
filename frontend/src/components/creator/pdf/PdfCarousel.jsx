import { useEffect, useRef, useState } from 'react';
import { CheckSquare, ChevronLeft, ChevronRight, Loader2, Square, X } from 'lucide-react';

export default function PdfCarousel({ pdf, initialPage, totalPages, selectedPages, onToggle, onClose }) {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef(null);
  const touchStart = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let renderTask = null;

    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    setLoading(true);

    const clearCanvas = () => {
      canvas.width = 0;
      canvas.height = 0;
    };

    (async () => {
      try {
        const page = await pdf.getPage(currentPage);

        try {
          const viewport = page.getViewport({ scale: 1.4 });
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
          setLoading(false);
        }
      } catch (error) {
        if (cancelled || error?.name === 'RenderingCancelledException') return;
        console.error('[PdfCarousel] Error rendering page:', error);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
      clearCanvas();
    };
  }, [currentPage, pdf]);

  const goPrev = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const goNext = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  const handleTouchStart = (event) => {
    touchStart.current = event.touches[0].clientX;
  };

  const handleTouchEnd = (event) => {
    const touchEnd = event.changedTouches[0].clientX;
    const diff = touchStart.current - touchEnd;

    if (diff > 50) goNext();
    if (diff < -50) goPrev();
  };

  const isSelected = selectedPages.includes(currentPage);

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-50 p-0 sm:p-4 animate-[fadeIn_0.15s_ease]">
      <div
        className="bg-white w-full h-full sm:h-auto sm:max-w-xl sm:max-h-[90vh] sm:rounded-2xl flex flex-col overflow-hidden shadow-2xl relative"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 py-4 bg-gradient-to-b from-black/50 to-transparent">
          <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-full backdrop-blur-md cursor-pointer">
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onToggle(currentPage)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                isSelected
                  ? 'bg-indigo-600 border-indigo-400 text-white'
                  : 'bg-white/20 border-white/30 text-white'
              }`}
            >
              {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              {isSelected ? 'Seleccionada' : 'Seleccionar'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-slate-100 flex items-start justify-center p-2 pt-20 pb-20 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-slate-100/50">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
          )}
          <canvas ref={canvasRef} className="max-w-full h-auto shadow-xl rounded-lg bg-white" />
        </div>

        <div className="absolute bottom-0 inset-x-0 z-20 bg-gradient-to-t from-black/50 to-transparent px-6 py-6 flex items-center justify-between">
          <button
            disabled={currentPage === 1}
            onClick={goPrev}
            className="p-3 bg-white/20 disabled:opacity-20 text-white rounded-full backdrop-blur-md cursor-pointer transition-all active:scale-90"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <div className="bg-white/90 px-4 py-1.5 rounded-full text-xs font-black text-slate-900 shadow-sm">
            {currentPage} / {totalPages}
          </div>

          <button
            disabled={currentPage === totalPages}
            onClick={goNext}
            className="p-3 bg-white/20 disabled:opacity-20 text-white rounded-full backdrop-blur-md cursor-pointer transition-all active:scale-90"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
