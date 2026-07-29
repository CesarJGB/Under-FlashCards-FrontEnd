import { lazy, Suspense, startTransition, useState } from 'react';
import { FileText, HelpCircle, ImagePlus, Layers, MessageCircle, X } from 'lucide-react';

const PdfExtractor = lazy(() => import('./PdfExtractor'));
const MAX_AI_DOCUMENT_TEXT_LENGTH = 600000;
const configuredMaxAiCards = Number.parseInt(import.meta.env.VITE_MAX_AI_CARDS, 10);
const MAX_AI_CARDS = Number.isInteger(configuredMaxAiCards) && configuredMaxAiCards > 0
  ? configuredMaxAiCards
  : 500;

export default function FormInputs({
  isBulk, isAi, editingId, question, setQuestion, answer, setAnswer, bulkText, setBulkText,
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

  const isEditing = Boolean(editingId);

  const renderImageControl = (side) => {
    const isAttachedHere = Boolean(contentImage && imageSide === side);

    if (isAttachedHere) {
      return (
        <div className="flex min-w-0 max-w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5 shadow-[0_3px_12px_-10px_rgba(15,23,42,0.6)]">
          <img
            src={contentImage}
            alt={`Imagen de ${side === 'question' ? 'pregunta' : 'respuesta'}`}
            className="h-9 w-9 shrink-0 rounded-lg border border-slate-200 object-cover bg-slate-100"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-bold text-slate-700">Imagen adjunta</p>
            <p className="truncate text-[10px] font-medium text-slate-400">Se mostrará en la tarjeta</p>
          </div>
          <button
            type="button"
            onClick={removeContentImage}
            aria-label="Eliminar imagen adjunta"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      );
    }

    // Solo se conserva una imagen por tarjeta, igual que en el flujo original.
    if (contentImage) return null;

    return (
      <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 text-[11px] font-bold text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900 focus-within:ring-2 focus-within:ring-slate-300 focus-within:ring-offset-1">
        <ImagePlus className="h-4 w-4 text-slate-400" />
        <span>Añadir imagen</span>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handleContentImageFile(e, side)}
          className="hidden"
        />
      </label>
    );
  };

  const renderEditorField = ({ side, label, icon: Icon, value, onChange, placeholder, helper }) => (
    <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 transition-colors focus-within:border-slate-300 focus-within:bg-slate-50 sm:p-4">
      <div className={`absolute inset-y-0 left-0 w-1 ${side === 'question' ? 'bg-slate-800' : 'bg-emerald-500'}`} aria-hidden="true" />

      <div className="flex items-start gap-3">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[11px] font-black ${side === 'question' ? 'bg-slate-900 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
          {side === 'question' ? '01' : '02'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-extrabold tracking-tight text-slate-800">
            <Icon className="h-4 w-4 text-slate-500" aria-hidden="true" />
            {label}
          </div>
          <p className="mt-0.5 text-[11px] font-medium leading-relaxed text-slate-400">{helper}</p>
        </div>
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="mt-3 min-h-[116px] w-full resize-y rounded-xl border border-slate-200/90 bg-white px-3.5 py-3 text-sm font-medium leading-relaxed text-slate-800 outline-none transition-shadow placeholder:text-slate-300 focus:border-slate-400 focus:ring-4 focus:ring-slate-900/[0.06]"
      />

      <div className="mt-3 flex min-h-10 items-center justify-between gap-2">
        <span className="text-[10px] font-semibold text-slate-400">{value.length > 0 ? `${value.length} caracteres` : 'Campo requerido'}</span>
        {renderImageControl(side)}
      </div>
    </section>
  );

  // 3. MODO INDIVIDUAL: editor de una tarjeta con jerarquía de creación y edición.
  return (
    <div className="animate-[fadeIn_0.2s_ease]">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            {isEditing ? 'Editando tarjeta' : 'Nueva tarjeta'}
          </p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900">
            {isEditing ? 'Refina el contenido' : 'Crea una tarjeta'}
          </h2>
          <p className="mt-1 max-w-[30rem] text-xs font-medium leading-relaxed text-slate-500">
            Escribe una pregunta clara y una respuesta que puedas recordar.
          </p>
        </div>

        <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-extrabold text-slate-500">
          1 tarjeta
        </span>
      </div>

      <div className="space-y-3">
        {renderEditorField({
          side: 'question',
          label: 'Pregunta',
          icon: HelpCircle,
          value: question,
          onChange: setQuestion,
          placeholder: '¿Cuál es la capital de Francia?',
          helper: 'Formula algo que puedas responder sin ver la solución.'
        })}

        {renderEditorField({
          side: 'answer',
          label: 'Respuesta',
          icon: MessageCircle,
          value: answer,
          onChange: setAnswer,
          placeholder: 'París',
          helper: 'Añade la respuesta directa, una explicación o un ejemplo.'
        })}
      </div>

      <p className="mt-4 text-center text-[10px] font-semibold text-slate-400">
        Puedes ajustar el estilo y ver una previsualización desde la barra inferior.
      </p>
    </div>
  );
}
