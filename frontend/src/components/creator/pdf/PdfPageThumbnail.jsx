import { useState, useEffect, useRef } from 'react';
import { Loader2, CheckSquare, Square, ZoomIn } from 'lucide-react';

export default function PdfPageThumbnail({ pdf, pageNum, isSelected, onToggle, onPreview }) {
  const canvasRef = useRef(null);
  const [rendering, setRendering] = useState(true);

  useEffect(() => {
    let renderTask = null;
    (async () => {
      try {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 0.22 });
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
        setRendering(false);
      } catch (err) {
        console.error(`Error miniatura pág. ${pageNum}:`, err);
      }
    })();

    return () => {
      if (renderTask) renderTask.cancel();
    };
  }, [pdf, pageNum]);

  return (
    <div
      className={`flex flex-col items-center p-2 border rounded-xl transition-all bg-white relative ${
        isSelected 
          ? 'border-indigo-400 bg-indigo-50/10 ring-2 ring-indigo-500/5' 
          : 'border-slate-200 hover:border-slate-300 shadow-3xs'
      }`}
    >
      {/* 1. BOTÓN DE SELECCIÓN (Esquina superior derecha) */}
      <button
        type="button"
        onClick={() => onToggle(pageNum)}
        className="absolute top-1.5 right-1.5 z-10 p-1.5 bg-white/95 hover:bg-white rounded-lg shadow-3xs border border-slate-100 cursor-pointer transition-all active:scale-90"
        title={isSelected ? "Quitar página" : "Incluir página"}
      >
        {isSelected ? (
          <CheckSquare className="w-4 h-4 text-indigo-600" />
        ) : (
          <Square className="w-4 h-4 text-slate-300" />
        )}
      </button>

      {/* Contenedor del canvas informativo */}
      <div className="w-full flex flex-col items-center justify-center min-h-[110px] bg-slate-50 rounded-lg overflow-hidden border border-slate-100 relative">
        {rendering && (
          <Loader2 className="w-4 h-4 animate-spin text-slate-300 absolute" />
        )}
        <canvas ref={canvasRef} className="w-full h-auto block" />

        {/* 🚀 2. BOTÓN DE LUPA CLONADO (Esquina inferior derecha - Alineación vertical perfecta) */}
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
        Pág. {pageNum}
      </span>
    </div>
  );
}
