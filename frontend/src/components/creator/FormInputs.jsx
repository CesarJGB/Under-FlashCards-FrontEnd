import { useState, useEffect } from 'react';
import { ImagePlus, X, FileText, Layers, FileUp, CheckSquare, Square, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
// Importamos pdfjs de forma compatible con Vite
import * as pdfjsLib from 'pdfjs-dist';

// Configuramos el worker global de PDF.js usando un CDN confiable
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export default function FormInputs({
  isBulk, isAi, question, setQuestion, answer, setAnswer, bulkText, setBulkText,
  contentImage, imageSide, handleContentImageFile, removeContentImage,
  aiText, setAiText, aiNumCards, setAiNumCards
}) {
  
  // 📄 ESTADOS PARA EL PROCESAMIENTO DE PDF
  const [showPdfPanel, setShowPdfPanel] = useState(false);
  const [pdfFile, setPdfFile] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedPages, setSelectedPages] = useState([]);
  const [extractionScope, setExtractionScope] = useState('all'); // 'all' | 'custom'
  const [parsingPdf, setParsingPdf] = useState(false);

  // Limpiar estados si se apaga el modo IA
  useEffect(() => {
    if (!isAi) {
      setPdfFile(null);
      setTotalPages(0);
      setSelectedPages([]);
      setShowPdfPanel(false);
    }
  }, [isAi]);

  // Manejador de carga de archivo PDF
  const handlePdfChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') return;
    
    setParsingPdf(true);
    setPdfFile(file);
    
    try {
      const fileReader = new FileReader();
      fileReader.onload = async function () {
        const typedarray = new Uint8Array(this.result);
        const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
        setTotalPages(pdf.numPages);
        // Por defecto, seleccionamos todas las páginas
        const allPages = Array.from({ length: pdf.numPages }, (_, i) => i + 1);
        setSelectedPages(allPages);
      };
      fileReader.readAsArrayBuffer(file);
    } catch (err) {
      console.error("Error al precargar estructura del PDF:", err);
    } finally {
      setParsingPdf(false);
    }
  };

  // Función quirúrgica para extraer el texto plano de las páginas elegidas
  const extractTextFromPdf = async () => {
    if (!pdfFile) return;
    setParsingPdf(true);
    
    try {
      const fileReader = new FileReader();
      fileReader.onload = async function () {
        const typedarray = new Uint8Array(this.result);
        const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
        let completeText = "";
        
        // Determinar qué páginas leer según la elección del usuario
        const pagesToRead = extractionScope === 'all' 
          ? Array.from({ length: totalPages }, (_, i) => i + 1)
          : [...selectedPages].sort((a, b) => a - b);

        for (const pageNum of pagesToRead) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageStrings = textContent.items.map(item => item.str);
          completeText += `\n--- [Texto de la Página ${pageNum}] ---\n` + pageStrings.join(" ");
        }
        
        setAiText(prev => (prev ? prev + "\n" : "") + completeText.trim());
        // Cerramos el panel de forma limpia tras inyectar el texto
        setPdfFile(null);
        setTotalPages(0);
        setShowPdfPanel(false);
      };
      fileReader.readAsArrayBuffer(pdfFile);
    } catch (err) {
      console.error("Error al extraer texto del PDF:", err);
    } finally {
      setParsingPdf(false);
    }
  };

  const togglePageSelection = (page) => {
    setSelectedPages(prev => 
      prev.includes(page) ? prev.filter(p => p !== page) : [...prev, page]
    );
  };

  const handleSelectAllPages = () => {
    setSelectedPages(Array.from({ length: totalPages }, (_, i) => i + 1));
  };

  const handleDeselectAllPages = () => {
    setSelectedPages([]);
  };

  // 1. MODO IA: Panel de procesamiento inteligente
  if (isAi) {
    return (
      <div className="animate-[fadeIn_0.2s_ease] flex flex-col gap-4">
        
        {/* ACORDEÓN DESPLEGABLE DE PRECARGA DE PDF */}
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-3xs">
          <button
            type="button"
            onClick={() => setShowPdfPanel(!showPdfPanel)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100/70 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <FileUp className="w-4 h-4 text-indigo-500 animate-bounce" />
              <span className="text-xs font-bold text-slate-700">¿Quieres importar apuntes desde un PDF?</span>
            </div>
            {showPdfPanel ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {showPdfPanel && (
            <div className="p-4 border-t border-slate-200/60 bg-white flex flex-col gap-3 animate-[slideUp_0.15s_ease]">
              {!pdfFile ? (
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl py-6 px-4 bg-slate-50/50 hover:bg-slate-50 transition-all cursor-pointer group text-center">
                  <FileText className="w-8 h-8 text-slate-300 group-hover:text-indigo-400 transition-colors mb-2" />
                  <span className="text-xs font-bold text-slate-600">Haz clic para cargar documento</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Soporta archivos PDF estándar</span>
                  <input type="file" accept="application/pdf" onChange={handlePdfChange} className="hidden" />
                </label>
              ) : (
                <div className="flex flex-col gap-3">
                  {/* Info básica del archivo */}
                  <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                    <div className="flex items-center gap-2 truncate max-w-[80%]">
                      <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                      <span className="text-xs font-semibold text-slate-700 truncate">{pdfFile.name}</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => { setPdfFile(null); setTotalPages(0); }}
                      className="text-slate-400 hover:text-red-500 text-xs font-bold p-1 transition-colors cursor-pointer"
                    >
                      Cambiar
                    </button>
                  </div>

                  {/* Selector de Alcance */}
                  <div className="flex bg-slate-100 p-1 border border-slate-200/60 rounded-xl items-center w-full grid grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setExtractionScope('all')}
                      className={`text-center py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        extractionScope === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                      }`}
                    >
                      Todo el documento ({totalPages} pág.)
                    </button>
                    <button
                      type="button"
                      onClick={() => setExtractionScope('custom')}
                      className={`text-center py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        extractionScope === 'custom' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                      }`}
                    >
                      Elegir páginas
                    </button>
                  </div>

                  {/* SISTEMA DE PRECARGA TIPO GRID DINÁMICO */}
                  {extractionScope === 'custom' && (
                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 flex flex-col gap-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 border-b border-slate-200 pb-1.5">
                        <span>Páginas seleccionadas: {selectedPages.length}</span>
                        <div className="flex gap-3">
                          <button type="button" onClick={handleSelectAllPages} className="hover:text-slate-800 cursor-pointer">Todas</button>
                          <button type="button" onClick={handleDeselectAllPages} className="hover:text-slate-800 cursor-pointer">Ninguna</button>
                        </div>
                      </div>

                      {/* Cuadrícula geométrica de control de páginas */}
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-white border border-slate-200 rounded-xl">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                          const isChecked = selectedPages.includes(page);
                          return (
                            <button
                              key={page}
                              type="button"
                              onClick={() => togglePageSelection(page)}
                              className={`flex items-center justify-between px-2 py-1.5 border rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                isChecked 
                                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-3xs' 
                                  : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-800'
                              }`}
                            >
                              <span>p. {page}</span>
                              {isChecked ? <CheckSquare className="w-3 h-3 shrink-0 text-indigo-600" /> : <Square className="w-3 h-3 shrink-0 text-slate-300" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Botón desencadenador de extracción */}
                  <button
                    type="button"
                    disabled={parsingPdf || (extractionScope === 'custom' && selectedPages.length === 0)}
                    onClick={extractTextFromPdf}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer h-9"
                  >
                    {parsingPdf ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Extrayendo lectura...
                      </>
                    ) : (
                      <>
                        Volcar texto seleccionado al editor
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* EDITOR DE TEXTO PRINCIPAL DE LA IA */}
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            Apuntes, lecturas o indicaciones para la IA:
          </label>
          <textarea
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
            placeholder={
              "Pega tu información aquí o usa el extractor de PDF de arriba para rellenar este campo de forma automática."
            }
            className="min-h-[160px] w-full text-xs rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 placeholder:text-slate-300 leading-relaxed font-medium"
          />
        </div>

        {/* Selector de cantidad estimada / Sistema Híbrido Dinámico */}
        <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-slate-700">Densidad del mazo</p>
              <p className="text-[10px] text-slate-400 font-medium leading-none mt-0.5">¿Cuántas tarjetas deseas extraer aproximadamente?</p>
            </div>
          </div>
          
          <div className="grid grid-cols-3 sm:flex bg-white p-1 rounded-xl border border-slate-200 items-center gap-1 shrink-0 w-full sm:w-auto">
            {[5, 10, 15].map((num) => {
              const isSelected = aiNumCards === num;
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => setAiNumCards(num)}
                  className={`px-2 sm:px-3 py-2 sm:py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer text-center ${
                    isSelected 
                      ? 'bg-slate-900 text-white shadow-3xs' 
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {num} tarjetas
                </button>
              );
            })}
            
            <div className="hidden sm:block h-4 w-[1px] bg-slate-200 mx-1" />

            <input
              type="number"
              min="1"
              max="50"
              placeholder="Cantidad libre (ej. 8)"
              value={[5, 10, 15].includes(aiNumCards) ? '' : aiNumCards}
              onChange={(e) => {
                const rawVal = e.target.value;
                if (rawVal === '') {
                  setAiNumCards(''); 
                } else {
                  const parsed = parseInt(rawVal, 10);
                  setAiNumCards(isNaN(parsed) ? '' : Math.min(50, Math.max(1, parsed)));
                }
              }}
              className={`col-span-3 w-full sm:w-36 text-center text-[11px] font-bold rounded-lg py-2 sm:py-1.5 border transition-all outline-none ${
                ![5, 10, 15].includes(aiNumCards) && aiNumCards !== ''
                  ? 'bg-slate-900 text-white border-slate-900 shadow-3xs placeholder:text-slate-400' 
                  : 'bg-slate-50 text-slate-600 border-slate-200 placeholder:text-slate-400 focus:bg-white focus:border-slate-300'
              }`}
            />
          </div>
        </div>
      </div>
    );
  }

  // 2. MODO EN LOTE
  if (isBulk) {
    return (
      <div className="animate-[fadeIn_0.2s_ease]">
        <label className="block text-xs font-medium text-slate-500 mb-1.5">Pega tu texto estructurado abajo:</label>
        <textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          placeholder={"P: ¿Qué día fue teóricamente ayer?\nR: 20 de junio\n\nP: ¿Cuál es el número atómico del Hidrógeno?\nR: 1"}
          className="min-h-[160px] w-full font-mono text-xs rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 placeholder:text-slate-300"
        />
      </div>
    );
  }

  // 3. MODO INDIVIDUAL
  return (
    <div className="grid sm:grid-cols-2 gap-4 animate-[fadeIn_0.2s_ease]">
      <div className="flex flex-col">
        <label className="block text-xs font-medium text-slate-500 mb-1">Pregunta</label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="¿Cuál es la capital de Francia?"
          className="min-h-[90px] w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
        />
        <div className="mt-2 flex items-center min-h-[36px]">
          {contentImage && imageSide === 'question' ? (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-xl p-1 pr-2.5 max-w-full animate-[slideUp_0.1s_ease]">
              <img src={contentImage} alt="Miniatura P" className="w-8 h-8 rounded-lg object-cover bg-slate-200 border border-slate-200" />
              <span className="text-[11px] font-semibold text-slate-600 truncate max-w-[120px]">Imagen de pregunta</span>
              <button type="button" onClick={removeContentImage} className="text-slate-400 hover:text-red-500 transition-colors p-0.5"><X className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            (!contentImage || imageSide !== 'answer') && (
              <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-lg border border-slate-200 hover:border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 transition-colors shadow-2xs">
                <ImagePlus className="w-3.5 h-3.5 text-slate-400" /> <span className="text-[11px] font-medium">Añadir imagen</span>
                <input type="file" accept="image/*" onChange={(e) => handleContentImageFile(e, 'question')} className="hidden" />
              </label>
            )
          )}
        </div>
      </div>

      <div className="flex flex-col">
        <label className="block text-xs font-medium text-slate-500 mb-1">Respuesta</label>
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="París"
          className="min-h-[90px] w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
        />
        <div className="mt-2 flex items-center min-h-[36px]">
          {contentImage && imageSide === 'answer' ? (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-xl p-1 pr-2.5 max-w-full animate-[slideUp_0.1s_ease]">
              <img src={contentImage} alt="Miniatura R" className="w-8 h-8 rounded-lg object-cover bg-slate-200 border border-slate-200" />
              <span className="text-[11px] font-semibold text-slate-600 truncate max-w-[120px]">Imagen de respuesta</span>
              <button type="button" onClick={removeContentImage} className="text-slate-400 hover:text-red-500 transition-colors p-0.5"><X className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            (!contentImage || imageSide !== 'question') && (
              <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-lg border border-slate-200 hover:border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 transition-colors shadow-2xs">
                <ImagePlus className="w-3.5 h-3.5 text-slate-400" /> <span className="text-[11px] font-medium">Añadir imagen</span>
                <input type="file" accept="image/*" onChange={(e) => handleContentImageFile(e, 'answer')} className="hidden" />
              </label>
            )
          )}
        </div>
      </div>
    </div>
  );
}
