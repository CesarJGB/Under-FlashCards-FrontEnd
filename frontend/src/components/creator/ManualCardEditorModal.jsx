import { createPortal } from 'react-dom';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Bold,
  Check,
  ImagePlus,
  Italic,
  Loader2,
  Palette,
  Plus,
  X,
} from 'lucide-react';

const DEFAULT_ALIGNS = [
  { label: 'Izquierda', value: 'left', Icon: AlignLeft },
  { label: 'Centro', value: 'center', Icon: AlignCenter },
  { label: 'Derecha', value: 'right', Icon: AlignRight },
];

const DEFAULT_SWATCHES = [
  { label: 'Predeterminado', value: '' },
  { label: 'Blanco', value: '#ffffff' },
  { label: 'Slate', value: '#94a3b8' },
  { label: 'Oro', value: '#f59e0b' },
  { label: 'Esmeralda', value: '#10b981' },
  { label: 'Coral', value: '#f43f5e' },
  { label: 'Azul', value: '#3b82f6' },
];

const getSideCopy = (side) => (
  side === 'answer'
    ? { label: 'Respuesta', placeholder: 'Escribe la respuesta…' }
    : { label: 'Pregunta', placeholder: 'Escribe la pregunta…' }
);

const normalizeSide = (side) => (side === 'answer' ? 'answer' : 'question');

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
  styles = {},
  updateStyle,
  ALIGNS = DEFAULT_ALIGNS,
  SWATCHES = DEFAULT_SWATCHES,
  textAlign = 'center',
  setTextAlign,
}) {
  const [activeSide, setActiveSide] = useState(() => normalizeSide(initialSide));
  const [viewportFrame, setViewportFrame] = useState(null);
  const [colorOpen, setColorOpen] = useState(false);
  const [alignmentOpen, setAlignmentOpen] = useState(false);
  const textareaRef = useRef(null);
  const imageInputRef = useRef(null);
  const imagePickerActiveRef = useRef(false);
  const sideSwitchKeepFocusRef = useRef(false);
  const focusTimerRef = useRef(null);

  const focusTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    try {
      textarea.focus({ preventScroll: true });
    } catch {
      textarea.focus();
    }
  }, []);

  const scheduleTextareaFocus = useCallback((delay = 0) => {
    if (typeof window === 'undefined') return;

    if (focusTimerRef.current) window.clearTimeout(focusTimerRef.current);
    focusTimerRef.current = window.setTimeout(() => {
      focusTimerRef.current = null;
      focusTextarea();
    }, delay);
  }, [focusTextarea]);

  const restoreAfterImagePicker = useCallback((delay = 80) => {
    if (!imagePickerActiveRef.current || typeof window === 'undefined') return;

    imagePickerActiveRef.current = false;
    scheduleTextareaFocus(delay);
  }, [scheduleTextareaFocus]);

  useLayoutEffect(() => {
    if (!open) return;

    const nextSide = normalizeSide(initialSide);
    setActiveSide((previousSide) => (
      previousSide === nextSide ? previousSide : nextSide
    ));
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

  // Fotos/Archivos puede cerrar el teclado mientras la hoja nativa está abierta.
  useEffect(() => {
    if (!open || typeof window === 'undefined') return undefined;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') restoreAfterImagePicker();
    };

    const handleWindowFocus = () => restoreAfterImagePicker();

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      imagePickerActiveRef.current = false;
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [open, restoreAfterImagePicker]);

  // El portal y esta capa cubren el viewport completo. El panel interno sigue
  // al viewport visual para que el footer quede exactamente sobre el teclado.
  useLayoutEffect(() => {
    if (!open || typeof window === 'undefined') return undefined;

    const visualViewport = window.visualViewport;
    const initialLayoutHeight = Math.max(
      window.innerHeight,
      document.documentElement?.clientHeight || 0,
    );

    const updateViewportFrame = () => {
      const layoutHeight = Math.max(
        initialLayoutHeight,
        window.innerHeight,
        document.documentElement?.clientHeight || 0,
      );
      const height = Math.max(1, Math.round(visualViewport?.height || layoutHeight));
      const offsetTop = Math.max(0, Math.round(visualViewport?.offsetTop || 0));
      const keyboardOpen = height < layoutHeight - 100;

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

  // Solo se enfoca al abrir. El cambio de lado conserva el textarea existente
  // y no fuerza un segundo ciclo de teclado si el foco ya se mantuvo.
  useLayoutEffect(() => {
    if (!open || typeof window === 'undefined') return undefined;

    focusTextarea();
    const frame = window.requestAnimationFrame(() => {
      if (document.activeElement !== textareaRef.current) focusTextarea();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [focusTextarea, open]);

  useEffect(() => () => {
    if (focusTimerRef.current && typeof window !== 'undefined') {
      window.clearTimeout(focusTimerRef.current);
    }
  }, []);

  useEffect(() => {
    setColorOpen(false);
    setAlignmentOpen(false);
  }, [activeSide]);

  if (!open || typeof document === 'undefined') return null;

  const activeCopy = getSideCopy(activeSide);
  const activeValue = activeSide === 'answer' ? answer : question;
  const hasActiveImage = Boolean(contentImage && imageSide === activeSide);
  const canSave = Boolean(question.trim() && answer.trim() && !saving);
  const reverseSide = activeSide === 'question' ? 'answer' : 'question';
  const reverseCopy = getSideCopy(reverseSide);
  const activePrefix = activeSide === 'question' ? 'q' : 'a';
  const boldKey = `${activePrefix}Bold`;
  const italicKey = `${activePrefix}Italic`;
  const colorKey = `${activePrefix}Color`;
  const activeStyles = styles || {};
  const alignOptions = Array.isArray(ALIGNS) && ALIGNS.length ? ALIGNS : DEFAULT_ALIGNS;
  const colorOptions = Array.isArray(SWATCHES) && SWATCHES.length ? SWATCHES : DEFAULT_SWATCHES;
  const modalViewportStyle = viewportFrame
    ? { height: `${viewportFrame.height}px`, top: `${viewportFrame.offsetTop}px` }
    : { height: '100dvh', top: 0 };
  const footerSafeAreaStyle = {
    paddingBottom: viewportFrame?.keyboardOpen ? '0px' : 'env(safe-area-inset-bottom)',
  };

  const updateActiveValue = (value) => {
    if (activeSide === 'answer') setAnswer(value);
    else setQuestion(value);
  };

  const updateActiveStyle = (key, value) => {
    if (typeof updateStyle === 'function') updateStyle(key, value);
  };

  const preventToolbarFocus = (event) => {
    event.preventDefault();
  };

  const rememberSideSwitchFocus = (event) => {
    event.preventDefault();
    sideSwitchKeepFocusRef.current = Boolean(
      document.activeElement === textareaRef.current || viewportFrame?.keyboardOpen,
    );
  };

  const switchSide = () => {
    const keepFocus = sideSwitchKeepFocusRef.current;
    sideSwitchKeepFocusRef.current = false;
    setActiveSide((previousSide) => (
      previousSide === 'question' ? 'answer' : 'question'
    ));

    if (keepFocus) scheduleTextareaFocus();
  };

  const toggleStyle = (key) => {
    updateActiveStyle(key, !Boolean(activeStyles[key]));
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

  const finishEditor = async () => {
    if (saving) return;

    if (!question.trim() || !answer.trim()) {
      onClose?.();
      return;
    }

    await saveCard(false);
  };

  const handleImagePickerPress = (event) => {
    event.preventDefault();
    imagePickerActiveRef.current = true;
  };

  const openImagePicker = () => {
    imagePickerActiveRef.current = true;
    imageInputRef.current?.click();
  };

  const handleImageInputChange = (event) => {
    handleContentImageFile?.(event, activeSide);
    restoreAfterImagePicker(140);
  };

  const modal = (
    <div
      className="fixed inset-0 z-[70] isolate overflow-hidden bg-white text-slate-900"
      role="dialog"
      aria-modal="true"
      aria-label={`Editar ${activeCopy.label.toLowerCase()} de la tarjeta`}
      data-keyboard-open={viewportFrame?.keyboardOpen ? 'true' : 'false'}
      data-testid="manual-card-editor-modal"
    >
      <div
        className="fixed inset-x-0 z-[71] flex min-h-0 flex-col overflow-hidden bg-white pt-[env(safe-area-inset-top)]"
        style={modalViewportStyle}
      >
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-[#f7f8fc] px-4 py-3 sm:px-6 sm:py-5">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
            <div className="h-[clamp(9rem,24dvh,12rem)] shrink-0 overflow-hidden rounded-[1.5rem] border-2 border-slate-500/80 bg-white shadow-[0_18px_45px_-36px_rgba(15,23,42,0.55)] focus-within:border-slate-700 focus-within:ring-4 focus-within:ring-slate-900/[0.06]">
              <textarea
                ref={textareaRef}
                value={activeValue}
                onChange={(event) => updateActiveValue(event.target.value)}
                placeholder={activeCopy.placeholder}
                aria-label={activeCopy.label}
                autoFocus
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
          className="relative z-10 shrink-0 border-t border-slate-200/80 bg-white shadow-[0_-12px_35px_-28px_rgba(15,23,42,0.65)]"
          style={footerSafeAreaStyle}
        >
          <div className="mx-auto flex w-full max-w-2xl gap-2 border-b border-slate-100 px-3 py-2 sm:px-4">
            <button
              type="button"
              onPointerDown={rememberSideSwitchFocus}
              onMouseDown={rememberSideSwitchFocus}
              onClick={switchSide}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition-colors active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 sm:text-sm"
              data-testid="manual-card-editor-switch-side"
            >
              {reverseSide === 'answer' ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
              <span className="truncate">Editar {reverseCopy.label.toLowerCase()}</span>
            </button>

            <button
              type="button"
              onPointerDown={preventToolbarFocus}
              onMouseDown={preventToolbarFocus}
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
                    <button
                      type="button"
                      onPointerDown={handleImagePickerPress}
                      onMouseDown={handleImagePickerPress}
                      onClick={openImagePicker}
                      className="flex h-8 w-8 cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                      title={`Cambiar imagen de ${activeCopy.label.toLowerCase()}`}
                      aria-label={`Cambiar imagen de ${activeCopy.label.toLowerCase()}`}
                      data-testid="manual-card-editor-image-control"
                    >
                      <img
                        src={contentImage}
                        alt={`Imagen de ${activeCopy.label.toLowerCase()}`}
                        className="h-full w-full object-cover"
                      />
                    </button>
                    <button
                      type="button"
                      onPointerDown={preventToolbarFocus}
                      onMouseDown={preventToolbarFocus}
                      onClick={removeContentImage}
                      aria-label="Eliminar imagen adjunta"
                      data-testid="manual-card-editor-remove-image"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors active:bg-rose-50 active:text-rose-600 [@media(hover:hover)]:hover:bg-rose-50 [@media(hover:hover)]:hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageInputChange}
                      onCancel={() => restoreAfterImagePicker()}
                      className="hidden"
                    />
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onPointerDown={handleImagePickerPress}
                      onMouseDown={handleImagePickerPress}
                      onClick={openImagePicker}
                      className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                      title={`Añadir imagen a ${activeCopy.label.toLowerCase()}`}
                      aria-label={`Añadir imagen a ${activeCopy.label.toLowerCase()}`}
                      data-testid="manual-card-editor-image-control"
                    >
                      <ImagePlus className="h-5 w-5" />
                    </button>
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageInputChange}
                      onCancel={() => restoreAfterImagePicker()}
                      className="hidden"
                    />
                  </>
                )}
              </div>

              <span className="mx-1 h-10 w-px shrink-0 bg-slate-200" aria-hidden="true" />

              <div className="flex min-w-0 flex-1 items-center justify-center gap-1 px-2 sm:gap-1.5 sm:px-3">
                <button
                  type="button"
                  onPointerDown={preventToolbarFocus}
                  onMouseDown={preventToolbarFocus}
                  onClick={() => toggleStyle(boldKey)}
                  aria-label="Negritas"
                  aria-pressed={Boolean(activeStyles[boldKey])}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${activeStyles[boldKey] ? 'bg-slate-900 text-white' : 'text-slate-600 active:bg-slate-100 [@media(hover:hover)]:hover:bg-slate-100'}`}
                  data-testid="manual-card-editor-bold"
                >
                  <Bold className="h-5 w-5" />
                </button>

                <button
                  type="button"
                  onPointerDown={preventToolbarFocus}
                  onMouseDown={preventToolbarFocus}
                  onClick={() => toggleStyle(italicKey)}
                  aria-label="Cursiva"
                  aria-pressed={Boolean(activeStyles[italicKey])}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${activeStyles[italicKey] ? 'bg-slate-900 text-white' : 'text-slate-600 active:bg-slate-100 [@media(hover:hover)]:hover:bg-slate-100'}`}
                  data-testid="manual-card-editor-italic"
                >
                  <Italic className="h-5 w-5" />
                </button>

                <div className="relative shrink-0">
                  <button
                    type="button"
                    onPointerDown={preventToolbarFocus}
                    onMouseDown={preventToolbarFocus}
                    onClick={() => { setColorOpen((previous) => !previous); setAlignmentOpen(false); }}
                    aria-label="Color del texto"
                    aria-expanded={colorOpen}
                    className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${activeStyles[colorKey] ? 'text-white shadow-sm' : 'text-slate-600 active:bg-slate-100 [@media(hover:hover)]:hover:bg-slate-100'}`}
                    style={activeStyles[colorKey] ? { backgroundColor: activeStyles[colorKey] } : undefined}
                    data-testid="manual-card-editor-color"
                  >
                    <Palette className="h-5 w-5" />
                  </button>

                  {colorOpen && (
                    <>
                      <div className="fixed inset-0 z-[1]" onPointerDown={() => setColorOpen(false)} />
                      <div className="absolute bottom-full left-1/2 z-[2] mb-2 grid w-[168px] -translate-x-1/2 grid-cols-4 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                        {colorOptions.map((color) => (
                          <button
                            key={color.value}
                            type="button"
                            title={color.label}
                            onPointerDown={preventToolbarFocus}
                            onMouseDown={preventToolbarFocus}
                            onClick={() => { updateActiveStyle(colorKey, color.value); setColorOpen(false); }}
                            style={color.value ? { backgroundColor: color.value } : undefined}
                            className={`relative h-8 w-8 rounded-xl border transition-all ${activeStyles[colorKey] === color.value ? 'scale-110 border-transparent ring-2 ring-slate-900 ring-offset-1' : 'border-slate-200 [@media(hover:hover)]:hover:scale-105'} ${!color.value ? 'bg-slate-100 after:absolute after:inset-0 after:flex after:items-center after:justify-center after:text-xs after:font-bold after:text-slate-500 after:content-["×"]' : ''}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="relative shrink-0">
                  <button
                    type="button"
                    onPointerDown={preventToolbarFocus}
                    onMouseDown={preventToolbarFocus}
                    onClick={() => { setAlignmentOpen((previous) => !previous); setColorOpen(false); }}
                    aria-label="Ajuste de texto"
                    aria-expanded={alignmentOpen}
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 transition-colors active:bg-slate-100 [@media(hover:hover)]:hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                    data-testid="manual-card-editor-alignment"
                  >
                    <AlignCenter className="h-5 w-5" />
                  </button>

                  {alignmentOpen && (
                    <>
                      <div className="fixed inset-0 z-[1]" onPointerDown={() => setAlignmentOpen(false)} />
                      <div className="absolute bottom-full left-1/2 z-[2] mb-2 flex -translate-x-1/2 gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                        {alignOptions.map(({ value, label, Icon }) => (
                          <button
                            key={value}
                            type="button"
                            title={label}
                            aria-label={label}
                            onPointerDown={preventToolbarFocus}
                            onMouseDown={preventToolbarFocus}
                            onClick={() => { setTextAlign?.(value); setAlignmentOpen(false); }}
                            className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${textAlign === value ? 'bg-slate-900 text-white' : 'text-slate-600 active:bg-slate-100 [@media(hover:hover)]:hover:bg-slate-100'}`}
                          >
                            <Icon className="h-4 w-4" />
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <span className="mx-1 h-10 w-px shrink-0 bg-slate-200" aria-hidden="true" />

              <button
                type="button"
                onPointerDown={preventToolbarFocus}
                onMouseDown={preventToolbarFocus}
                onClick={finishEditor}
                disabled={saving}
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
    </div>
  );

  return createPortal(modal, document.body);
}
