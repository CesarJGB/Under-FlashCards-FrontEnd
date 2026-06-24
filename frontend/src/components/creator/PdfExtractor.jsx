import { useState, useEffect, useRef } from 'react';
import { FileUp, FileText, ChevronDown, ChevronUp, CheckSquare, Square, Loader2, X, ZoomIn } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Importamos el Worker localmente usando la directiva nativa de Vite (?url)
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// 🔎 COMPONENTE 1: MODAL INTERACTIVO DE PANTALLA COMPLETA (SISTEMA DE LUPA ALTA RESOLUCIÓN)
function LargePagePreview({ pdf, pageNum, onClose }) {
  const canvasRef = useRef(null);
  const backdropRef = useRef(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let renderTask = null;
    (async () => {
      try {
        const page = await pdf.getPage(pageNum);
        // Escala 1.35 para asegurar nitidez absoluta en letras pequeñas sobre móviles
        const viewport = page.getViewport({ scale: 1.35 });
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

  // Detector para cerrar el modal si el usuario hace clic en el fondo oscuro
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
        
        {/* Cabecera del visualizador */}
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

        {/* Contenedor con scroll adaptativo para leer fluidamente de arriba a abajo */}
        <div className="flex-1 overflow-auto p-3 bg-slate-100/60 flex items-start justify-center relative min-h-[350px]">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100/90 z-10 gap-2 text-xs font-bold text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
              <span>Optimizando resolución óptica...</span>
            </div>
          )}
          <canvas ref={canvasRef} className="max-w-full h-auto bg-white rounded-xl shadow-md border border-slate-200" />
        </div>
      </div>
    </div>
  );
}

// 🎴 COMPONENTE 2: MINIATURA INDIVIDUAL DE CONTROL MIXTO
function PdfPageThumbnail({ pdf, pageNum, isSelected, onToggle, onPreview }) {
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
      {/* Selector Checkbox (Hitbox independiente en la esquina superior) */}
      <button
        type="button"
        onClick={() => onToggle(pageNum)}
        className="absolute top-1 right-1 z-10 p-1.5 bg-white/95 hover:bg-white rounded-lg shadow-3xs border border-slate-100 cursor-pointer transition-transform active:scale-90"
        title={isSelected ? "Quitar página" : "Incluir página"}
      >
        {isSelected ? (
          <CheckSquare className="w-4 h-4 text-indigo-600" />
        ) : (
          <Square className="w-4 h-4 text-slate-300" />
        )}
      </button>

      {/* Disparador de Lupa (Al tocar el cuerpo central abre la pantalla completa) */}
      <button
        type="button"
        onClick={() => onPreview(pageNum)}
        className="w-full flex flex-col items-center justify-center min-h-[110px] bg-slate-50 rounded-lg overflow-hidden border border-slate-100 relative group cursor-pointer"
      >
        {rendering && (
          <Loader2 className="w-4 h-4 animate-spin text-slate-300 absolute" />
        )}
        <canvas ref={canvasRef} className="w-full h-auto block group-hover:opacity-85 transition-opacity" />
        
        {/* Capa sutil interactiva "Tap para Zoom" */}
        <div className="absolute inset-0 bg-slate-900/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="bg-white/95 px-2 py-1 rounded-lg shadow-2xs flex items-center gap-1 text-[9px] font-black text-slate-700 uppercase tracking-wider">
            <ZoomIn className="w-3 h-3 text-indigo-600" />
            <span>Ampliar</span>
          </div>
        </div>
      </button>

      <span className={`text-[10px] font-bold mt-2 ${isSelected ? 'text-indigo-700' : 'text-slate-500'}`}>
        Pág. {pageNum}
      </span>
    </div>
  );
}

// 🏗️ COMPONENTE PRINCIPAL CORE
export default function PdfExtractor({ onTextExtracted }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [fileName, setFileName] = useState('');
  const [totalPages, setTotalPages] = useState(0);
  const [selectedPages, setSelectedPages] = useState([]);
  const [scope, setScope] = useState('all');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  // Puntero para la página que se está previsualizando en grande (null = cerrado)
  const [previewPageNum, setPreviewPageNum] = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') return;

    setLoading(true);
    setLocalError('');
    setFileName(file.name);
    
    try {
      const fileReader = new FileReader();
      fileReader.onerror = () => {
        setLocalError('Error físico al leer el archivo desde el disco.');
        setLoading(false);
      };
      
      fileReader.onload = async function () {
        try {
          const typedarray = new Uint8Array(this.result);
          const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
          setPdfDoc(pdf);
          setTotalPages(pdf.numPages);
          setSelectedPages(Array.from({ length: pdf.numPages }, (_, i) => i + 1));
        } catch (pdfErr) {
          console.error(pdfErr);
          setLocalError('No se pudo procesar la estructura del PDF. Asegúrate de que no esté protegido.');
          setPdfDoc(null);
        } finally {
          setLoading(false);
        }
      };
      fileReader.readAsArrayBuffer(file);
    } catch (err) {
      console.error(err);
      setLocalError('Ocurrió un fallo inesperado al precargar el documento.');
      setLoading(false);
    }
  };

  const handleProcessText = async () => {
    if (!pdfDoc) return;
    setLoading(true);
    setLocalError('');

    try {
      let completeText = "";
      const pagesToRead = scope === 'all' 
        ? Array.from({ length: totalPages }, (_, i) => i + 1)
        : [...selectedPages].sort((a, b) => a - b);

      for (const pageNum of pagesToRead) {
        try {
          const page = await pdfDoc.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageStrings = textContent.items.map(item => item.str);
          completeText += `\n--- [Texto de la Página ${pageNum}] ---\n` + pageStrings.join(" ");
        } catch (pageErr) {
          console.warn(`Error en página ${pageNum}, saltando...`);
        }
      }

      if (!completeText.trim()) {
        throw new Error('El PDF parece estar compuesto únicamente por imágenes escaneadas. No se detectaron capas de texto legibles.');
      }

      onTextExtracted(completeText.trim());
      
      setPdfDoc(null);
      setTotalPages(0);
      setFileName('');
      setIsOpen(false);
    } catch (err) {
      setLocalError(err.message || 'Error durante el volcado de texto.');
    } finally {
      setLoading(false);
    }
  };

  const togglePage = (page) => {
    setSelectedPages(prev => 
      prev.includes(page) ? prev.filter(p => p !== page) : [...prev, page]
    );
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-3xs">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100/70 transition-colors cursor-pointer text-left"
      >
        <div className="flex items-center gap-2">
          <FileUp className="w-4 h-4 text-indigo-500 shrink-0" />
          <span className="text-xs font-bold text-slate-700">¿Quieres importar apuntes desde un PDF?</span>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {isOpen && (
        <div className="p-4 border-t border-slate-200/60 bg-white flex flex-col gap-3 animate-[slideUp_0.15s_ease]">
          {!pdfDoc ? (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl py-7 px-4 bg-slate-50/50 hover:bg-slate-50 transition-all cursor-pointer group text-center">
              {loading ? (
                <Loader2 className="w-7 h-7 text-indigo-500 animate-spin mb-2" />
              ) : (
                <FileText className="w-7 h-7 text-slate-300 group-hover:text-indigo-400 transition-colors mb-2" />
              )}
              <span className="text-xs font-bold text-slate-600">Haz clic para cargar tu documento</span>
              <span className="text-[10px] text-slate-400 mt-0.5">Mesa de lectura visual interactiva</span>
              <input type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" disabled={loading} />
            </label>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                <div className="flex items-center gap-2 truncate max-w-[75%]">
                  <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span className="text-xs font-semibold text-slate-700 truncate">{fileName}</span>
                </div>
                <button 
                  type="button" 
                  onClick={() => { setPdfDoc(null); setTotalPages(0); setFileName(''); setLocalError(''); }}
                  className="text-slate-400 hover:text-red-500 text-xs font-bold p-1 transition-colors cursor-pointer"
                >
                  Cambiar
                </button>
              </div>

              <div className="flex bg-slate-100 p-1 border border-slate-200/60 rounded-xl items-center w-full grid grid-cols-2">
                <button
                  type="button"
                  onClick={() => setScope('all')}
                  className={`text-center py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    scope === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  Todo el documento ({totalPages} pág.)
                </button>
                <button
                  type="button"
                  onClick={() => setScope('custom')}
                  className={`text-center py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    scope === 'custom' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  Elegir páginas
                </button>
              </div>

              {scope === 'custom' && (
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 border-b border-slate-200 pb-2">
                    <span>Seleccionadas: {selectedPages.length} de {totalPages}</span>
                    <div className="flex gap-3">
                      <button type="button" onClick={() => setSelectedPages(Array.from({ length: totalPages }, (_, i) => i + 1))} className="hover:text-slate-800 cursor-pointer">Todas</button>
                      <button type="button" onClick={() => setSelectedPages([])} className="hover:text-slate-800 cursor-pointer">Ninguna</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-1.5 bg-white border border-slate-200 rounded-xl">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <PdfPageThumbnail
                        key={page}
                        pdf={pdfDoc}
                        pageNum={page}
                        isSelected={selectedPages.includes(page)}
                        onToggle={togglePage}
                        // Disparador para abrir la lupa ampliada
                        onPreview={(num) => setPreviewPageNum(num)}
                      />
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                disabled={loading || (scope === 'custom' && selectedPages.length === 0)}
                onClick={handleProcessText}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-45 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer h-9 mt-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Procesando...
                  </>
                ) : (
                  <>
                    Volcar texto visual seleccionado al editor
                  </>
                )}
              </button>
            </div>
          )}
          
          {localError && (
            <p className="text-[11px] font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 animate-[fadeIn_0.12s_ease]">
              {localError}
            </p>
          )}
        </div>
      )}

      {/* 🚀 RENDERIZADO CONDICIONAL DEL MODAL DE DETALLE COMPLETO (LUPA) */}
      {previewPageNum !== null && (
        <LargePagePreview
          pdf={pdfDoc}
          pageNum={previewPageNum}
          onClose={() => setPreviewPageNum(null)}
        />
      )}
    </div>
  );
}
