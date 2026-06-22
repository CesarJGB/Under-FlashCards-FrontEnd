// ARCHIVO: frontend/src/components/creator/FormInputs.jsx
import { ImagePlus, X } from 'lucide-react';

export default function FormInputs({
  isBulk, question, setQuestion, answer, setAnswer, bulkText, setBulkText,
  contentImage, imageSide, handleContentImageFile, removeContentImage
}) {
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
