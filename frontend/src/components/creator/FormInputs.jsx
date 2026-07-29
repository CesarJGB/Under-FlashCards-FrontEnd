import {
  lazy,
  Suspense,
  startTransition,
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  BookOpen,
  CheckCircle2,
  FileText,
  Info,
  Layers,
  ListChecks,
  Sparkles,
} from "lucide-react";
import ManualCardEditorModal from "./ManualCardEditorModal";

const PdfExtractor = lazy(() => import("./PdfExtractor"));
const MAX_AI_DOCUMENT_TEXT_LENGTH = 600000;
const configuredMaxAiCards = Number.parseInt(
  import.meta.env.VITE_MAX_AI_CARDS,
  10,
);
const MAX_AI_CARDS =
  Number.isInteger(configuredMaxAiCards) && configuredMaxAiCards > 0
    ? configuredMaxAiCards
    : 500;

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
}) {
  const [customCardCount, setCustomCardCount] = useState("");
  const [manualEditorSide, setManualEditorSide] = useState(null);
  const closeManualEditor = useCallback(() => setManualEditorSide(null), []);

  const bulkStats = useMemo(() => {
    const lines = bulkText.split(/\r?\n/);
    let questions = 0;
    let answers = 0;
    let completePairs = 0;
    let pendingQuestion = false;

    lines.forEach((line) => {
      const cleanLine = line.trim();
      if (/^[pP]\s*:/i.test(cleanLine)) {
        if (cleanLine.replace(/^[pP]\s*:/i, "").trim()) {
          questions += 1;
          pendingQuestion = true;
        }
      } else if (/^[rR]\s*:/i.test(cleanLine)) {
        if (cleanLine.replace(/^[rR]\s*:/i, "").trim()) {
          answers += 1;
          if (pendingQuestion) {
            completePairs += 1;
            pendingQuestion = false;
          }
        }
      }
    });

    return {
      questions,
      answers,
      completePairs,
      lines: bulkText ? lines.length : 0,
    };
  }, [bulkText]);

  // 1. MODO IA: fuente de estudio + configuración de generación.
  if (isAi) {
    return (
      <div className="flex animate-[fadeIn_0.2s_ease] flex-col gap-4">
        <section className="overflow-hidden rounded-[1.35rem] border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-4 shadow-[0_16px_40px_-32px_rgba(79,70,229,0.65)] sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm shadow-indigo-200">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-extrabold text-slate-900">
                  Generación inteligente
                </h2>
                <span className="rounded-full border border-indigo-200 bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-600">
                  Modo IA
                </span>
              </div>
              <p className="mt-1 max-w-xl text-xs font-medium leading-relaxed text-slate-500">
                Convierte tus apuntes en tarjetas claras y listas para estudiar.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-indigo-100/80 pt-3">
            {[
              { number: "01", label: "Fuente" },
              { number: "02", label: "Cantidad" },
              { number: "03", label: "Generar" },
            ].map((step) => (
              <div
                key={step.number}
                className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500"
              >
                <span className="font-mono text-indigo-500">{step.number}</span>
                <span className="truncate">{step.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[1.35rem] border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <BookOpen className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-slate-800">
                  Fuente de estudio
                </p>
                <p className="mt-0.5 text-[11px] font-medium leading-relaxed text-slate-400">
                  Pega tus apuntes o importa un PDF para extraer su contenido.
                </p>
              </div>
            </div>
            <span
              className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold ${
                aiText.trim()
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-slate-50 text-slate-400"
              }`}
            >
              {aiText.trim() ? "Contenido listo" : "Sin contenido"}
            </span>
          </div>

          <div className="mt-3">
            <Suspense
              fallback={
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs font-semibold text-slate-500 animate-[fadeIn_0.15s_ease]">
                  <FileText
                    className="h-4 w-4 shrink-0 text-indigo-500"
                    aria-hidden="true"
                  />
                  <span>Preparando el módulo PDF…</span>
                </div>
              }
            >
              <PdfExtractor
                onTextExtracted={(extractedText) => {
                  startTransition(() => {
                    setAiText((previousText) =>
                      previousText
                        ? `${previousText}\n${extractedText}`
                        : extractedText,
                    );
                  });
                }}
              />
            </Suspense>
          </div>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <label
                htmlFor="ai-source-text"
                className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-slate-700"
              >
                <FileText
                  className="h-3.5 w-3.5 shrink-0 text-slate-400"
                  aria-hidden="true"
                />
                <span className="truncate">Apuntes e indicaciones</span>
              </label>
              <span className="shrink-0 text-[10px] font-bold tabular-nums text-slate-400">
                {aiText.length.toLocaleString("es-MX")} /{" "}
                {MAX_AI_DOCUMENT_TEXT_LENGTH.toLocaleString("es-MX")}
              </span>
            </div>
            <textarea
              id="ai-source-text"
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              maxLength={MAX_AI_DOCUMENT_TEXT_LENGTH}
              placeholder="Pega aquí la información que quieres convertir en tarjetas…"
              className="min-h-[190px] w-full resize-y rounded-2xl border border-slate-200 bg-slate-50/40 px-3.5 py-3 text-xs font-medium leading-relaxed text-slate-800 outline-none transition-colors placeholder:text-slate-300 focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-500/[0.08] sm:min-h-[210px]"
            />
          </div>
        </section>

        <section className="rounded-[1.35rem] border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4">
          <div className="flex items-start gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <Layers className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-extrabold text-slate-800">
                Cantidad de tarjetas
              </p>
              <p className="mt-0.5 text-[11px] font-medium leading-relaxed text-slate-400">
                Elige una cantidad aproximada para este contenido.
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {[5, 10, 15].map((num) => {
              const isSelected = customCardCount === "" && aiNumCards === num;
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => {
                    setCustomCardCount("");
                    setAiNumCards(num);
                  }}
                  className={`min-h-11 rounded-xl border px-2 text-xs font-extrabold transition-all ${
                    isSelected
                      ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {num} tarjetas
                </button>
              );
            })}
          </div>

          <label
            className={`mt-2.5 flex min-h-11 items-center justify-between gap-3 rounded-xl border px-3 transition-colors ${
              customCardCount !== ""
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-slate-50/60 text-slate-600 focus-within:border-slate-400 focus-within:bg-white"
            }`}
          >
            <span className="flex min-w-0 items-center gap-2 text-xs font-bold">
              <ListChecks
                className="h-4 w-4 shrink-0 opacity-70"
                aria-hidden="true"
              />
              <span className="truncate">Cantidad personalizada</span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              <input
                type="number"
                min="1"
                max={MAX_AI_CARDS}
                placeholder="Ej. 8"
                value={customCardCount}
                onChange={(e) => {
                  const rawVal = e.target.value;
                  if (rawVal === "") {
                    setCustomCardCount("");
                    setAiNumCards("");
                  } else {
                    const parsed = parseInt(rawVal, 10);
                    const nextValue = Number.isNaN(parsed)
                      ? ""
                      : Math.min(MAX_AI_CARDS, Math.max(1, parsed));
                    setCustomCardCount(
                      nextValue === "" ? "" : String(nextValue),
                    );
                    setAiNumCards(nextValue);
                  }
                }}
                className={`w-16 rounded-lg border px-2 py-1.5 text-center text-xs font-extrabold outline-none ${
                  customCardCount !== ""
                    ? "border-white/20 bg-white/10 text-white placeholder:text-slate-400"
                    : "border-slate-200 bg-white text-slate-700 placeholder:text-slate-300"
                }`}
                aria-label="Cantidad personalizada de tarjetas"
              />
              <span className="text-[10px] font-bold opacity-60">
                máx. {MAX_AI_CARDS}
              </span>
            </span>
          </label>
        </section>

        <div className="flex items-start gap-2.5 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-3.5 py-3 text-[11px] font-medium leading-relaxed text-indigo-700">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            La IA puede tardar un poco si el documento es extenso. Podrás seguir
            el avance en el indicador de generación.
          </p>
        </div>
      </div>
    );
  }

  // 2. MODO EN LOTE: captura estructurada con guía y lectura del formato.
  if (isBulk) {
    return (
      <div className="flex animate-[fadeIn_0.2s_ease] flex-col gap-4">
        <section className="overflow-hidden rounded-[1.35rem] border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100/70 p-4 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.55)] sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
              <Layers className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-extrabold text-slate-900">
                  Creación en lote
                </h2>
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  Formato P: / R:
                </span>
              </div>
              <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">
                Escribe varias preguntas y respuestas para guardarlas en una
                sola acción.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-200/80 pt-3">
            <div className="rounded-xl border border-slate-200 bg-white px-2.5 py-2">
              <p className="text-lg font-black tabular-nums text-slate-900">
                {bulkStats.completePairs}
              </p>
              <p className="text-[10px] font-bold text-slate-400">
                pares listos
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-2.5 py-2">
              <p className="text-lg font-black tabular-nums text-slate-700">
                {bulkStats.questions}
              </p>
              <p className="text-[10px] font-bold text-slate-400">preguntas</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-2.5 py-2">
              <p className="text-lg font-black tabular-nums text-slate-700">
                {bulkStats.answers}
              </p>
              <p className="text-[10px] font-bold text-slate-400">respuestas</p>
            </div>
          </div>
        </section>

        <section className="rounded-[1.35rem] border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4">
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <label
              htmlFor="bulk-card-text"
              className="flex min-w-0 items-center gap-1.5 text-xs font-extrabold text-slate-700"
            >
              <FileText
                className="h-3.5 w-3.5 shrink-0 text-slate-400"
                aria-hidden="true"
              />
              <span className="truncate">Contenido del lote</span>
            </label>
            <span className="shrink-0 text-[10px] font-bold tabular-nums text-slate-400">
              {bulkText.length.toLocaleString("es-MX")} caracteres
            </span>
          </div>
          <textarea
            id="bulk-card-text"
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={
              "P: ¿Qué día fue teóricamente ayer?\nR: 20 de junio\n\nP: ¿Cuál es el número atómico del hidrógeno?\nR: 1"
            }
            className="min-h-[230px] w-full resize-y rounded-2xl border border-slate-200 bg-slate-50/40 px-3.5 py-3 font-mono text-xs leading-relaxed text-slate-800 outline-none transition-colors placeholder:text-slate-300 focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-900/[0.06] sm:min-h-[260px]"
          />
          <div className="mt-2 flex items-center justify-between gap-3 text-[10px] font-semibold text-slate-400">
            <span>{bulkStats.lines || 0} líneas</span>
            <span
              className={
                bulkStats.completePairs > 0
                  ? "text-emerald-600"
                  : "text-slate-400"
              }
            >
              {bulkStats.completePairs > 0
                ? "Formato reconocido"
                : "Aún no hay pares completos"}
            </span>
          </div>
        </section>

        <section className="rounded-[1.35rem] border border-slate-200 bg-slate-50/70 p-3.5 sm:p-4">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-slate-500" aria-hidden="true" />
            <p className="text-xs font-extrabold text-slate-800">
              Formato esperado
            </p>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Pregunta
              </p>
              <code className="mt-1 block text-xs font-bold text-slate-700">
                P: Escribe la pregunta
              </code>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Respuesta
              </p>
              <code className="mt-1 block text-xs font-bold text-slate-700">
                R: Escribe la respuesta
              </code>
            </div>
          </div>
          <div className="mt-3 flex items-start gap-2 text-[11px] font-medium leading-relaxed text-slate-500">
            <CheckCircle2
              className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
              aria-hidden="true"
            />
            <p>
              Deja una línea en blanco entre tarjetas. El sistema detectará cada
              par que contenga una línea{" "}
              <strong className="font-extrabold text-slate-700">P:</strong> y
              otra <strong className="font-extrabold text-slate-700">R:</strong>
              .
            </p>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[10px] font-medium leading-relaxed text-slate-500">
            <Info
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400"
              aria-hidden="true"
            />
            <p>
              Las líneas que no comiencen con esos prefijos no se interpretan
              como una tarjeta.
            </p>
          </div>
        </section>
      </div>
    );
  }

  const renderEditorTrigger = ({ side, label, value, placeholder }) => {
    const hasImage = Boolean(contentImage && imageSide === side);

    return (
      <button
        type="button"
        onPointerDown={(event) => {
          // Abrimos en el primer contacto y evitamos que el botón original
          // recupere el foco después de que el modal enfoque el textarea.
          event.preventDefault();
          setManualEditorSide(side);
        }}
        onClick={() => setManualEditorSide(side)}
        className="relative flex min-h-[108px] w-full flex-col rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition-colors active:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        aria-label={`Editar ${label.toLowerCase()}`}
        data-testid={`manual-${side}-editor-trigger`}
      >
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span
          className={`mt-1.5 max-h-[66px] overflow-hidden whitespace-pre-wrap break-words pr-9 text-sm font-medium leading-relaxed ${
            value ? "text-slate-800" : "text-slate-300"
          }`}
        >
          {value || placeholder}
        </span>
        {hasImage && (
          <span className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
            <img
              src={contentImage}
              alt={`Imagen de ${label.toLowerCase()}`}
              className="h-full w-full object-cover"
            />
          </span>
        )}
      </button>
    );
  };

  // 3. MODO INDIVIDUAL: mantiene la vista compacta y delega la captura al editor de pantalla completa.
  return (
    <>
      <div className="grid gap-4 animate-[fadeIn_0.2s_ease] sm:grid-cols-2">
        {renderEditorTrigger({
          side: "question",
          label: "Pregunta",
          value: question,
          placeholder: "¿Cuál es la capital de Francia?",
        })}

        {renderEditorTrigger({
          side: "answer",
          label: "Respuesta",
          value: answer,
          placeholder: "París",
        })}
      </div>

      <ManualCardEditorModal
        open={Boolean(manualEditorSide)}
        initialSide={manualEditorSide || "question"}
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
