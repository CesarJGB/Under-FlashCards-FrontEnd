// FILE: frontend/src/components/creator/FormInputs.jsx
// Entrega v4. Guardar este archivo con extensión .jsx.
import {
  lazy,
  Suspense,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
    value: safePreviousText + separator + safeExtractedText.slice(0, remaining),
    clipped: safeExtractedText.length > remaining,
  };
}

function getPdfCharacterCount(source, result, extractedText) {
  const candidates = [
    source?.textCharacterCount,
    result?.plainText?.length,
    result?.stats?.sourceCharacters,
    extractedText?.length,
  ];

  for (const candidate of candidates) {
    const count = Number(candidate);
    if (Number.isFinite(count) && count >= 0) return count;
  }

  return 0;
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
  const [pdfSource, setPdfSource] = useState(null);
  const [showPdfTextEditor, setShowPdfTextEditor] = useState(false);
  const aiTextRef = useRef(aiText || '');

  useEffect(() => {
    aiTextRef.current = aiText || '';
    if (!aiText) {
      setPdfSource((previousSource) => (previousSource ? null : previousSource));
      setShowPdfTextEditor(false);
    }
  }, [aiText]);

  const closeManualEditor = useCallback(() => {
    setManualEditorSide(null);
    onModalStateChange?.(false);
  }, [onModalStateChange]);

  const openManualEditor = useCallback((side) => {
    setManualEditorSide(side);
    onModalStateChange?.(true);
  }, [onModalStateChange]);

  const handlePdfTextExtracted = useCallback((extractedText, result, source) => {
    const preview = appendPdfTextSafely(aiTextRef.current, extractedText || '');
    const nextSource = {
      ...(source || {}),
      fileName: source?.fileName || 'Documento PDF',
      pageLabel: source?.pageLabel || 'PDF analizado',
      textCharacterCount: getPdfCharacterCount(source, result, extractedText),
    };
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

    aiTextRef.current = preview.value;
    setPdfSource(nextSource);
    setShowPdfTextEditor(false);
    onPdfExtractionComplete?.(report, nextSource);
    startTransition(() => {
      setAiText(preview.value);
    });
  }, [onPdfExtractionComplete, setAiText]);

  const handleAiTextChange = useCallback((event) => {
    const nextText = event.target.value;
    aiTextRef.current = nextText;
    setPdfSource(null);
    setAiText(nextText);
  }, [setAiText]);

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
    const sourceCharacterCount = pdfSource?.textCharacterCount || 0;

    return (
      <div className="flex animate-[fadeIn_0.2s_ease] flex-col gap-3">
        <Suspense fallback={null}>
          <PdfExtractor onTextExtracted={handlePdfTextExtracted} />
        </Suspense>

        {pdfSource && !showPdfTextEditor ? (
          <div className="flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-500 shadow-sm">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black text-slate-800">{pdfSource.fileName}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] font-semibold">
                <span className="text-slate-500">{pdfSource.pageLabel}</span>
                <span className="h-1 w-1 shrink-0 rounded-full bg-indigo-200" aria-hidden="true" />
                <span className="text-indigo-600">
                  {sourceCharacterCount.toLocaleString('es-MX')} caracteres
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowPdfTextEditor(true)}
              className="flex h-8 shrink-0 cursor-pointer items-center rounded-lg border border-indigo-100 bg-white px-2.5 text-[10px] font-bold text-slate-600 transition-colors hover:bg-slate-50"
              title="Editar el texto extraído"
            >
              Editar
            </button>
          </div>
        ) : (
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
              onChange={handleAiTextChange}
              maxLength={MAX_AI_DOCUMENT_TEXT_LENGTH}
              placeholder="Pega tu información aquí o agrega un PDF con el botón +."
              className="min-h-[160px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50/40 px-3 py-2.5 text-xs font-medium leading-relaxed text-slate-800 outline-none transition-colors placeholder:text-slate-300 focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-500/[0.08]"
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5">
          <span className="shrink-0 text-xs font-bold text-slate-700">Tarjetas</span>
          <div className="grid min-w-0 flex-1 grid-cols-4 gap-1.5 rounded-lg bg-white p-1">
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
                  className={[
                    'min-h-9 min-w-0 cursor-pointer rounded-md px-1 text-xs font-extrabold transition-colors',
                    isSelected
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
                  ].join(' ')}
                >
                  {number}
                </button>
              );
            })}

            <input
              type="number"
              inputMode="numeric"
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
              className={[
                'min-h-9 min-w-0 w-full rounded-md border px-1 text-center text-xs font-extrabold outline-none transition-colors',
                customCardCount !== ''
                  ? 'border-slate-900 bg-slate-900 text-white placeholder:text-slate-400'
                  : 'border-transparent bg-slate-50 text-slate-600 placeholder:text-slate-400 focus:border-slate-300 focus:bg-white',
              ].join(' ')}
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
        aria-label={'Editar ' + label.toLowerCase()}
        data-testid={'manual-' + side + '-editor-trigger'}
      >
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className={[
          'mt-1.5 max-h-[58px] overflow-hidden whitespace-pre-wrap break-words pr-9 text-sm font-medium leading-relaxed',
          value ? 'text-slate-800' : 'text-slate-300',
        ].join(' ')}
        >
          {value || placeholder}
        </span>
        {hasImage && (
          <span className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
            <img src={contentImage} alt={'Imagen de ' + label.toLowerCase()} className="h-full w-full object-cover" />
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
