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
  Pencil,
  Loader2,
  Plus,
  X,
} from 'lucide-react';
import { ColorPalette, ColorSwatchButton } from './StylePanel';

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

const isTouchDevice = () => (
  typeof window !== 'undefined'
  && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window)
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
  styles = {},
  updateStyle,
  ALIGNS = DEFAULT_ALIGNS,
  SWATCHES = DEFAULT_SWATCHES,
  textAlign = 'left',
  setTextAlign,
}) {
  const [activeSide, setActiveSide] = useState(() => normalizeSide(initialSide));
  const [viewportFrame, setViewportFrame] = useState(null);
  const [openMenu, setOpenMenu] = useState(null); // 'color' | 'align' | null
  const [focusResumeReason, setFocusResumeReason] = useState(null); // 'initial' | 'keyboard' | 'image' | null

  const textareaRef = useRef(null);
  const imageInputRef = useRef(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  const focusResumeReasonRef = useRef(null);
  const keyboardWasOpenRef = useRef(false);
  const resumeRequestedRef = useRef(false);
  const imagePickerActiveRef = useRef(false);
  const pickerReturnTimerRef = useRef(null);
  const initialKeyboardCheckTimerRef = useRef(null);
  const colorAnchorRef = useRef(null);
  const openMenuRef = useRef(null);
  const menuReturnFocusRef = useRef(null);
  const focusRestoreFrameRef = useRef(null);
  const menuKeyboardGuardTimerRef = useRef(null);

  const alignOptions = Array.isArray(ALIGNS) && ALIGNS.length ? ALIGNS : DEFAULT_ALIGNS;
  const swatches = Array.isArray(SWATCHES) && SWATCHES.length ? SWATCHES : DEFAULT_SWATCHES;

  const setMenuState = useCallback((nextMenu) => {
    openMenuRef.current = nextMenu;
    setOpenMenu(nextMenu);
  }, []);

  const setFocusResumeReasonSafe = useCallback((reason) => {
    focusResumeReasonRef.current = reason;
    setFocusResumeReason(reason);
  }, []);

  const focusTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    try {
      textarea.focus({ preventScroll: true });
      const { start, end } = selectionRef.current;
      if (typeof start === 'number' && typeof end === 'number') {
        textarea.setSelectionRange(start, end);
      }
    } catch {
      textarea.focus();
    }
  }, []);

  const openImagePicker = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      selectionRef.current = {
        start: textarea.selectionStart,
        end: textarea.selectionEnd,
      };
    }
    const input = imageInputRef.current;
    if (!input) return;
    imagePickerActiveRef.current = true;
    input.value = '';
    input.click();
  };

  const handleImageInputChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      handleContentImageFile?.(event, activeSide);
      imagePickerActiveRef.current = false;
      resumeRequestedRef.current = false;
      setFocusResumeReasonSafe('image');
    }
  };

  const handleResumeFocus = () => {
    resumeRequestedRef.current = true;
    setFocusResumeReasonSafe(null);
    focusTextarea();
  };

  useLayoutEffect(() => {
    if (!open) return;

    const nextSide = normalizeSide(initialSide);
    setActiveSide((previousSide) => (previousSide === nextSide ? previousSide : nextSide));
    setMenuState(null);
    focusResumeReasonRef.current = null;
    setFocusResumeReason(null);
    keyboardWasOpenRef.current = false;
    resumeRequestedRef.current = false;
    imagePickerActiveRef.current = false;
    setViewportFrame(null);
  }, [initialSide, open, setMenuState]);

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
          previousFrame?.height === height &&
          previousFrame.offsetTop === offsetTop &&
          previousFrame.keyboardOpen === keyboardOpen
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

  // Enfoque inicial al montar o cambiar de lado
  useLayoutEffect(() => {
    if (!open || typeof window === 'undefined') return undefined;

    focusTextarea();
    const frame = window.requestAnimationFrame(() => {
      if (document.activeElement !== textareaRef.current) focusTextarea();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [focusTextarea, open, activeSide]);

  // En algunos navegadores móviles el foco programático no puede abrir el
  // teclado al montar el modal. Esperamos a que termine la animación de
  // apertura y mostramos la misma ayuda contextual usada tras cargar una
  // imagen si el viewport sigue sin reducirse.
  useEffect(() => {
    if (!open || typeof window === 'undefined') {
      if (initialKeyboardCheckTimerRef.current) {
        window.clearTimeout(initialKeyboardCheckTimerRef.current);
        initialKeyboardCheckTimerRef.current = null;
      }
      return undefined;
    }

    if (initialKeyboardCheckTimerRef.current) {
      window.clearTimeout(initialKeyboardCheckTimerRef.current);
    }

    keyboardWasOpenRef.current = false;
    resumeRequestedRef.current = false;
    initialKeyboardCheckTimerRef.current = window.setTimeout(() => {
      initialKeyboardCheckTimerRef.current = null;
      if (!isTouchDevice() || imagePickerActiveRef.current || resumeRequestedRef.current) return;

      const layoutHeight = Math.max(
        window.innerHeight,
        document.documentElement?.clientHeight || 0,
      );
      const visibleHeight = Math.round(window.visualViewport?.height || window.innerHeight);
      const keyboardOpen = visibleHeight < layoutHeight - 100;

      if (keyboardOpen) {
        keyboardWasOpenRef.current = true;
        return;
      }

      setFocusResumeReasonSafe('initial');
    }, 450);

    return () => {
      if (initialKeyboardCheckTimerRef.current) {
        window.clearTimeout(initialKeyboardCheckTimerRef.current);
        initialKeyboardCheckTimerRef.current = null;
      }
    };
  }, [activeSide, open, setFocusResumeReasonSafe]);

  // También cubre el caso en que el usuario ya estaba escribiendo y el
  // teclado se cierra por una acción del navegador. El selector de imágenes
  // queda excluido para conservar el mensaje específico de imagen cargada.
  useEffect(() => {
    if (!open || !viewportFrame || !isTouchDevice()) return;

    if (viewportFrame.keyboardOpen) {
      keyboardWasOpenRef.current = true;
      resumeRequestedRef.current = false;
      if (focusResumeReasonRef.current === 'initial') {
        setFocusResumeReasonSafe(null);
      }
      return;
    }

    if (
      !keyboardWasOpenRef.current
      || imagePickerActiveRef.current
      || resumeRequestedRef.current
      || focusResumeReasonRef.current
      || openMenuRef.current !== null
    ) return;

    setFocusResumeReasonSafe('keyboard');
  }, [open, setFocusResumeReasonSafe, viewportFrame]);

  // Cancelar el selector de archivos no dispara change en todos los
  // navegadores. Liberamos la excepción al volver a la ventana para que una
  // futura pérdida real del teclado vuelva a mostrar la ayuda normal.
  useEffect(() => {
    if (!open || typeof window === 'undefined') return undefined;

    const handleWindowFocus = () => {
      if (pickerReturnTimerRef.current) window.clearTimeout(pickerReturnTimerRef.current);
      pickerReturnTimerRef.current = window.setTimeout(() => {
        pickerReturnTimerRef.current = null;
        imagePickerActiveRef.current = false;
      }, 250);
    };

    window.addEventListener('focus', handleWindowFocus);
    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      if (pickerReturnTimerRef.current) {
        window.clearTimeout(pickerReturnTimerRef.current);
        pickerReturnTimerRef.current = null;
      }
    };
  }, [open]);

  useEffect(() => {
    setMenuState(null);
    setFocusResumeReasonSafe(null);
    keyboardWasOpenRef.current = false;
    resumeRequestedRef.current = false;
    imagePickerActiveRef.current = false;
  }, [activeSide, setFocusResumeReasonSafe, setMenuState]);

  useEffect(() => () => {
    if (menuKeyboardGuardTimerRef.current && typeof window !== 'undefined') {
      window.clearTimeout(menuKeyboardGuardTimerRef.current);
    }
    if (focusRestoreFrameRef.current && typeof window !== 'undefined') {
      window.cancelAnimationFrame(focusRestoreFrameRef.current);
    }
  }, []);

  if (!open || typeof document === 'undefined') return null;

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

  const currentAlign = (textAlign && textAlign !== '') ? textAlign : 'left';
  const currentAlignOption = alignOptions.find((option) => option.value === currentAlign) || alignOptions[0] || DEFAULT_ALIGNS[0];
  const CurrentAlignIcon = currentAlignOption.Icon || AlignLeft;

  const reverseSide = activeSide === 'question' ? 'answer' : 'question';
  const reverseCopy = getSideCopy(reverseSide);
  const hasActiveImage = Boolean(contentImage && imageSide === activeSide);
  const canSave = Boolean(question.trim() && answer.trim() && !saving);
  const needsFocusResume = Boolean(focusResumeReason);
  const imageResume = focusResumeReason === 'image';

  const modalViewportStyle = viewportFrame
    ? { height: `${viewportFrame.height}px`, top: `${viewportFrame.offsetTop}px` }
    : { height: '100dvh', top: 0 };

  const footerSafeAreaStyle = {
    paddingBottom: viewportFrame?.keyboardOpen ? '0px' : 'env(safe-area-inset-bottom)',
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

  const preserveToolbarFocus = (event) => {
    event?.preventDefault?.();
  };

  const rememberMenuFocus = (event) => {
    preserveToolbarFocus(event);
    if (typeof document === 'undefined') return;
    if (menuReturnFocusRef.current) return;
    const activeElement = document.activeElement;
    menuReturnFocusRef.current = activeElement instanceof HTMLElement && activeElement !== document.body
      ? activeElement
      : null;
  };

  const handleMenuTriggerPointerDown = (event) => {
    preserveToolbarFocus(event);
    if (openMenuRef.current === null) rememberMenuFocus();
  };

  const restoreMenuFocus = () => {
    const target = menuReturnFocusRef.current;
    menuReturnFocusRef.current = null;
    if (!target || typeof window === 'undefined') return;

    if (focusRestoreFrameRef.current) {
      window.cancelAnimationFrame(focusRestoreFrameRef.current);
    }

    focusRestoreFrameRef.current = window.requestAnimationFrame(() => {
      focusRestoreFrameRef.current = null;
      if (!target.isConnected || typeof target.focus !== 'function') return;
      try {
        target.focus({ preventScroll: true });
      } catch {
        target.focus();
      }

      if (target === textareaRef.current) {
        const { start, end } = selectionRef.current;
        if (typeof start === 'number' && typeof end === 'number') {
          try {
            target.setSelectionRange(start, end);
          } catch {
            // El navegador puede rechazar la selección durante la transición.
          }
        }
      }
    });
  };

  const guardKeyboardResumeAfterMenu = () => {
    // Abrir un selector nativo puede cerrar temporalmente el teclado. Ese
    // cambio de viewport no debe convertirse en el mensaje "Listo para
    // editar" ni dejar el editor en un estado de falsa pérdida de foco.
    keyboardWasOpenRef.current = false;
    resumeRequestedRef.current = true;
    setFocusResumeReasonSafe(null);

    if (menuKeyboardGuardTimerRef.current && typeof window !== 'undefined') {
      window.clearTimeout(menuKeyboardGuardTimerRef.current);
    }

    if (typeof window !== 'undefined') {
      menuKeyboardGuardTimerRef.current = window.setTimeout(() => {
        menuKeyboardGuardTimerRef.current = null;
        resumeRequestedRef.current = false;
      }, 450);
    }
  };

  const closeMenu = () => {
    const wasOpen = openMenuRef.current !== null;
    setMenuState(null);
    if (wasOpen) {
      guardKeyboardResumeAfterMenu();
      restoreMenuFocus();
    }
  };

  const toggleColorMenu = () => {
    if (openMenuRef.current === 'color') {
      closeMenu();
      return;
    }
    if (!menuReturnFocusRef.current) rememberMenuFocus();
    setMenuState('color');
  };

  const blockMenuBackdropPointerDown = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const closeMenuFromBackdrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeMenu();
  };

  const switchSide = () => {
    setMenuState(null);
    setFocusResumeReasonSafe(null);
    keyboardWasOpenRef.current = false;
    resumeRequestedRef.current = false;
    imagePickerActiveRef.current = false;
    setActiveSide((previousSide) => (previousSide === 'question' ? 'answer' : 'question'));
  };

  const saveCard = async (keepEditing) => {
    if (!canSave) return false;

    const wasSaved = await onSaveCard?.();
    if (wasSaved === false) return false;

    if (keepEditing) {
      setActiveSide('question');
      setMenuState(null);
      setFocusResumeReasonSafe(null);
      return true;
    }

    onClose?.();
    return true;
  };

  const finishEditor = async () => {
    if (saving) return;

    if (!question.trim() || !answer.trim()) {
      onClose?.();
      return;
    }

    await saveCard(false);
  };

  const controlButtonClass = (isActive = false) =>
    `flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
      isActive
        ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
        : 'border-slate-200 bg-white text-slate-600 active:bg-slate-100 [@media(hover:hover)]:hover:bg-slate-50'
    }`;

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
        <main
          className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-[#f7f8fc] px-4 py-3 sm:px-6 sm:py-5"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              focusTextarea();
            }
          }}
        >
          {/* 🚀 CAMBIO: flex-1 y justify-end para empujar el texto hacia abajo cuando needsFocusResume es true */}
          <div className={`mx-auto flex w-full max-w-2xl flex-col gap-3 ${needsFocusResume ? 'flex-1 justify-end pb-4' : ''}`}>
            <div className="relative h-[clamp(8rem,20dvh,10rem)] shrink-0 overflow-hidden rounded-[1.5rem] border-2 border-slate-500/80 bg-white shadow-[0_18px_45px_-36px_rgba(15,23,42,0.55)] focus-within:border-slate-700 focus-within:ring-4 focus-within:ring-slate-900/[0.06]">
              <textarea
                ref={textareaRef}
                value={activeValue}
                onChange={(event) => {
                  updateActiveValue(event.target.value);
                  selectionRef.current = {
                    start: event.target.selectionStart,
                    end: event.target.selectionEnd,
                  };
                }}
                onSelect={(event) => {
                  selectionRef.current = {
                    start: event.target.selectionStart,
                    end: event.target.selectionEnd,
                  };
                }}
                placeholder={activeCopy.placeholder}
                aria-label={activeCopy.label}
                autoFocus
                style={activeTextareaStyle}
                className="h-full min-h-0 w-full resize-none bg-transparent px-4 py-3 text-base leading-7 outline-none placeholder:font-medium placeholder:text-slate-300 sm:px-5 sm:py-4 sm:text-lg sm:leading-8"
                data-testid={`manual-card-editor-${activeSide}`}
              />

              {/* Ayuda contextual cuando el navegador no abrió el teclado. */}
              {needsFocusResume && (
                <button
                  type="button"
                  onClick={handleResumeFocus}
                  className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/85 backdrop-blur-sm text-slate-700 animate-[fadeIn_0.15s_ease]"
                  aria-label={imageResume ? 'Toca para seguir escribiendo' : 'Toca para comenzar a escribir'}
                >
                  {imageResume ? (
                    <ImagePlus className="mb-2 h-6 w-6 text-slate-500" />
                  ) : (
                    <Pencil className="mb-2 h-6 w-6 text-slate-500" />
                  )}
                  <span className="text-sm font-bold">{imageResume ? 'Imagen cargada' : 'Listo para editar'}</span>
                  <span className="mt-1 text-xs font-medium text-slate-500">
                    {imageResume ? 'Toca aquí para seguir escribiendo' : 'Toca aquí para comenzar a escribir'}
                  </span>
                </button>
              )}
            </div>

            {error && (
              <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                {error}
              </p>
            )}
          </div>
        </main>

        <footer
          className="relative z-20 shrink-0 border-t border-slate-200/80 bg-white shadow-[0_-12px_35px_-28px_rgba(15,23,42,0.65)]"
          style={footerSafeAreaStyle}
        >
          <div className="relative z-10 mx-auto flex w-full max-w-2xl gap-2 border-b border-slate-100 bg-white px-3 py-2 sm:px-4">
            <button
              type="button"
              onPointerDown={preserveToolbarFocus}
              onClick={switchSide}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition-colors active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 sm:text-sm"
              data-testid="manual-card-editor-switch-side"
            >
              {reverseSide === 'answer' ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
              <span className="truncate">Editar {reverseCopy.label.toLowerCase()}</span>
            </button>

            <button
              type="button"
              onPointerDown={preserveToolbarFocus}
              onClick={() => saveCard(true)}
              disabled={!canSave}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition-colors active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 sm:text-sm"
              data-testid="manual-card-editor-add-another"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <span className="truncate">{isEditing ? 'Guardar y crear otra' : 'Añadir tarjeta'}</span>
            </button>
          </div>

          <div className="relative z-10 mx-auto grid min-h-16 w-full max-w-2xl grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-2 bg-white px-3 sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:px-4">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
              {hasActiveImage ? (
                <>
                  <button
                    type="button"
                    onPointerDown={preserveToolbarFocus}
                    onClick={openImagePicker}
                    className="flex h-10 w-10 cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
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
                    onPointerDown={preserveToolbarFocus}
                    onClick={removeContentImage}
                    aria-label="Eliminar imagen adjunta"
                    data-testid="manual-card-editor-remove-image"
                    className="absolute -right-1 -top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-slate-700 text-white shadow-sm transition-colors active:bg-rose-600 [@media(hover:hover)]:hover:bg-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onPointerDown={preserveToolbarFocus}
                  onClick={openImagePicker}
                  className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                  title={`Añadir imagen a ${activeCopy.label.toLowerCase()}`}
                  aria-label={`Añadir imagen a ${activeCopy.label.toLowerCase()}`}
                  data-testid="manual-card-editor-image-control"
                >
                  <ImagePlus className="h-5 w-5" />
                </button>
              )}
            </div>

            <div className="relative flex min-w-0 items-center justify-between gap-1 border-x border-slate-200 px-1 sm:gap-1.5 sm:px-2">
              <button
                type="button"
                onPointerDown={preserveToolbarFocus}
                onClick={() => updateActiveStyle('Bold', !activeBold)}
                aria-label={`${activeBold ? 'Desactivar' : 'Activar'} negritas`}
                aria-pressed={activeBold}
                className={controlButtonClass(activeBold)}
                data-testid="manual-card-editor-bold"
              >
                <Bold className="h-4 w-4" />
              </button>

              <button
                type="button"
                onPointerDown={preserveToolbarFocus}
                onClick={() => updateActiveStyle('Italic', !activeItalic)}
                aria-label={`${activeItalic ? 'Desactivar' : 'Activar'} cursivas`}
                aria-pressed={activeItalic}
                className={controlButtonClass(activeItalic)}
                data-testid="manual-card-editor-italic"
              >
                <Italic className="h-4 w-4" />
              </button>

              <div ref={colorAnchorRef} className="relative shrink-0">
                <button
                  type="button"
                  onPointerDown={handleMenuTriggerPointerDown}
                  onClick={toggleColorMenu}
                  aria-label="Color del texto"
                  aria-expanded={openMenu === 'color'}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all ${
                    openMenu === 'color'
                      ? 'ring-2 ring-indigo-400 ring-offset-1'
                      : ''
                  } ${activeColor
                    ? 'border-slate-300 bg-white shadow-xs dark:border-slate-600'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
                  data-testid="manual-card-editor-color"
                >
                  <ColorSwatchButton value={activeColor} />
                </button>

                {openMenu === 'color' && (
                  <ColorPalette
                    value={activeColor}
                    swatches={swatches}
                    onChange={(value) => updateActiveStyle('Color', value)}
                    onClose={closeMenu}
                    anchorRef={colorAnchorRef}
                    placement="above"
                    variant="horizontal"
                    label={`Colores de ${activeCopy.label.toLowerCase()}`}
                  />
                )}
              </div>

              <div className="relative shrink-0">
                <button
                  type="button"
                  onPointerDown={handleMenuTriggerPointerDown}
                  onClick={() => {
                    if (openMenuRef.current === 'align') {
                      closeMenu();
                    } else {
                      setMenuState('align');
                    }
                  }}
                  aria-label={`Alineación: ${currentAlignOption.label}`}
                  aria-expanded={openMenu === 'align'}
                  className={controlButtonClass(currentAlign !== 'left')}
                  data-testid="manual-card-editor-align"
                >
                  <CurrentAlignIcon className="h-4 w-4" />
                </button>

                {openMenu === 'align' && (
                  <>
                    <div
                      className="fixed inset-0 z-[80] bg-transparent"
                      onPointerDown={blockMenuBackdropPointerDown}
                      onClick={closeMenuFromBackdrop}
                    />
                    <div className="absolute bottom-[calc(100%+0.5rem)] right-0 z-[90] w-[168px] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl animate-[slideUp_0.1s_ease-out]">
                      <p className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        Alineación
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {alignOptions.map(({ value, label, Icon }) => (
                          <button
                            key={value}
                            type="button"
                            title={label}
                            aria-label={label}
                            aria-pressed={currentAlign === value}
                            onPointerDown={preserveToolbarFocus}
                            onClick={() => {
                              setTextAlign?.(value);
                              closeMenu();
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

            <button
              type="button"
              onClick={finishEditor}
              disabled={saving}
              className="inline-flex h-10 min-w-16 shrink-0 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 shadow-sm transition-colors active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 sm:h-11 sm:min-w-20 sm:gap-1.5 sm:px-3 sm:text-sm"
              data-testid="manual-card-editor-done"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              <span>Listo</span>
            </button>

            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageInputChange}
              className="sr-only"
              tabIndex={-1}
            />
          </div>
        </footer>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modal, document.body)
    : modal;
}
