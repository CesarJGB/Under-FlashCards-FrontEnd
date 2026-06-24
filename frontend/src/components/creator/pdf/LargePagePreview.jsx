import { useState, useEffect, useRef } from 'react';
import { Loader2, X, ZoomIn } from 'lucide-react';

export default function LargePagePreview({ pdf, pageNum, onClose }) {
  const canvasRef = useRef(null);
  const backdropRef = useRef(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let renderTask = null;
    (async () => {
      try {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.4 }); // Nitidez cristalina
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };
        renderTask = page.render(renderContext);
        await renderTask.promise;
        setLoading(false);
      } catch (err) {
        console.error("Error al renderizar página en alta resolución:", err);
      }
    })();

    return () => {
      if (renderTask) renderTask.cancel();
    };
  }, [pdf, pageNum]);

  const handleBackdropClick = (e) => {
    if (e.target === backdropRef.current) onClose();
  };

  return (
    <div 
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-[fadeIn_0.12s_ease]"
    >
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-[scaleUp_0.15s_ease]">
        
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0 bg-slate-50">
          <div className="flex items-center gap-2">
            <ZoomIn className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-slate-700">Modo Lectura: Página {pageNum}</span>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-all active:scale-95 cursor-pointer"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-3 bg-slate-100/60 flex items-start justify-center relative min-h-[350px]">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100/90 z-10 gap-2 text-xs font-bold text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
              <span>Optimizando resolución...</span>
            </div>
          )}
          <canvas ref={canvasRef} className="max-w-full h-auto bg-white rounded-xl shadow-md border border-slate-200" />
        </div>
      </div>
    </div>
  );
}
