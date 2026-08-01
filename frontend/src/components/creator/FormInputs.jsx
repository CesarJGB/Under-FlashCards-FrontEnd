import {
  lazy,
  Suspense,
  startTransition,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { FileText, Layers } from 'lucide-react';
import ManualCardEditorModal from './ManualCardEditorModal';

const PdfExtractor = lazy(() => import('./PdfExtractor'));
const MAX_AI_DOCUMENT_TEXT_LENGTH = 600000;
const configuredMaxAiCards = Number.parseInt(import.meta.env.VITE_MAX_AI_CARDS, 10);
const MAX_AI_CARDS = Number.isInteger(configuredMaxAiCards) && configuredMaxAiCards > 0
  ? configuredMaxAiCards
  : 500;

function appendPdfTextSafely(previousText, extractedText) {
  const safePreviousText = previousText || '';
  const safeExtractedText = extractedText || '';
  const separator = safePreviousText ? '\n\n' : '';
  const remaining = Math.max(0, MAX_AI_DOCUMENT_TEXT_LENGTH - safePreviousText.length - separator.length);
  return {
    value: `${safePreviousText}${separator}${safeExtractedText.slice(0, remaining)}`,
    clipped: safeExtractedText.length > remaining,
  };
}

export default function FormInputs({
  isBulk,
  isAi,
  question,
  setQuestion,
  answer,
  setAnswer,
  bulkText,
  setBulkText,
  contentImage,
  imageSide,
  handleContentImageFile,
  removeContentImage,
  aiText,
  setAiText,
  aiNumCards,
  setAiNumCards,
  editingId,
  saving,
  error,
  onSaveManualCard,
  styles,
  updateStyle,
  ALIGNS,
  SWATCHES,
  textAlign,
  setTextAlign,
  onModalStateChange,
  onPdfExtractionComplete,
}) {
  const [customCardCount, setCustomCardCount] = useState('');
  const [manualEditorSide, setManualEditorSide] = useState(null);

  const closeManualEditor = useCallback(() => {
    setManualEditorSide(null);
    onModalStateChange?.(false);
  }, [onModalStateChange]);

  const openManualEditor = useCallback((side) => {
    setManualEditorSide(side);
    onModalStateChange?.(true);
  }, [onModalStateChange]);

  const handlePdfTextExtracted = useCallback((extractedText, result) => {
    const preview = appendPdfTextSafely(aiText || '', extractedText || '');
    const report = result
      ? {
        ...result,
        stats: {
          ...result.stats,
          truncated: Boolean(result.stats?.truncated || preview.clipped),
          clippedByInputLimit: preview.clipped,
        },
      }
      : null;

    onPdfExtractionComplete?.(report);
    startTransition(() => {
      setAiText((previousText) => appendPdfTextSafely(previousText, extractedText).value);
    });
  }, [aiText, onPdfExtractionComplete, setAiText]);

  const bulkStats = useMemo(() => {
    const lines = bulkText.split(/\r?\n/);
    let completePairs = 0;
    let pendingQuestion = false;

    lines.forEach((line) => {
      const cleanLine = line.trim();

      if (/^[pP]\s*:/i.test(cleanLine)) {
        pendingQuestion = Boolean(cleanLine.replace(/^[pP]\s*:/i, '').trim());
      } else if (/^[rR]\s*:/i.test(cleanLine)) {
        const hasAnswer = Boolean(cleanLine.replace(/^[rR]\s*:/i, '').trim());

        if (pendingQuestion && hasAnswer) {
          completePairs += 1;
          pendingQuestion = false;
        }
      }
    });

    return {
      completePairs,
      lines: bulkText ? lines.length : 0,
    };
  }, [bulkText]);

  if (isAi) {
    return (
      <div className="flex animate-[fadeIn_0.2s_ease] flex-col gap-3">
        <Suspense
          fallback={(
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-500">
              <FileText className="h-4 w-4 shrink-0 text-indigo-500" />
              <span>Preparando módulo PDF...</span>
            </div>
          )}
        >
          <PdfExtractor onTextExtracted={handlePdfTextExtracted} />
        </Suspense>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <label htmlFor="ai-source-text" className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <FileText className="h-3.5 w-3.5 text-slate-400" />
              <span>Apuntes e indicaciones:</span>
            </label>
            <span className="shrink-0 text-[10px] font-semibold tabular-nums text-slate-400">
              {(aiText || '').length.toLocaleString('es-MX')} / {MAX_AI_DOCUMENT_TEXT_LENGTH.toLocaleString('es-MX')}
            </span>
          </div>
          <textarea
            id="ai-source-text"
            value={aiText}
            onChange={(event) => setAiText(event.target.value)}
            maxLength={MAX_AI_DOCUMENT_TEXT_LENGTH}
            placeholder="Pega tu información aquí o usa el extractor de PDF para rellenar este campo automáticamente."
            className="min-h-[160px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50/40 px-3 py-2.5 text-xs font-medium leading-relaxed text-slate-800 outline-none transition-colors placeholder:text-slate-300 focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-500/[0.08]"
          />
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="block text-xs font-bold text-slate-700">Densidad del mazo</span>
            <span className="block text-[10px] font-medium text-slate-400">¿Cuántas tarjetas aproximadas deseas generar?</span>
          </div>

          <div className="grid w-full grid-cols-4 gap-1 rounded-xl bg-white p-1 sm:w-auto sm:min-w-[220px]">
            {[5, 10, 15].map((number) => {
              const isSelected = customCardCount === '' && aiNumCards === number;
              return (
                <button
                  key={number}
                  type="button"
                  onClick={() => {
                    setCustomCardCount('');
                    setAiNumCards(number);
                  }}
                  className={`min-h-9 cursor-pointer rounded-lg px-2 text-xs font-extrabold transition-colors ${isSelected ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
                >
                  {number}
                </button>
              );
            })}

            <input
              type="number"
              min="1"
              max={MAX_AI_CARDS}
              placeholder="Libre"
              value={customCardCount}
              onChange={(event) => {
                const rawValue = event.target.value;
                if (rawValue === '') {
                  setCustomCardCount('');
                  setAiNumCards('');
                  return;
                }

                const parsed = Number.parseInt(rawValue, 10);
                const nextValue = Number.isNaN(parsed) ? '' : Math.min(MAX_AI_CARDS, Math.max(1, parsed));
                setCustomCardCount(nextValue === '' ? '' : String(nextValue));
                setAiNumCards(nextValue);
              }}
              aria-label="Cantidad libre de tarjetas"
              className={`min-h-9 w-full rounded-lg border px-1 text-center text-xs font-extrabold outline-none transition-colors ${customCardCount !== '' ? 'border-slate-900 bg-slate-900 text-white placeholder:text-slate-400' : 'border-transparent bg-slate-50 text-slate-600 placeholder:text-slate-400 focus:border-slate-300 focus:bg-white'}`}
            />
          </div>
        </div>
      </div>
    );
  }

  if (isBulk) {
    return (
      <div className="flex animate-[fadeIn_0.2s_ease] flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="bulk-card-text" className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-slate-700">
            <Layers className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span>Pega tu texto estructurado (P: / R:):</span>
          </label>
          <span className="shrink-0 rounded-full border border-indigo-100/60 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold tabular-nums text-indigo-600">
            {bulkStats.completePairs} {bulkStats.completePairs === 1 ? 'par listo' : 'pares listos'}
          </span>
        </div>

        <textarea
          id="bulk-card-text"
          value={bulkText}
          onChange={(event) => setBulkText(event.target.value)}
          placeholder={'P: ¿Qué día fue teóricamente ayer?\nR: 20 de junio\n\nP: ¿Cuál es el número atómico del Hidrógeno?\nR: 1'}
          className="min-h-[170px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50/40 px-3 py-2.5 font-mono text-xs leading-relaxed text-slate-800 outline-none transition-colors placeholder:text-slate-300 focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-900/[0.06]"
        />

        <div className="flex items-center justify-between gap-3 text-[10px] font-medium text-slate-400">
          <span>{bulkText.length.toLocaleString('es-MX')} caracteres</span>
          <span>{bulkStats.lines || 0} líneas</span>
        </div>
      </div>
    );
  }

  const renderEditorTrigger = ({ side, label, value, placeholder }) => {
    const hasImage = Boolean(contentImage && imageSide === side);

    return (
      <button
        type="button"
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => openManualEditor(side)}
        className="relative flex min-h-[96px] w-full cursor-pointer flex-col rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition-colors active:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        aria-label={`Editar ${label.toLowerCase()}`}
        data-testid={`manual-${side}-editor-trigger`}
      >
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className={`mt-1.5 max-h-[58px] overflow-hidden whitespace-pre-wrap break-words pr-9 text-sm font-medium leading-relaxed ${value ? 'text-slate-800' : 'text-slate-300'}`}>
          {value || placeholder}
        </span>
        {hasImage && (
          <span className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
            <img src={contentImage} alt={`Imagen de ${label.toLowerCase()}`} className="h-full w-full object-cover" />
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      <div className="grid animate-[fadeIn_0.2s_ease] gap-2.5 sm:grid-cols-2">
        {renderEditorTrigger({ side: 'question', label: 'Pregunta', value: question, placeholder: '¿Cuál es la capital de Francia?' })}
        {renderEditorTrigger({ side: 'answer', label: 'Respuesta', value: answer, placeholder: 'París' })}
      </div>

      <ManualCardEditorModal
        key={manualEditorSide || 'manual-card-editor-closed'}
        open={Boolean(manualEditorSide)}
        initialSide={manualEditorSide || 'question'}
        question={question}
        setQuestion={setQuestion}
        answer={answer}
        setAnswer={setAnswer}
        contentImage={contentImage}
        imageSide={imageSide}
        handleContentImageFile={handleContentImageFile}
        removeContentImage={removeContentImage}
        onSaveCard={onSaveManualCard}
        onClose={closeManualEditor}
        saving={saving}
        error={error}
        isEditing={Boolean(editingId)}
        styles={styles}
        updateStyle={updateStyle}
        ALIGNS={ALIGNS}
        SWATCHES={SWATCHES}
        textAlign={textAlign}
        setTextAlign={setTextAlign}
      />
    </>
  );
}
