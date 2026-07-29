import { lazy, Suspense, startTransition, useState } from 'react';
import { FileText, ImagePlus, Layers, X } from 'lucide-react';

const PdfExtractor = lazy(() => import('./PdfExtractor'));
const MAX_AI_DOCUMENT_TEXT_LENGTH = 600000;
const configuredMaxAiCards = Number.parseInt(import.meta.env.VITE_MAX_AI_CARDS, 10);
const MAX_AI_CARDS = Number.isInteger(configuredMaxAiCards) && configuredMaxAiCards > 0
  ? configuredMaxAiCards
  : 500;

export default function FormInputs({
  isBulk, isAi, question, setQuestion, answer, setAnswer, bulkText, setBulkText,
  contentImage, imageSide, handleContentImageFile, removeContentImage,
  aiText, setAiText, aiNumCards, setAiNumCards
}) {
  const [customCardCount, setCustomCardCount] = useState('');

  // 1. MODO IA: Panel de procesamiento inteligente integrado con PdfExtractor
  if (isAi) {
    return (
      <div className="animate-[fadeIn_0.2s_ease] flex flex-col gap-4">
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
              const isSelected = customCardCount === '' && aiNumCards === num;
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => {
                    setCustomCardCount('');
                    setAiNumCards(num);
                  }}
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
              value={customCardCount}
              onChange={(e) => {
                const rawVal = e.target.value;
                if (rawVal === '') {
                  setCustomCardCount('');
                  setAiNumCards('');
                } else {
                  const parsed = parseInt(rawVal, 10);
                  const nextValue = isNaN(parsed) ? '' : Math.min(MAX_AI_CARDS, Math.max(1, parsed));
                  setCustomCardCount(nextValue === '' ? '' : String(nextValue));
                  setAiNumCards(nextValue);
                }
              }}
              className={`col-span-3 w-full sm:w-36 text-center text-[11px] font-bold rounded-lg py-2 sm:py-1.5 border transition-all outline-none ${
                customCardCount !== ''
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

  const renderImageControl = (side) => {
    const isAttachedHere = Boolean(contentImage && imageSide === side);

    if (isAttachedHere) {
      return (
        <div className="absolute inset-x-2 bottom-1.5 flex items-center justify-between gap-2">
          <label
            className="flex h-9 min-w-0 max-w-[calc(100%-3rem)] cursor-pointer items-center rounded-lg border border-slate-200 bg-slate-50/95 p-0.5 shadow-[0_2px_5px_-4px_rgba(15,23,42,0.45)] transition-colors hover:border-slate-300 hover:bg-white focus-within:ring-2 focus-within:ring-slate-300"
            title={`Cambiar imagen de ${side === 'question' ? 'pregunta' : 'respuesta'}`}
          >
            <img
              src={contentImage}
              alt={`Imagen de ${side === 'question' ? 'pregunta' : 'respuesta'}`}
              className="h-8 w-8 shrink-0 rounded-md border border-slate-200 object-cover bg-slate-200"
            />
            <span className="sr-only">Cambiar imagen de {side === 'question' ? 'pregunta' : 'respuesta'}</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleContentImageFile(e, side)}
              className="hidden"
            />
          </label>
          <button
            type="button"
            onClick={removeContentImage}
            aria-label="Eliminar imagen adjunta"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white/95 text-slate-400 shadow-[0_2px_5px_-4px_rgba(15,23,42,0.45)] transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      );
    }

    // Una tarjeta conserva una sola imagen, pero puede estar en cualquiera de sus lados.
    if (contentImage) return null;

    return (
      <label
        className="absolute bottom-1.5 right-1.5 flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white/95 text-slate-400 shadow-[0_2px_5px_-4px_rgba(15,23,42,0.45)] transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 focus-within:outline-none focus-within:ring-2 focus-within:ring-slate-300"
        title={`Añadir imagen a ${side === 'question' ? 'pregunta' : 'respuesta'}`}
      >
        <ImagePlus className="h-4 w-4" />
        <span className="sr-only">Añadir imagen a {side === 'question' ? 'pregunta' : 'respuesta'}</span>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handleContentImageFile(e, side)}
          className="hidden"
        />
      </label>
    );
  };

  const renderEditorField = ({ side, label, value, onChange, placeholder }) => (
    <div className="flex min-w-0 flex-col">
      <label className="mb-1 block text-xs font-medium text-slate-500">
        {label}
      </label>
      <div className="relative rounded-xl border border-slate-200 bg-white transition-colors focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-900/[0.08]">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={label}
          required
          className="min-h-[108px] w-full resize-y rounded-xl border-0 bg-transparent px-3 pb-14 pt-2.5 text-sm font-medium leading-relaxed text-slate-800 outline-none placeholder:text-slate-300 focus:ring-0"
        />
        {renderImageControl(side)}
      </div>
    </div>
  );

  // 3. MODO INDIVIDUAL: captura directa y compacta de una tarjeta.
  return (
    <div className="grid gap-4 animate-[fadeIn_0.2s_ease] sm:grid-cols-2">
      {renderEditorField({
        side: 'question',
        label: 'Pregunta',
        value: question,
        onChange: setQuestion,
        placeholder: '¿Cuál es la capital de Francia?'
      })}

      {renderEditorField({
        side: 'answer',
        label: 'Respuesta',
        value: answer,
        onChange: setAnswer,
        placeholder: 'París'
      })}
    </div>
  );
}
