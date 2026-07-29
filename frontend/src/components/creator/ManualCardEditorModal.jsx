import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Bold,
  Check,
  ImagePlus,
  Loader2,
  PenLine,
  Plus,
  Type,
  X,
} from 'lucide-react';

const getSideCopy = (side) => (
  side === 'answer'
    ? { label: 'Respuesta', placeholder: 'Escribe la respuesta…' }
    : { label: 'Pregunta', placeholder: 'Escribe la pregunta…' }
);

export default function ManualCardEditorModal({
  open,
  initialSide = 'question',
  question,
  setQuestion,
  answer,
  setAnswer,
  contentImage,
  imageSide,
  handleContentImageFile,
  removeContentImage,
  onSaveCard,
  onClose,
  saving = false,
  error = '',
  isEditing = false,
}) {
  const [activeSide, setActiveSide] = useState('question');
  const [viewportFrame, setViewportFrame] = useState(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setActiveSide(initialSide === 'answer' ? 'answer' : 'question');
  }, [open, initialSide]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;

    const previousOverflow = document.body.style.overflow;
    const previousOverscrollBehavior = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscrollBehavior;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  // iOS no siempre reduce el layout viewport al abrir el teclado. Usamos el
  // viewport visual para que la barra de acciones quede anclada justo arriba.
  useLayoutEffect(() => {
    if (!open || typeof window === 'undefined') return undefined;

    const visualViewport = window.visualViewport;
    const updateViewportFrame = () => {
      const height = Math.round(visualViewport?.height || window.innerHeight);
      const offsetTop = Math.round(visualViewport?.offsetTop || 0);
      const keyboardOpen = height < window.innerHeight - 120;

      setViewportFrame((previousFrame) => {
        if (
          previousFrame?.height === height
          && previousFrame.offsetTop === offsetTop
          && previousFrame.keyboardOpen === keyboardOpen
        ) {
          return previousFrame;
        }

        return { height, offsetTop, keyboardOpen };
      });
    };

    updateViewportFrame();
    visualViewport?.addEventListener('resize', updateViewportFrame);
    visualViewport?.addEventListener('scroll', updateViewportFrame);
    window.addEventListener('resize', updateViewportFrame);

    return () => {
      visualViewport?.removeEventListener('resize', updateViewportFrame);
      visualViewport?.removeEventListener('scroll', updateViewportFrame);
      window.removeEventListener('resize', updateViewportFrame);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const frame = window.requestAnimationFrame(() => {
      try {
        textareaRef.current?.focus({ preventScroll: true });
      } catch {
        textareaRef.current?.focus();
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeSide, open]);

  if (!open) return null;

  const activeCopy = getSideCopy(activeSide);
  const activeValue = activeSide === 'answer' ? answer : question;
  const hasActiveImage = Boolean(contentImage && imageSide === activeSide);
  const canSave = Boolean(question.trim() && answer.trim() && !saving);
  const reverseSide = activeSide === 'question' ? 'answer' : 'question';
  const reverseCopy = getSideCopy(reverseSide);
  const modalViewportStyle = viewportFrame
    ? { height: `${viewportFrame.height}px`, top: `${viewportFrame.offsetTop}px` }
    : undefined;
  const footerSafeAreaStyle = {
    paddingBottom: viewportFrame?.keyboardOpen ? '0px' : 'env(safe-area-inset-bottom)',
  };

  const updateActiveValue = (value) => {
    if (activeSide === 'answer') setAnswer(value);
    else setQuestion(value);
  };

  const saveCard = async (keepEditing) => {
    if (!canSave) return;

    const wasSaved = await onSaveCard?.();
    if (wasSaved === false) return;

    if (keepEditing) {
      setActiveSide('question');
      return;
    }

    onClose?.();
  };

  return (
    <div
      className="fixed inset-x-0 top-0 z-[70] flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#f7f8fc] pt-[env(safe-area-inset-top)] text-slate-900"
      style={modalViewportStyle}
      role="dialog"
      aria-modal="true"
      aria-label={`Editar ${activeCopy.label.toLowerCase()} de la tarjeta`}
      data-keyboard-open={viewportFrame?.keyboardOpen ? 'true' : 'false'}
      data-testid="manual-card-editor-modal"
    >
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 py-3 sm:px-6 sm:py-5">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
          <div className="h-[clamp(11rem,28dvh,15rem)] shrink-0 overflow-hidden rounded-[1.5rem] border-2 border-slate-500/80 bg-white shadow-[0_18px_45px_-36px_rgba(15,23,42,0.55)] focus-within:border-slate-700 focus-within:ring-4 focus-within:ring-slate-900/[0.06]">
            <textarea
              ref={textareaRef}
              value={activeValue}
              onChange={(event) => updateActiveValue(event.target.value)}
              placeholder={activeCopy.placeholder}
              aria-label={activeCopy.label}
              className="h-full min-h-0 w-full resize-none bg-transparent px-4 py-4 text-base font-medium leading-7 text-slate-800 outline-none placeholder:text-slate-300 sm:px-5 sm:py-5 sm:text-lg sm:leading-8"
              data-testid={`manual-card-editor-${activeSide}`}
            />
          </div>

          {error && (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              {error}
            </p>
          )}
        </div>
      </main>

      <footer
        className="shrink-0 border-t border-slate-200/80 bg-white/95 shadow-[0_-12px_35px_-28px_rgba(15,23,42,0.65)] backdrop-blur-xl"
        style={footerSafeAreaStyle}
      >
        <div className="mx-auto flex w-full max-w-2xl gap-2 border-b border-slate-100 px-3 py-2 sm:px-4">
          <button
            type="button"
            onClick={() => setActiveSide(reverseSide)}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition-colors active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 sm:text-sm"
            data-testid="manual-card-editor-switch-side"
          >
            {reverseSide === 'answer' ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
            <span className="truncate">Editar {reverseCopy.label.toLowerCase()}</span>
          </button>

          <button
            type="button"
            onClick={() => saveCard(true)}
            disabled={!canSave}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition-colors active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 sm:text-sm"
            data-testid="manual-card-editor-add-another"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="truncate">{isEditing ? 'Guardar y crear otra' : 'Añadir tarjeta'}</span>
          </button>
        </div>

        <div className="mx-auto flex min-h-16 w-full max-w-2xl items-center px-3 sm:px-4">
          <div className="flex min-w-0 flex-1 items-center">
            <div className="flex h-12 w-14 shrink-0 items-center justify-center">
              {hasActiveImage ? (
                <div className="flex h-10 items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                  <label
                    className="flex h-8 w-8 cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-slate-50 focus-within:outline-none focus-within:ring-2 focus-within:ring-slate-300"
                    title={`Cambiar imagen de ${activeCopy.label.toLowerCase()}`}
                    data-testid="manual-card-editor-image-control"
                  >
                    <img
                      src={contentImage}
                      alt={`Imagen de ${activeCopy.label.toLowerCase()}`}
                      className="h-full w-full object-cover"
                    />
                    <span className="sr-only">Cambiar imagen de {activeCopy.label.toLowerCase()}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => handleContentImageFile(event, activeSide)}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={removeContentImage}
                    aria-label="Eliminar imagen adjunta"
                    data-testid="manual-card-editor-remove-image"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors active:bg-rose-50 active:text-rose-600 [@media(hover:hover)]:hover:bg-rose-50 [@media(hover:hover)]:hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label
                  className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors active:bg-slate-100 focus-within:outline-none focus-within:ring-2 focus-within:ring-slate-300"
                  title={`Añadir imagen a ${activeCopy.label.toLowerCase()}`}
                  data-testid="manual-card-editor-image-control"
                >
                  <ImagePlus className="h-5 w-5" />
                  <span className="sr-only">Añadir imagen a {activeCopy.label.toLowerCase()}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => handleContentImageFile(event, activeSide)}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            <span className="mx-1 h-10 w-px shrink-0 bg-slate-200" aria-hidden="true" />

            <div className="flex min-w-0 flex-1 items-center justify-evenly">
              <button
                type="button"
                disabled
                title="Formato de texto próximamente"
                aria-label="Formato de texto próximamente"
                className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 opacity-45"
                data-testid="manual-card-editor-format"
              >
                <Type className="h-5 w-5" />
              </button>
              <button
                type="button"
                disabled
                title="Dibujo próximamente"
                aria-label="Dibujo próximamente"
                className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 opacity-45"
                data-testid="manual-card-editor-draw"
              >
                <PenLine className="h-5 w-5" />
              </button>
              <button
                type="button"
                disabled
                title="Negritas próximamente"
                aria-label="Negritas próximamente"
                className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 opacity-45"
                data-testid="manual-card-editor-bold"
              >
                <Bold className="h-5 w-5" />
              </button>
            </div>

            <span className="mx-1 h-10 w-px shrink-0 bg-slate-200" aria-hidden="true" />

            <button
              type="button"
              onClick={() => saveCard(false)}
              disabled={!canSave}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm transition-colors active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
              data-testid="manual-card-editor-done"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              <span>Listo</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
