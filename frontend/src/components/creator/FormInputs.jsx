import { ImagePlus, X, FileText, Layers } from 'lucide-react';

export default function FormInputs({
  isBulk, isAi, question, setQuestion, answer, setAnswer, bulkText, setBulkText,
  contentImage, imageSide, handleContentImageFile, removeContentImage,
  aiText, setAiText, aiNumCards, setAiNumCards
}) {
  
  // 1. MODO IA: Panel de procesamiento inteligente
  if (isAi) {
    return (
      <div className="animate-[fadeIn_0.2s_ease] flex flex-col gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            Apuntes, lecturas o indicaciones para la IA:
          </label>
          <textarea
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
            placeholder={
              "Pega aquí el texto de tus diapositivas, capítulos de libros o simplemente escribe una orden:\n\nEjemplo: 'Genera tarjetas de estudio sobre la nomenclatura de los ácidos carboxílicos enfocándote en las reglas de la IUPAC.'"
            }
            className="min-h-[160px] w-full text-xs rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 placeholder:text-slate-300 leading-relaxed"
          />
        </div>

        {/* Selector de cantidad estimada / Sistema Híbrido Estricto (Solución a image_5.png) */}
        <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-slate-700">Densidad del mazo</p>
              <p className="text-[10px] text-slate-400 font-medium leading-none mt-0.5">¿Cuántas tarjetas deseas extraer aproximadamente?</p>
            </div>
          </div>
          
          {/* 🚀 CAMBIO GEOMÉTRICO: grid-cols-3 en móvil para los botones, forzando al input a expandirse simétricamente abajo */}
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
            
            {/* Divisor de entorno: oculto en cuadrícula móvil, visible en flujo de escritorio */}
            <div className="hidden sm:block h-4 w-[1px] bg-slate-200 mx-1" />

            {/* 🚀 INPUT EXPANDIDO: col-span-3 y w-full obligan al campo a abarcar todo el ancho inferior de forma pareja */}
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
      {/* Columna de Pregunta */}
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

      {/* Columna de Respuesta */}
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
