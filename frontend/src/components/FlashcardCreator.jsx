/* FILE: frontend/src/components/FlashcardCreator.jsx */
import { useCallback, useState, useEffect, useRef } from 'react';
import {
  SlidersHorizontal, Loader2, Plus, Check, Trash2,
  AlignLeft, AlignCenter, AlignRight, Sparkles, Layers, X,
} from 'lucide-react';

import ActionSheet from './common/ActionSheet';
import ProcessingActionSheet from './common/ProcessingActionSheet';
import FormInputs from './creator/FormInputs';
import StylePanel from './creator/StylePanel';
import LivePreview from './creator/LivePreview';
import FloatingPreviewPanel, { getStoredPreviewPanelMode } from './creator/FloatingPreviewPanel';
import './creator/magic-ai-button.css';

import { parseCardStyles } from '../lib/utils';
import { readAiGenerationProgress } from '../lib/aiProgressStream';
import { getJSON, setJSON } from '../lib/safeLocalStorage';

const ALIGNS = [
  { label: 'Izquierda', value: 'left', Icon: AlignLeft },
  { label: 'Centro', value: 'center', Icon: AlignCenter },
  { label: 'Derecha', value: 'right', Icon: AlignRight },
];

const SWATCHES = [
  { label: 'Predeterminado', value: '' },
  { label: 'Blanco', value: '#ffffff' },
  { label: 'Slate', value: '#94a3b8' },
  { label: 'Oro', value: '#f59e0b' },
  { label: 'Esmeralda', value: '#10b981' },
  { label: 'Coral', value: '#f43f5e' },
  { label: 'Azul', value: '#3b82f6' },
];

const PREVIEW_VISIBLE_KEY = 'ufc_preview_visible_v1';
const AI_GENERATION_ENDPOINT = import.meta.env.VITE_AI_GENERATION_MODE === 'v1'
  ? '/api/flashcards/generate-ai'
  : '/api/flashcards/generate-ai-v2';
const DEFAULT_AI_ROUTING_MODE = 'throughput';

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readNumericValue(sources, keys, fallback = 0) {
  for (const source of sources) {
    if (!isObject(source)) continue;
    for (const key of keys) {
      const value = Number(source[key]);
      if (Number.isFinite(value)) return Math.max(0, value);
    }
  }
  return fallback;
}

function buildAiCompletionProgress(result, previousProgress, requestedTarget) {
  const resultSources = [
    result?.stats,
    result?.metrics,
    result?.progress,
    result?.data,
    result?.result,
    result,
  ];
  const cardsCount = Array.isArray(result)
    ? result.length
    : Array.isArray(result?.cards)
      ? result.cards.length
      : Array.isArray(result?.data?.cards)
        ? result.data.cards.length
        : undefined;
  const target = readNumericValue(resultSources, ['target', 'requested', 'requestedCount'], requestedTarget);
  const generated = readNumericValue(
    resultSources,
    ['generated', 'generatedCount', 'totalGenerated'],
    previousProgress?.generated || 0,
  );
  const audited = readNumericValue(
    resultSources,
    ['audited', 'auditedCount', 'totalAudited'],
    previousProgress?.audited || 0,
  );
  const accepted = readNumericValue(
    resultSources,
    ['accepted', 'acceptedCount', 'saved', 'created', 'cardsCreated'],
    cardsCount ?? previousProgress?.accepted ?? 0,
  );

  return {
    ...(previousProgress || {}),
    status: 'success',
    message: 'Tus tarjetas están listas.',
    generated,
    audited,
    accepted,
    target,
    total: target,
    summary: `${accepted.toLocaleString('es-MX')} ${accepted === 1 ? 'tarjeta lista' : 'tarjetas listas'}${target ? ` de ${target.toLocaleString('es-MX')} solicitadas` : ''}.`,
  };
}

function MagicSparkleIcon() {
  return (
    <svg
      className="magic-ai-button__sparkle"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        className="magic-ai-button__path"
        d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"
      />
      <path
        className="magic-ai-button__path"
        d="M19 2L19.6 4.4L22 5L19.6 5.6L19 8L18.4 5.6L16 5L18.4 4.4L19 2Z"
      />
      <path
        className="magic-ai-button__path"
        d="M5 16L5.6 18.4L8 19L5.6 19.6L5 22L4.4 19.6L2 19L4.4 18.4L5 16Z"
      />
    </svg>
  );
}

function MagicAiButton({
  children,
  className = '',
  compact = false,
  selected = false,
  loading = false,
  ...props
}) {
  const buttonClassName = [
    'magic-ai-button',
    compact ? 'magic-ai-button--mode' : '',
    selected ? 'magic-ai-button--selected' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button {...props} className={buttonClassName} aria-busy={loading || undefined}>
      <span className="magic-ai-button__dots" aria-hidden="true" />
      {loading ? (
        <Loader2 className="magic-ai-button__loading-icon animate-spin" aria-hidden="true" />
      ) : (
        <MagicSparkleIcon />
      )}
      <span className="magic-ai-button__text">{children}</span>
    </button>
  );
}

export default function FlashcardCreator({
  question, setQuestion, answer, setAnswer, bgImage, setBgImage, textAlign, setTextAlign,
  fontSize, setFontSize, showStyles, setShowStyles, isBulk, setIsBulk, bulkText, setBulkText,
  editingId, saving, error, setError, onSubmit, onCancel, contentImage, setContentImage,
  imageSide, setImageSide, onFastDelete, hasCards, onOpenCollection, cardCount = 0,
  userId, deckId, authToken, onAiSuccess, onInviteRequired, onSaveManualCard,
}) {
  // La vista independiente queda desactivada en esta versión. Conservamos el
  // estado y la persistencia para poder reactivar el panel en una versión futura,
  // pero una preferencia antigua no debe abrirlo automáticamente.
  const [showPreview, setShowPreview] = useState(false);
  const [previewMode, setPreviewMode] = useState(() => getStoredPreviewPanelMode());

  // Estado para saber si el modal a pantalla completa está activo
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  const [isAi, setIsAi] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiNumCards, setAiNumCards] = useState(5);
  const [aiRoutingMode, setAiRoutingMode] = useState(DEFAULT_AI_ROUTING_MODE);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiProgress, setAiProgress] = useState(null);
  const [isAiGenerationSheetOpen, setIsAiGenerationSheetOpen] = useState(false);

  const aiProgressRef = useRef(null);

  const activeTab = editingId ? 'single' : (isAi ? 'ai' : (isBulk ? 'bulk' : 'single'));


  const updateAiProgress = useCallback((nextProgress) => {
    setAiProgress((previousProgress) => {
      const nextValue = typeof nextProgress === 'function'
        ? nextProgress(previousProgress)
        : nextProgress;
      aiProgressRef.current = nextValue;
      return nextValue;
    });
  }, []);

  useEffect(() => {
    setJSON(PREVIEW_VISIBLE_KEY, showPreview);
  }, [showPreview]);

  useEffect(() => {
    if (getJSON(PREVIEW_VISIBLE_KEY)) setJSON(PREVIEW_VISIBLE_KEY, false);
  }, []);

  useEffect(() => {
    if (showPreview && previewMode === 'docked' && showStyles) setShowStyles(false);
  }, [previewMode, setShowStyles, showPreview, showStyles]);

  const handleTabChange = (tabId) => {
    setError('');
    setShowPreview(false);
    setShowStyles(false);
    setIsAiGenerationSheetOpen(false);

    if (tabId === 'single') {
      setIsBulk(false);
      setIsAi(false);
    } else if (tabId === 'bulk') {
      setIsBulk(true);
      setIsAi(false);
    } else if (tabId === 'ai') {
      setIsBulk(false);
      setIsAi(true);
    }
  };

  const styles = parseCardStyles(fontSize);

  const updateStyle = (key, value) => {
    setFontSize((currentFontSize) => {
      const currentStyles = parseCardStyles(currentFontSize);
      return JSON.stringify({ ...currentStyles, [key]: value });
    });
  };

  const handleOpenStyles = (event) => {
    event?.preventDefault?.();
    setShowPreview(false);
    setShowStyles((current) => !current);
  };

  const handleManualModalStateChange = useCallback((isOpen) => {
    setIsManualModalOpen(isOpen);
    if (isOpen) setShowStyles(false);
  }, [setShowStyles]);

  const handleBgFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 700 * 1024) {
      setError('La imagen es muy grande (máx. 700KB).');
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onload = () => setBgImage(reader.result);
    reader.readAsDataURL(file);
  };

  const handleContentImageFile = async (source, side) => {
    const file = typeof File !== 'undefined' && source instanceof File
      ? source
      : source?.target?.files?.[0];
    if (!file) {
      if (contentImage && (side === 'question' || side === 'answer')) setImageSide(side);
      return;
    }
    setError('');
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (readerEvent) => {
        const img = new window.Image();
        img.src = readerEvent.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 600;
          let { width, height } = img;
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          setContentImage(canvas.toDataURL('image/jpeg', 0.7));
          setImageSide(side);
        };
      };
    } catch {
      setError('Error al procesar la imagen.');
    }
    if (source?.target) source.target.value = '';
  };

  const submitManualCard = useCallback(() => {
    const submitEvent = { preventDefault() {} };
    return (onSaveManualCard || onSubmit)?.(submitEvent);
  }, [onSaveManualCard, onSubmit]);

  const executeAiGeneration = async () => {
    if (!aiText.trim() || aiSaving) return;
    setAiSaving(true);
    setError('');
    aiProgressRef.current = null;
    updateAiProgress({
      generated: 0,
      audited: 0,
      accepted: 0,
      target: Number(aiNumCards) || 0,
      total: Number(aiNumCards) || 0,
      message: 'Preparando la generación con IA...',
      status: 'processing',
    });

    let completed = false;

    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
      const response = await fetch(`${BACKEND_URL}${AI_GENERATION_ENDPOINT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          userId,
          deckId,
          text: aiText,
          count: aiNumCards,
          routingMode: aiRoutingMode,
          batchStyles: { bgImage, textAlign, fontSize },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 403 && errorData.code === 'INVITE_REQUIRED') {
          onInviteRequired?.();
          return;
        }
        if (response.status === 401) {
          throw new Error('Tu sesión expiró. Cierra sesión e inicia sesión de nuevo para generar con IA.');
        }
        throw new Error(errorData.message || errorData.error || 'El motor de IA experimentó una saturación o no configuraste tu API Key.');
      }

      const result = await readAiGenerationProgress(response, updateAiProgress);
      updateAiProgress(buildAiCompletionProgress(result, aiProgressRef.current, Number(aiNumCards) || 0));
      await onAiSuccess?.(result);
      setAiText('');
      completed = true;
    } catch (submitError) {
      setError(submitError.message || 'Error de conexión con el nodo de Inteligencia Artificial.');
    } finally {
      setAiSaving(false);
      if (!completed) updateAiProgress(null);
    }
  };

  const handleFormSubmit = (event) => {
    event?.preventDefault?.();
    if (activeTab === 'ai') {
      if (!aiText.trim() || aiSaving) return;
      setShowStyles(false);
      setIsAiGenerationSheetOpen(true);
      return;
    }

    return onSubmit?.(event);
  };

  const aiCardCount = Number(aiNumCards) || 0;
  const aiGenerationDescription = `Generar ${aiCardCount.toLocaleString('es-MX')} ${aiCardCount === 1 ? 'tarjeta' : 'tarjetas'} con tus apuntes actuales.`;
  const submitDisabled = saving || aiSaving || (
    activeTab === 'ai'
      ? !aiText.trim()
      : (activeTab === 'bulk' ? !bulkText.trim() : (!question.trim() || !answer.trim()))
  );
  const normalizedCardCount = Math.max(0, Number(cardCount) || 0);
  const cardCountLabel = normalizedCardCount > 9999
    ? new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 0 }).format(normalizedCardCount)
    : normalizedCardCount.toLocaleString('es-MX');
  const cardCountTextSize = cardCountLabel.length >= 5
    ? 'text-[5.5px] tracking-[-0.08em]'
    : cardCountLabel.length === 4
      ? 'text-[6px] tracking-[-0.06em]'
      : cardCountLabel.length === 3
        ? 'text-[7px] tracking-[-0.04em]'
        : cardCountLabel.length === 2
          ? 'text-[8px]'
          : 'text-[9px]';

  return (
    <form onSubmit={handleFormSubmit} className="flex flex-col bg-slate-50 relative w-full">
      <div className="flex-1 px-4 py-4 space-y-4 max-w-2xl mx-auto w-full">
        {!editingId && (
          <div className="flex justify-center">
            <div
              role="tablist"
              aria-label="Modo de creación"
              className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 w-full shadow-sm border border-slate-200"
            >
              {[
                { id: 'single', label: 'Manual', Icon: Plus },
                { id: 'bulk', label: 'Lote', Icon: Layers },
                { id: 'ai', label: 'IA', Icon: Sparkles },
              ].map((tab) => {
                const TabIcon = tab.Icon;
                const isSelected = activeTab === tab.id;

                if (isSelected && tab.id === 'ai') {
                  return (
                    <MagicAiButton
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      onClick={() => handleTabChange(tab.id)}
                      compact
                      selected
                    >
                      {tab.label}
                    </MagicAiButton>
                  );
                }

                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => handleTabChange(tab.id)}
                    className={`inline-flex min-h-10 items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white shadow-md'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <TabIcon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
          <FormInputs
            isBulk={isBulk}
            isAi={isAi}
            question={question}
            setQuestion={setQuestion}
            answer={answer}
            setAnswer={setAnswer}
            bulkText={bulkText}
            setBulkText={setBulkText}
            contentImage={contentImage}
            imageSide={imageSide}
            handleContentImageFile={handleContentImageFile}
            removeContentImage={() => { setContentImage(''); setImageSide(''); }}
            aiText={aiText}
            setAiText={setAiText}
            aiNumCards={aiNumCards}
            setAiNumCards={setAiNumCards}
            aiRoutingMode={aiRoutingMode}
            setAiRoutingMode={setAiRoutingMode}
            aiSaving={aiSaving}
            editingId={editingId}
            saving={saving}
            error={error}
            onSaveManualCard={submitManualCard}
            styles={styles}
            updateStyle={updateStyle}
            ALIGNS={ALIGNS}
            SWATCHES={SWATCHES}
            textAlign={textAlign}
            setTextAlign={setTextAlign}
            onModalStateChange={handleManualModalStateChange}
          />
        </div>

        {showPreview && !isManualModalOpen && (
          <FloatingPreviewPanel
            question={activeTab === 'ai' ? '¿Pregunta muestra generada por la IA?' : question}
            answer={activeTab === 'ai' ? 'Esta será la respuesta explicativa de tu tarjeta inteligente.' : answer}
            bgImage={bgImage}
            textAlign={textAlign}
            styles={styles}
            contentImage={contentImage}
            imageSide={imageSide}
            ALIGNS={ALIGNS}
            SWATCHES={SWATCHES}
            setTextAlign={setTextAlign}
            handleBgFile={handleBgFile}
            updateStyle={updateStyle}
            setBgImage={setBgImage}
            onModeChange={setPreviewMode}
          />
        )}

        {error && <p className="text-xs text-red-600 font-semibold bg-red-50 border border-red-100 px-4 py-2.5 rounded-2xl">{error}</p>}
      </div>

      <footer
        className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-lg"
      >
        <div className="flex items-center justify-between max-w-2xl mx-auto w-full gap-2">
          <div className="flex min-w-0 items-center gap-0.5 sm:gap-1">
            <button
              type="button"
              onPointerDown={(event) => event.preventDefault()}
              onClick={handleOpenStyles}
              aria-expanded={showStyles}
              className={`flex min-h-11 w-14 flex-col items-center justify-center gap-0.5 rounded-xl p-2 transition-colors sm:w-20 ${showStyles ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <SlidersHorizontal className="w-5 h-5" />
              <span className="text-[10px] font-bold">Estilo</span>
            </button>

            {!editingId ? (
              onFastDelete && hasCards ? (
                <button
                  type="button"
                  disabled={aiSaving}
                  onClick={onFastDelete}
                  className="flex min-h-11 w-12 flex-col items-center justify-center gap-0.5 rounded-xl p-2 text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 sm:w-16"
                >
                  <Trash2 className="w-5 h-5" />
                  <span className="text-[10px] font-bold">Borrar</span>
                </button>
              ) : <div className="hidden sm:block w-16" />
            ) : (
              <button
                type="button"
                onClick={onCancel}
                className="flex min-h-11 w-12 flex-col items-center justify-center gap-0.5 rounded-xl p-2 text-slate-600 transition-colors hover:bg-slate-100 sm:w-16"
              >
                <X className="w-5 h-5" />
                <span className="text-[10px] font-bold">Cancelar</span>
              </button>
            )}

            {typeof onOpenCollection === 'function' && (
              <button
                type="button"
                disabled={saving || aiSaving}
                onClick={onOpenCollection}
                aria-label={`Ver ${normalizedCardCount} ${normalizedCardCount === 1 ? 'carta' : 'cartas'}`}
                className="flex min-h-11 w-12 flex-col items-center justify-center gap-0.5 rounded-xl p-2 text-slate-600 transition-colors hover:bg-slate-100 active:scale-[0.98] disabled:opacity-50 sm:w-16"
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-[5px] border-2 border-current font-extrabold leading-none tabular-nums ${cardCountTextSize}`}
                  aria-hidden="true"
                >
                  {cardCountLabel}
                </span>
                <span className="text-[10px] font-bold">Cartas</span>
              </button>
            )}
          </div>

          {activeTab === 'ai' ? (
            <MagicAiButton
              type="submit"
              disabled={submitDisabled}
              loading={saving || aiSaving}
              selected
              className="flex-1 sm:flex-initial sm:min-w-[200px]"
            >
              Generar
            </MagicAiButton>
          ) : (
            <button
              type="submit"
              disabled={submitDisabled}
              className="flex h-12 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-2xl bg-slate-900 px-3 text-sm font-bold text-white shadow-md transition-all hover:bg-slate-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-initial sm:min-w-[200px] sm:gap-2 sm:px-8"
            >
              {saving || aiSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : editingId ? (
                <Check className="w-4 h-4 shrink-0" />
              ) : activeTab === 'bulk' ? (
                <Layers className="w-4 h-4 shrink-0" />
              ) : (
                <Plus className="w-4 h-4 shrink-0" />
              )}
              <span className="truncate sm:hidden">
                {editingId ? 'Guardar' : activeTab === 'bulk' ? 'Crear' : 'Agregar'}
              </span>
              <span className="hidden truncate sm:inline">
                {editingId ? 'Guardar' : activeTab === 'bulk' ? 'Crear Lote' : 'Agregar Tarjeta'}
              </span>
            </button>
          )}
        </div>
      </footer>

      <ActionSheet
        open={showStyles && !isManualModalOpen}
        title="Estilo"
        onClose={() => setShowStyles(false)}
        compact
        footer={(
          <button
            type="button"
            onClick={() => setShowStyles(false)}
            className="min-h-11 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800 active:scale-[0.99] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            Listo
          </button>
        )}
      >
        <div className="space-y-3">
          <LivePreview
            question={activeTab === 'ai' ? '¿Pregunta muestra generada por la IA?' : question}
            answer={activeTab === 'ai' ? 'Esta será la respuesta explicativa de tu tarjeta inteligente.' : answer}
            bgImage={bgImage}
            textAlign={textAlign}
            styles={styles}
            contentImage={contentImage}
            imageSide={imageSide}
            showControls={false}
            previewOnly
          />

          <StylePanel
            ALIGNS={ALIGNS}
            SWATCHES={SWATCHES}
            textAlign={textAlign}
            setTextAlign={setTextAlign}
            bgImage={bgImage}
            setBgImage={setBgImage}
            styles={styles}
            updateStyle={updateStyle}
            handleBgFile={handleBgFile}
            compact
          />
        </div>
      </ActionSheet>

      <ActionSheet
        open={isAiGenerationSheetOpen}
        title="Confirmar generación"
        onClose={() => setIsAiGenerationSheetOpen(false)}
        options={[
          {
            id: 'confirm-ai-generation',
            icon: Sparkles,
            label: 'Confirmar y generar',
            description: aiGenerationDescription,
            disabled: aiSaving || !aiText.trim(),
            onAfterClose: () => {
              void executeAiGeneration();
            },
          },
        ]}
      />

      <ProcessingActionSheet
        open={aiSaving || Boolean(aiProgress)}
        variant="ai"
        status={aiProgress?.status || 'processing'}
        title={aiProgress?.status === 'success' ? 'Tarjetas generadas' : 'Generando tarjetas con IA'}
        message={aiProgress?.message}
        progress={aiProgress}
        summary={aiProgress?.summary}
        autoCloseMs={1800}
        onClose={() => {
          if (!aiSaving) updateAiProgress(null);
        }}
      />

    </form>
  );
}
