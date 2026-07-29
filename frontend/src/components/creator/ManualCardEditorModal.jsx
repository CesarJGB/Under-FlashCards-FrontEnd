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
  PenLine,
  Pipette,
  Plus,
  Type,
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
  const [openMenu, setOpenMenu] = useState(null);
  const [viewportFrame, setViewportFrame] = useState(null);
  const textareaRef = useRef(null);
  const imageInputRef = useRef(null);
  const imagePickerActiveRef = useRef(false);
  const imageRestoreTimersRef = useRef([]);

  const alignOptions = Array.isArray(ALIGNS) && ALIGNS.length > 0 ? ALIGNS : DEFAULT_ALIGNS;
  const swatches = Array.isArray(SWATCHES) && SWATCHES.length > 0 ? SWATCHES : DEFAULT_SWATCHES;

  const clearImageRestoreTimers = useCallback(() => {
    imageRestoreTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    imageRestoreTimersRef.current = [];
  }, []);

  const focusTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    try {
      textarea.focus({ preventScroll: true });
    } catch {
      textarea.focus();
    }
  }, []);

  // iOS puede tardar en cerrar Fotos/Archivos después de emitir `change`.
  // Se hacen varios intentos espaciados y no se marca el selector como cerrado
  // hasta el último intento, evitando que el teclado se quede abajo.
  const restoreAfterImagePicker = useCallback(() => {
    if (!imagePickerActiveRef.current || typeof window === 'undefined') return;

    clearImageRestoreTimers();
    const delays = [80, 180, 360, 640];

    imageRestoreTimersRef.current = delays.map((delay, index) => window.setTimeout(() => {
      if (!imagePickerActiveRef.current || document.visibilityState !== 'visible') return;

      focusTextarea();

      if (index === delays.length - 1) {
        imagePickerActiveRef.current = false;
        imageRestoreTimersRef.current = [];
      }
    }, delay));
  }, [clearImageRestoreTimers, focusTextarea]);

  useLayoutEffect(() => {
    if (!open) return;

    const nextSide = normalizeSide(initialSide);
    setActiveSide((previousSide) => (
      previousSide === nextSide ? previousSide : nextSide
    ));
    setOpenMenu(null);
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
      clearImageRestoreTimers();
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [clearImageRestoreTimers, open, restoreAfterImagePicker]);

  // Usamos el viewport visual para que el footer siga justo encima del teclado.
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

  // Solo se solicita el foco al abrir. Cambiar de lado conserva el textarea y
  // evita que iOS vuelva a dibujar el teclado.
  useLayoutEffect(() => {
    if (!open || typeof window === 'undefined') return undefined;

    focusTextarea();

    const frame = window.requestAnimationFrame(() => {
      if (document.activeElement !== textareaRef.current) focusTextarea();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [focusTextarea, open]);

  if (!open) return null;

  const activeCopy = getSideCopy(activeSide);
  const activeValue = activeSide === 'answer' ? answer : question;
  const activePrefix = activeSide === 'answer' ? 'a' : 'q';
  const activeBoldKey = `${activePrefix}Bold`;
  const activeItalicKey = `${activePrefix}Italic`;
  const activeColorKey = `${activePrefix}Color`;
  const activeSizeKey = `${activePrefix}Size`;
  const activeBold = Boolean(styles?.[activeBoldKey]);
  const activeItalic = Boolean(styles?.[activeItalicKey]);
  const activeColor = typeof styles?.[activeColorKey] === 'string' ? styles[activeColorKey] : '';
  const activeSize = Number(styles?.[activeSizeKey]);
  const currentAlign = textAlign || 'center';
  const currentAlignOption = alignOptions.find((option) => option.value === currentAlign) || alignOptions[1] || DEFAULT_ALIGNS[1];
  const CurrentAlignIcon = currentAlignOption.Icon || AlignCenter;
  const reverseSide = activeSide === 'question' ? 'answer' : 'question';
  const reverseCopy = getSideCopy(reverseSide);
  const hasActiveImage = Boolean(contentImage && imageSide === activeSide);
  const canSave = Boolean(question.trim() && answer.trim() && !saving);
  const modalViewportStyle = viewportFrame
    ? { height: `${viewportFrame.height}px`, top: `${viewportFrame.offsetTop}px` }
    : undefined;
  const footerSafeAreaStyle = {
    paddingBottom: viewportFrame?.keyboardOpen ? '0px' : 'env(safe-area-inset-bottom)',
    backgroundColor: '#ffffff',
  };
  const activeTextareaStyle = {
    ...(activeColor ? { color: activeColor } : {}),
    ...(activeBold ? { fontWeight: 700 } : { fontWeight: 500 }),
    ...(activeItalic ? { fontStyle: 'italic' } : { fontStyle: 'normal' }),
    ...(Number.isFinite(activeSize) && activeSize > 0 ? { fontSize: `${activeSize}px` } : {}),
    textAlign: currentAlign,
  };

  const updateActiveValue = (value) => {
    if (activeSide === 'answer') setAnswer(value);
    else setQuestion(value);
  };

  const updateActiveStyle = (suffix, value) => {
    updateStyle?.(`${activePrefix}${suffix}`, value);
  };

  const saveCard = async (keepEditing) => {
    if (!canSave) return false;

    const wasSaved = await onSaveCard?.();
    if (wasSaved === false) return false;

    if (keepEditing) {
      setActiveSide('question');
      setOpenMenu(null);
      return true;
    }

    onClose?.();
    return true;
  };

  const finishEditor = async () => {
    if (saving) return;

    // Una tarjeta incompleta solo cierra el editor; el borrador permanece en
    // el formulario compacto y no se envía al backend.
    if (!question.trim() || !answer.trim()) {
      onClose?.();
      return;
    }

    await saveCard(false);
  };

  const handleImagePickerPress = (event) => {
    event.preventDefault();
    imagePickerActiveRef.current = true;
    focusTextarea();
  };

  const openImagePicker = () => {
    imagePickerActiveRef.current = true;
    imageInputRef.current?.click();
  };

  const handleImageInputChange = (event) => {
    handleContentImageFile?.(event, activeSide);
    restoreAfterImagePicker();
  };

  const controlButtonClass = (isActive = false) => (
    `flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1 ${
      isActive
        ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
        : 'border-slate-200 bg-white text-slate-600 active:bg-slate-100 [@media(hover:hover)]:hover:bg-slate-50'
    }`
  );

  const activeColorIconClass = activeColor === '#ffffff'
    ? 'text-slate-600'
    : activeColor
      ? 'text-white drop-shadow-sm'
      : 'text-slate-600';

  return (
    <div
      className="fixed inset-x-0 top-0 z-[70] isolate flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-white pt-[env(safe-area-inset-top)] text-slate-900"
      style={modalViewportStyle}
      role="dialog"
      aria-modal="true"
      aria-label={`Editar ${activeCopy.label.toLowerCase()} de la tarjeta`}
      data-keyboard-open={viewportFrame?.keyboardOpen ? 'true' : 'false'}
      data-testid="manual-card-editor-modal"
    >
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-[#f7f8fc] px-4 py-3 sm:px-6 sm:py-5">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
          <div className="h-[clamp(8rem,20dvh,10rem)] shrink-0 overflow-hidden rounded-[1.5rem] border-2 border-slate-500/80 bg-white shadow-[0_18px_45px_-36px_rgba(15,23,42,0.55)] focus-within:border-slate-700 focus-within:ring-4 focus-within:ring-slate-900/[0.06]">
            <textarea
              ref={textareaRef}
              value={activeValue}
              onChange={(event) => updateActiveValue(event.target.value)}
              placeholder={activeCopy.placeholder}
              aria-label={activeCopy.label}
              autoFocus
              style={activeTextareaStyle}
              className="h-full min-h-0 w-full resize-none bg-transparent px-4 py-3 text-base leading-7 outline-none placeholder:font-medium placeholder:text-slate-300 sm:px-5 sm:py-4 sm:text-lg sm:leading-8"
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
        className="relative z-10 shrink-0 overflow-visible border-t border-slate-200/80 bg-white shadow-[0_-12px_35px_-28px_rgba(15,23,42,0.65)]"
        style={footerSafeAreaStyle}
      >
        <div className="mx-auto flex w-full max-w-2xl gap-2 border-b border-slate-100 px-3 py-2 sm:px-4">
          <button
            type="button"
            onClick={() => { setActiveSide(reverseSide); setOpenMenu(null); }}
            onMouseDown={(event) => event.preventDefault()}
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
                  <button
                    type="button"
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
                    <span className="sr-only">Cambiar imagen de {activeCopy.label.toLowerCase()}</span>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
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
                    onCancel={restoreAfterImagePicker}
                    className="hidden"
                  />
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onMouseDown={handleImagePickerPress}
                    onClick={openImagePicker}
                    className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                    title={`Añadir imagen a ${activeCopy.label.toLowerCase()}`}
                    aria-label={`Añadir imagen a ${activeCopy.label.toLowerCase()}`}
                    data-testid="manual-card-editor-image-control"
                  >
                    <ImagePlus className="h-5 w-5" />
                    <span className="sr-only">Añadir imagen a {activeCopy.label.toLowerCase()}</span>
                  </button>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageInputChange}
                    onCancel={restoreAfterImagePicker}
                    className="hidden"
                  />
                </>
              )}
            </div>

            <span className="mx-1 h-10 w-px shrink-0 bg-slate-200" aria-hidden="true" />

            <div className="relative flex min-w-0 flex-1 items-center justify-evenly gap-0.5">
              <button
                type="button"
                disabled
                title="Tamaño de texto próximamente"
                aria-label="Tamaño de texto próximamente"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 opacity-40"
                data-testid="manual-card-editor-format"
              >
                <Type className="h-5 w-5" />
              </button>

              <button
                type="button"
                disabled
                title="Dibujo próximamente"
                aria-label="Dibujo próximamente"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 opacity-40"
                data-testid="manual-card-editor-draw"
              >
                <PenLine className="h-5 w-5" />
              </button>

              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => updateActiveStyle('Bold', !activeBold)}
                aria-label={`${activeBold ? 'Desactivar' : 'Activar'} negritas en ${activeCopy.label.toLowerCase()}`}
                aria-pressed={activeBold}
                className={controlButtonClass(activeBold)}
                data-testid="manual-card-editor-bold"
              >
                <Bold className="h-4 w-4" />
              </button>

              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => updateActiveStyle('Italic', !activeItalic)}
                aria-label={`${activeItalic ? 'Desactivar' : 'Activar'} cursivas en ${activeCopy.label.toLowerCase()}`}
                aria-pressed={activeItalic}
                className={controlButtonClass(activeItalic)}
                data-testid="manual-card-editor-italic"
              >
                <Italic className="h-4 w-4" />
              </button>

              <div className="relative shrink-0">
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setOpenMenu((previousMenu) => (previousMenu === 'color' ? null : 'color'))}
                  aria-label={`Color de ${activeCopy.label.toLowerCase()}`}
                  aria-expanded={openMenu === 'color'}
                  className={controlButtonClass(Boolean(activeColor))}
                  style={activeColor ? { backgroundColor: activeColor } : undefined}
                  data-testid="manual-card-editor-color"
                >
                  <Palette className={`h-4 w-4 ${activeColorIconClass}`} />
                </button>

                {openMenu === 'color' && (
                  <>
                    <div className="fixed inset-0 z-[80]" onClick={() => setOpenMenu(null)} aria-hidden="true" />
                    <div className="absolute bottom-[calc(100%+0.5rem)] right-0 z-[90] w-[196px] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl animate-[slideUp_0.1s_ease-out]">
                      <p className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        Color de {activeCopy.label.toLowerCase()}
                      </p>
                      <div className="grid grid-cols-4 gap-2">
                        {swatches.map((swatch) => (
                          <button
                            key={`${swatch.label}-${swatch.value}`}
                            type="button"
                            title={swatch.label}
                            aria-label={swatch.label}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              updateActiveStyle('Color', swatch.value);
                              setOpenMenu(null);
                            }}
                            style={swatch.value ? { backgroundColor: swatch.value } : undefined}
                            className={`relative h-9 w-9 rounded-xl border transition-all ${
                              activeColor === swatch.value
                                ? 'scale-110 ring-2 ring-slate-900 ring-offset-1'
                                : 'border-slate-200 [@media(hover:hover)]:hover:scale-105'
                            } ${
                              !swatch.value
                                ? 'bg-slate-100 after:absolute after:inset-0 after:flex after:items-center after:justify-center after:font-bold after:text-slate-500 after:content-["×"]'
                                : ''
                            }`}
                          />
                        ))}
                        <label
                          className="group relative flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-slate-300 bg-gradient-to-tr from-amber-400 via-rose-400 to-indigo-400 shadow-sm transition-transform [@media(hover:hover)]:hover:scale-105"
                          title="Color personalizado"
                        >
                          <Pipette className="relative z-10 h-4 w-4 text-white drop-shadow-sm transition-transform group-hover:scale-110" />
                          <input
                            type="color"
                            value={activeColor && activeColor.startsWith('#') ? activeColor : '#ffffff'}
                            onChange={(event) => updateActiveStyle('Color', event.target.value)}
                            className="absolute inset-0 z-0 h-full w-full cursor-pointer opacity-0"
                          />
                        </label>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="relative shrink-0">
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setOpenMenu((previousMenu) => (previousMenu === 'align' ? null : 'align'))}
                  aria-label={`Alineación: ${currentAlignOption.label}`}
                  aria-expanded={openMenu === 'align'}
                  className={controlButtonClass(currentAlign !== 'center')}
                  data-testid="manual-card-editor-align"
                >
                  <CurrentAlignIcon className="h-4 w-4" />
                </button>

                {openMenu === 'align' && (
                  <>
                    <div className="fixed inset-0 z-[80]" onClick={() => setOpenMenu(null)} aria-hidden="true" />
                    <div className="absolute bottom-[calc(100%+0.5rem)] right-0 z-[90] w-[168px] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl animate-[slideUp_0.1s_ease-out]">
                      <p className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Alineación</p>
                      <div className="grid grid-cols-3 gap-2">
                        {alignOptions.map(({ value, label, Icon }) => (
                          <button
                            key={value}
                            type="button"
                            title={label}
                            aria-label={label}
                            aria-pressed={currentAlign === value}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setTextAlign?.(value);
                              setOpenMenu(null);
                            }}
                            className={controlButtonClass(currentAlign === value)}
                          >
                            <Icon className="h-4 w-4" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <span className="mx-1 h-10 w-px shrink-0 bg-slate-200" aria-hidden="true" />

            <button
              type="button"
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
  );
}
