import { useState } from 'react';
import { FileUp, FileText, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Subcomponentes modulares atómicos
import PdfPageThumbnail from './pdf/PdfPageThumbnail';
// 🚀 CAMBIO: Importamos el nuevo carrusel interactivo con soporte de swipes
import PdfCarousel from './pdf/PdfCarousel';

// Importación del worker de empaquetado nativo de Vite
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export default function PdfExtractor({ onTextExtracted }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [fileName, setFileName] = useState('');
  const [totalPages, setTotalPages] = useState(0);
  const [selectedPages, setSelectedPages] = useState([]);
  const [scope, setScope] = useState('all');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  // Control del mazo/índice del carrusel flotante
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

      {/* 🚀 RENDERIZADO DEL CARRUSEL DE ENTORNO COMPLETO CON CONEXIÓN EN TIEMPO REAL */}
      {previewPageNum !== null && (
        <PdfCarousel
          pdf={pdfDoc}
          initialPage={previewPageNum}
          totalPages={totalPages}
          selectedPages={selectedPages}
          onToggle={togglePage}
          onClose={() => setPreviewPageNum(null)}
        />
      )}
    </div>
  );
}
