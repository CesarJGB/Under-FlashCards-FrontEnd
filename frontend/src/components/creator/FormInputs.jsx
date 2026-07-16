import { lazy, Suspense, startTransition } from 'react';
import { ImagePlus, X, FileText, Layers } from 'lucide-react';

const PdfExtractor = lazy(() => import('./PdfExtractor'));
const MAX_AI_DOCUMENT_TEXT_LENGTH = 600000;
const configuredMaxAiCards = Number.parseInt(import.meta.env.VITE_MAX_AI_CARDS, 10);
const MAX_AI_CARDS = Number.isInteger(configuredMaxAiCards)
  ? Math.min(1000, Math.max(1, configuredMaxAiCards))
  : 100;

export default function FormInputs({
  isBulk, isAi, question, setQuestion, answer, setAnswer, bulkText, setBulkText,
  contentImage, imageSide, handleContentImageFile, removeContentImage,
  aiText, setAiText, aiNumCards, setAiNumCards
}) {
  
  // 1. MODO IA: Panel de procesamiento inteligente integrado con PdfExtractor
  if (isAi) {
    return (
      <div className="animate-[fadeIn_0.2s_ease] flex flex-col gap-4">
        
        {/* ✨ MÓDULO EXTRACTOR INDEPENDIENTE VISUAL CON RENDER DE PÁGINAS */}
        <Suspense
          fallback={
            <div className="border border-slate-200 rounded-xl bg-slate-50/70 p-4 flex items-center gap-3 text-xs font-semibold text-slate-500 animate-[fadeIn_0.15s_ease]">
              <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>Preparando el módulo PDF bajo demanda...</span>
            </div>
          }
        >
          <PdfExtractor
            onTextExtracted={(extractedText) => {
              startTransition(() => {
                setAiText((previousText) => (previousText ? `${previousText}\n${extractedText}` : extractedText));
              });
            }}
          />
        </Suspense>

        {/* EDITOR DE TEXTO PRINCIPAL DE LA IA */}
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            Apuntes, lecturas o indicaciones para la IA:
          </label>
          <textarea
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
            maxLength={MAX_AI_DOCUMENT_TEXT_LENGTH}
            placeholder={
              "Pega tu información aquí o usa el extractor de PDF de arriba para rellenar este campo de forma automática."
            }
            className="min-h-[160px] w-full text-xs rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 placeholder:text-slate-300 leading-relaxed font-medium"
          />
          <p className="mt-1 text-right text-[10px] font-medium text-slate-400">
            {aiText.length.toLocaleString('es-MX')} / {MAX_AI_DOCUMENT_TEXT_LENGTH.toLocaleString('es-MX')} caracteres
          </p>
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
              max={MAX_AI_CARDS}
              placeholder="Cantidad libre (ej. 8)"
              value={[5, 10, 15].includes(aiNumCards) ? '' : aiNumCards}
              onChange={(e) => {
                const rawVal = e.target.value;
                if (rawVal === '') {
                  setAiNumCards(''); 
                } else {
                  const parsed = parseInt(rawVal, 10);
                  setAiNumCards(isNaN(parsed) ? '' : Math.min(MAX_AI_CARDS, Math.max(1, parsed)));
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
