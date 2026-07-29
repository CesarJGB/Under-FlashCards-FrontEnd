import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Check,
  Eye,
  EyeOff,
  Layers,
  Loader2,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import FormInputs from "./creator/FormInputs";
import StylePanel from "./creator/StylePanel";
import FloatingPreviewPanel, {
  getStoredPreviewPanelMode,
} from "./creator/FloatingPreviewPanel";
import { parseCardStyles } from "../lib/utils";
import { readAiGenerationProgress } from "../lib/aiProgressStream";
import { getJSON, setJSON } from "../lib/safeLocalStorage";

const ALIGNS = [
  { label: "Izquierda", value: "left", Icon: AlignLeft },
  { label: "Centro", value: "center", Icon: AlignCenter },
  { label: "Derecha", value: "right", Icon: AlignRight },
];

const SWATCHES = [
  { label: "Predeterminado", value: "" },
  { label: "Blanco", value: "#ffffff" },
  { label: "Slate", value: "#94a3b8" },
  { label: "Oro", value: "#f59e0b" },
  { label: "Esmeralda", value: "#10b981" },
  { label: "Coral", value: "#f43f5e" },
  { label: "Azul", value: "#3b82f6" },
];

const MODE_TABS = [
  { id: "single", label: "Manual", Icon: Plus },
  { id: "bulk", label: "Lote", Icon: Layers },
  { id: "ai", label: "IA", Icon: Sparkles },
];

const PREVIEW_VISIBLE_KEY = "ufc_preview_visible_v1";
const AI_GENERATION_ENDPOINT =
  import.meta.env.VITE_AI_GENERATION_MODE === "v1"
    ? "/api/flashcards/generate-ai"
    : "/api/flashcards/generate-ai-v2";

export default function FlashcardCreator({
  question,
  setQuestion,
  answer,
  setAnswer,
  bgImage,
  setBgImage,
  textAlign,
  setTextAlign,
  fontSize,
  setFontSize,
  showStyles,
  setShowStyles,
  isBulk,
  setIsBulk,
  bulkText,
  setBulkText,
  editingId,
  saving,
  error,
  setError,
  onSubmit,
  onCancel,
  contentImage,
  setContentImage,
  imageSide,
  setImageSide,
  onFastDelete,
  hasCards,
  userId,
  deckId,
  authToken,
  onAiSuccess,
  onInviteRequired,
  onFooterHeightChange,
}) {
  const [showPreview, setShowPreview] = useState(() =>
    Boolean(getJSON(PREVIEW_VISIBLE_KEY)),
  );
  const [previewMode, setPreviewMode] = useState(() =>
    getStoredPreviewPanelMode(),
  );
  const [isAi, setIsAi] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiNumCards, setAiNumCards] = useState(5);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiProgress, setAiProgress] = useState(null);
  const footerRef = useRef(null);

  const activeTab = editingId
    ? "single"
    : isAi
      ? "ai"
      : isBulk
        ? "bulk"
        : "single";

  useLayoutEffect(() => {
    const footer = footerRef.current;
    if (!footer || typeof onFooterHeightChange !== "function") return;

    const updateHeight = () => {
      onFooterHeightChange(Math.ceil(footer.getBoundingClientRect().height));
    };

    updateHeight();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateHeight);
      return () => window.removeEventListener("resize", updateHeight);
    }

    const observer = new ResizeObserver(updateHeight);
    observer.observe(footer);
    return () => observer.disconnect();
  }, [onFooterHeightChange]);

  useEffect(() => {
    setJSON(PREVIEW_VISIBLE_KEY, showPreview);
  }, [showPreview]);

  useEffect(() => {
    if (showPreview && previewMode === "docked" && showStyles) {
      setShowStyles(false);
    }
  }, [previewMode, setShowStyles, showPreview, showStyles]);

  const handleTabChange = (tabId) => {
    setError("");
    setShowPreview(false);
    setShowStyles(false);

    if (tabId === "single") {
      setIsBulk(false);
      setIsAi(false);
    } else if (tabId === "bulk") {
      setIsBulk(true);
      setIsAi(false);
    } else if (tabId === "ai") {
      setIsBulk(false);
      setIsAi(true);
    }
  };

  const styles = parseCardStyles(fontSize);
  const previewLocksStandaloneStyles = showPreview && previewMode === "docked";
  const showStandaloneStylePanel =
    showStyles && (!showPreview || previewMode !== "docked");
  const progressTotal = Number(aiProgress?.total || aiProgress?.target) || 0;
  const progressPercent = progressTotal
    ? Math.min(100, ((aiProgress?.generated || 0) / progressTotal) * 100)
    : 0;

  const updateStyle = (key, value) => {
    setFontSize(JSON.stringify({ ...styles, [key]: value }));
  };

  const handleBgFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 700 * 1024) {
      setError("La imagen es muy grande (máx. 700KB).");
      return;
    }

    setError("");
    const reader = new FileReader();
    reader.onload = () => setBgImage(reader.result);
    reader.readAsDataURL(file);
  };

  const handleContentImageFile = async (event, side) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (loadEvent) => {
        const image = new window.Image();
        image.src = loadEvent.target.result;
        image.onload = () => {
          const canvas = document.createElement("canvas");
          const maxWidth = 600;
          let { width, height } = image;

          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d").drawImage(image, 0, 0, width, height);
          setContentImage(canvas.toDataURL("image/jpeg", 0.7));
          setImageSide(side);
        };
      };
    } catch {
      setError("Error al procesar la imagen.");
    }

    event.target.value = "";
  };

  const handleFormSubmit = async (event) => {
    event?.preventDefault?.();

    if (activeTab !== "ai") {
      return onSubmit?.(event);
    }

    if (!aiText.trim() || aiSaving) return false;

    setAiSaving(true);
    setError("");
    setAiProgress({
      generated: 0,
      audited: 0,
      accepted: 0,
      target: Number(aiNumCards) || 0,
      total: Number(aiNumCards) || 0,
      message: "Generando…",
    });

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL;
      const response = await fetch(`${backendUrl}${AI_GENERATION_ENDPOINT}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          userId,
          deckId,
          text: aiText,
          count: aiNumCards,
          batchStyles: { bgImage, textAlign, fontSize },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 403 && errorData.code === "INVITE_REQUIRED") {
          onInviteRequired?.();
          return false;
        }

        if (response.status === 401) {
          throw new Error(
            "Tu sesión expiró. Cierra sesión e inicia sesión de nuevo para generar con IA.",
          );
        }

        throw new Error(
          errorData.message ||
            errorData.error ||
            "El motor de IA experimentó una saturación o no configuraste tu API Key.",
        );
      }

      const result = await readAiGenerationProgress(response, setAiProgress);
      await onAiSuccess?.(result);
      setAiText("");
      setIsAi(false);
      return true;
    } catch (generationError) {
      setError(
        generationError.message ||
          "Error de conexión con el nodo de Inteligencia Artificial.",
      );
      return false;
    } finally {
      setAiProgress(null);
      setAiSaving(false);
    }
  };

  const handleManualCardSave = async () => {
    if (typeof onSubmit !== "function") return false;
    return onSubmit({ preventDefault() {} });
  };

  const submitDisabled =
    saving ||
    aiSaving ||
    (activeTab === "ai"
      ? !aiText.trim()
      : activeTab === "bulk"
        ? !bulkText.trim()
        : !question.trim() || !answer.trim());

  return (
    <form
      onSubmit={handleFormSubmit}
      className="relative -mb-4 flex w-full flex-col bg-[#f7f8fc] text-slate-900"
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-4">
        <div className="rounded-[1.35rem] border border-slate-200 bg-white p-2.5 shadow-[0_14px_38px_-32px_rgba(15,23,42,0.55)] sm:p-3">
          {!editingId && (
            <div
              role="tablist"
              aria-label="Modo de creación"
              className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1"
            >
              {MODE_TABS.map(({ id, label, Icon }) => {
                const isSelected = activeTab === id;

                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => handleTabChange(id)}
                    className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1 ${
                      isSelected
                        ? id === "ai"
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "bg-slate-900 text-white shadow-sm"
                        : "text-slate-500 hover:bg-white/70 hover:text-slate-900"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className={!editingId ? "mt-2.5" : ""}>
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
              removeContentImage={() => {
                setContentImage("");
                setImageSide("");
              }}
              styles={styles}
              updateStyle={updateStyle}
              ALIGNS={ALIGNS}
              SWATCHES={SWATCHES}
              textAlign={textAlign}
              setTextAlign={setTextAlign}
              aiText={aiText}
              setAiText={setAiText}
              aiNumCards={aiNumCards}
              setAiNumCards={setAiNumCards}
              editingId={editingId}
              saving={saving}
              error={error}
              onSaveManualCard={handleManualCardSave}
            />
          </div>
        </div>

        {showPreview && (
          <div className="mt-3">
            <FloatingPreviewPanel
              question={
                activeTab === "ai"
                  ? "¿Pregunta muestra generada por la IA?"
                  : question
              }
              answer={
                activeTab === "ai"
                  ? "Esta será la respuesta explicativa de tu tarjeta inteligente."
                  : answer
              }
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
          </div>
        )}

        {showStandaloneStylePanel && (
          <div className="mt-3">
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
            />
          </div>
        )}

        {aiSaving && aiProgress && (
          <div
            role="status"
            aria-live="polite"
            className="mt-3 rounded-xl border border-indigo-100 bg-white px-3 py-2.5 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <Loader2
                className="h-4 w-4 shrink-0 animate-spin text-indigo-600"
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-700">
                {aiProgress.message}
              </span>
              <span className="shrink-0 text-xs font-black tabular-nums text-indigo-700">
                {aiProgress.accepted || 0}/{aiProgress.target || 0}
              </span>
            </div>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-indigo-100"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={progressTotal || 1}
              aria-valuenow={Math.min(
                aiProgress.generated || 0,
                progressTotal || 1,
              )}
            >
              <div
                className="h-full rounded-full bg-indigo-600 transition-[width] duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-bold leading-relaxed text-rose-700"
          >
            {error}
          </p>
        )}
      </div>

      <footer
        ref={footerRef}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white shadow-[0_-14px_36px_-28px_rgba(15,23,42,0.7)]"
      >
        <div
          className="mx-auto flex w-full max-w-2xl flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:gap-3 sm:px-4"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="grid min-w-0 flex-1 grid-cols-3 gap-1 rounded-2xl bg-slate-50 p-1 sm:flex sm:bg-transparent sm:p-0">
            <button
              type="button"
              onClick={() => {
                const nextShowPreview = !showPreview;
                setShowPreview(nextShowPreview);
                if (nextShowPreview && previewMode === "docked") {
                  setShowStyles(false);
                }
              }}
              aria-label={
                showPreview ? "Ocultar vista previa" : "Mostrar vista previa"
              }
              className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-2 text-[10px] font-extrabold transition-colors sm:min-h-11 sm:flex-1 sm:px-3 sm:text-xs ${
                showPreview
                  ? "bg-indigo-50 text-indigo-600"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {showPreview ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
              <span>Vista</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!previewLocksStandaloneStyles) {
                  setShowStyles(!showStyles);
                }
              }}
              disabled={previewLocksStandaloneStyles}
              aria-label="Mostrar estilos"
              className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-2 text-[10px] font-extrabold transition-colors disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-11 sm:flex-1 sm:px-3 sm:text-xs ${
                showStyles
                  ? "bg-indigo-50 text-indigo-600"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              <span>Estilo</span>
            </button>

            {!editingId ? (
              onFastDelete && hasCards ? (
                <button
                  type="button"
                  disabled={aiSaving}
                  onClick={onFastDelete}
                  className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-2 text-[10px] font-extrabold text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 sm:min-h-11 sm:flex-1 sm:px-3 sm:text-xs"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  <span>Borrar</span>
                </button>
              ) : (
                <span
                  className="hidden sm:block sm:flex-1"
                  aria-hidden="true"
                />
              )
            ) : (
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-2 text-[10px] font-extrabold text-slate-600 transition-colors hover:bg-slate-100 sm:min-h-11 sm:flex-1 sm:px-3 sm:text-xs"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                <span>Cancelar</span>
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={submitDisabled}
            className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 text-sm font-extrabold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[200px] ${
              activeTab === "ai"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 hover:bg-indigo-500"
                : "bg-slate-900 text-white shadow-md shadow-slate-300 hover:bg-slate-800"
            }`}
          >
            {saving || aiSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : editingId ? (
              <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : activeTab === "ai" ? (
              <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span className="truncate">
              {editingId
                ? "Guardar"
                : activeTab === "ai"
                  ? "Generar IA"
                  : activeTab === "bulk"
                    ? "Crear lote"
                    : "Agregar tarjeta"}
            </span>
          </button>
        </div>
      </footer>
    </form>
  );
}
