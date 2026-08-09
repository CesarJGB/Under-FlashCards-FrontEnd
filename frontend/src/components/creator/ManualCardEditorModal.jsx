import { createPortal } from 'react-dom';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
  Pencil,
  Plus,
  X,
} from 'lucide-react';
import { ColorPalette, ColorSwatchButton } from './StylePanel';
import { OverlayPortal, OverlayScope } from '../common/OverlayScope';
import { useScrollLease } from '../../lib/scrollLock';
import EditorOverlayRoot from './manual-editor/EditorOverlayRoot';
import { handleFocusPreservingPress } from './manual-editor/editorActivation';
import { needsInitialEditorGeometryFallback } from './manual-editor/editorGeometry';
import useEditorLayerStack from './manual-editor/useEditorLayerStack';
import useManualEditorSession from './manual-editor/useManualEditorSession';
import useEditorGeometry from './manual-editor/useEditorGeometry';

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

const COLOR_LAYER_ID = 'manual-editor-color';
const ALIGN_LAYER_ID = 'manual-editor-align';

function AlignmentPopover({
  anchorRef,
  geometry,
  layerStack,
  options,
  currentAlign,
  onSelect,
  controlButtonClass,
}) {
  const popoverRef = useRef(null);
  const [position, setPosition] = useState(null);

  useLayoutEffect(() => {
    let frameId = 0;
    const measure = () => {
      frameId = 0;
      const anchor = anchorRef.current;
      const popover = popoverRef.current;
      if (!anchor) {
        if (layerStack.isTop(ALIGN_LAYER_ID)) layerStack.dismissTop('anchor-lost');
        return;
      }
      if (!popover) return;
      const anchorRect = anchor.getBoundingClientRect();
      const popoverRect = popover.getBoundingClientRect();
      const margin = 8;
      const gap = 8;
      const minLeft = geometry.visual.left + margin;
      const maxRight = geometry.visual.left + geometry.visual.width - margin;
      const minTop = geometry.visual.top + margin;
      const maxBottom = geometry.visual.top + geometry.visual.height - margin;
      const width = Math.min(168, Math.max(1, maxRight - minLeft));
      const height = Math.min(popoverRect.height, Math.max(1, maxBottom - minTop));
      const left = Math.min(Math.max(anchorRect.right - width, minLeft), maxRight - width);
      const above = anchorRect.top - height - gap;
      const below = anchorRect.bottom + gap;
      const top = above >= minTop
        ? above
        : Math.min(Math.max(below, minTop), maxBottom - height);
      const next = { left, top, width, maxHeight: Math.max(1, maxBottom - minTop) };
      setPosition((current) => (
        current
        && Math.abs(current.left - next.left) <= 0.5
        && Math.abs(current.top - next.top) <= 0.5
        && Math.abs(current.width - next.width) <= 0.5
          ? current
          : next
      ));
    };
    frameId = window.requestAnimationFrame(measure);
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    if (anchorRef.current) observer?.observe(anchorRef.current);
    if (popoverRef.current) observer?.observe(popoverRef.current);
    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      observer?.disconnect();
    };
  }, [anchorRef, geometry.epoch, geometry.revision, layerStack]);

  return (
    <OverlayPortal
      ref={popoverRef}
      layerId={ALIGN_LAYER_ID}
      role="dialog"
      aria-label="Alineación"
      data-editor-align-popover="true"
      className="fixed w-[168px] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl animate-[slideUp_0.1s_ease-out]"
      style={{
        left: `${position?.left ?? 0}px`,
        top: `${position?.top ?? 0}px`,
        width: position ? `${position.width}px` : undefined,
        maxHeight: position ? `${position.maxHeight}px` : undefined,
        visibility: position ? 'visible' : 'hidden',
        overflowY: position ? 'auto' : undefined,
      }}
    >
      <p className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
        Alineación
      </p>
      <div className="grid grid-cols-3 gap-2">
        {options.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={currentAlign === value}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => onSelect(value)}
            className={controlButtonClass(currentAlign === value)}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
    </OverlayPortal>
  );
}

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
  resolveReturnFocus,
}) {
  const textareaRef = useRef(null);
  const dialogRef = useRef(null);
  const editorSurfaceRef = useRef(null);
  const editorMainRef = useRef(null);
  const overlayRootRef = useRef(null);
  const [overlayRootElement, setOverlayRootElement] = useState(null);
  const imageInputRef = useRef(null);
  const imageTransactionIdRef = useRef(null);
  const colorAnchorRef = useRef(null);
  const alignAnchorRef = useRef(null);
  const scrollOwnerRef = useRef(`manual-editor-scroll-${Math.random().toString(36).slice(2)}`);

  const editorSession = useManualEditorSession({
    open,
    initialSide,
    question,
    answer,
    textareaRef,
  });
  const activeSide = editorSession.activeSide;
  const editorGeometry = useEditorGeometry({ active: open });
  const scrollTargets = useMemo(() => {
    if (!open || typeof document === 'undefined') return { scrollRoot: null, inertRoot: null };
    const appScrollRoot = document.querySelector('[data-app-scroll-root]');
    if (!appScrollRoot && import.meta.env?.DEV) {
      console.warn('[manual-editor] data-app-scroll-root unavailable; using body fallback.');
    }
    return {
      scrollRoot: appScrollRoot || document.body,
      inertRoot: document.getElementById('root'),
    };
  }, [open]);
  const releaseScrollLease = useScrollLease({
    active: open,
    owner: scrollOwnerRef.current,
    ...scrollTargets,
  });
  const handleDismissRoot = useCallback((reason) => {
    releaseScrollLease();
    onClose?.(reason);
  }, [onClose, releaseScrollLease]);
  const layerStack = useEditorLayerStack({
    active: open,
    dialogRef,
    overlayRootRef,
    onDismissRoot: handleDismissRoot,
    resolveRootReturnFocus: resolveReturnFocus,
  });
  const setOverlayRoot = useCallback((node) => {
    overlayRootRef.current = node;
    setOverlayRootElement((current) => (current === node ? current : node));
  }, []);
  const openMenu = layerStack.topId === COLOR_LAYER_ID
    ? 'color'
    : layerStack.topId === ALIGN_LAYER_ID
      ? 'align'
      : null;
  const colorLayerToken = layerStack.layers.find((layer) => layer.id === COLOR_LAYER_ID)?.token;
  const alignLayerToken = layerStack.layers.find((layer) => layer.id === ALIGN_LAYER_ID)?.token;

  const alignOptions = Array.isArray(ALIGNS) && ALIGNS.length ? ALIGNS : DEFAULT_ALIGNS;
  const swatches = Array.isArray(SWATCHES) && SWATCHES.length ? SWATCHES : DEFAULT_SWATCHES;

  const openImagePicker = () => {
    const input = imageInputRef.current;
    if (!input) return;
    const transactionId = editorSession.beginPicker('image');
    imageTransactionIdRef.current = transactionId;
    input.value = '';
    try {
      input.click();
      editorSession.markPickerExternal(transactionId);
    } catch {
      editorSession.signalPickerReturn(transactionId);
    }
  };

  const handleImageInputChange = (event) => {
    const file = event.target.files?.[0];
    const transactionId = imageTransactionIdRef.current;
    if (!file || transactionId == null) return;
    if (editorSession.commitPicker(transactionId, { type: file.type, size: file.size })) {
      handleContentImageFile?.(
        event,
        editorSession.state.picker.side || activeSide,
      );
      imageTransactionIdRef.current = null;
    }
  };

  useLayoutEffect(() => {
    if (!open) return;
    imageTransactionIdRef.current = null;
  }, [initialSide, open]);

  useEffect(() => {
    const input = imageInputRef.current;
    if (!open || !input) return undefined;
    const handleCancel = () => {
      const transactionId = imageTransactionIdRef.current;
      if (transactionId == null) return;
      editorSession.cancelPicker(transactionId);
      imageTransactionIdRef.current = null;
    };
    input.addEventListener('cancel', handleCancel);
    return () => {
      input.removeEventListener('cancel', handleCancel);
    };
  }, [editorSession.cancelPicker, open]);

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
  const needsFocusResume = editorSession.state.resume.available;
  const imageResume = needsFocusResume
    && editorSession.state.resume.reason === 'image-picker-returned';

  const textareaEditoriallyActive = (
    editorSession.state.domFocus.observed
    && editorSession.state.domFocus.side === activeSide
  );
  const visualEdgeMitigation = (
    editorGeometry.phase === 'stable'
    && editorGeometry.source === 'visual-viewport'
    && editorGeometry.visual.scale === 1
    && textareaEditoriallyActive
    && editorGeometry.occlusion.bottom > 0
  );
  const editorSurfaceStyle = {
    ...(needsInitialEditorGeometryFallback(editorGeometry)
      ? { left: 0, top: 0, width: '100%', height: '100dvh' }
      : {
        left: `${editorGeometry.visual.left}px`,
        top: `${editorGeometry.visual.top}px`,
        width: `${editorGeometry.visual.width}px`,
        height: `${editorGeometry.visual.height}px`,
      }),
    paddingTop: 'env(safe-area-inset-top, 0px)',
    paddingLeft: 'env(safe-area-inset-left, 0px)',
    paddingRight: 'env(safe-area-inset-right, 0px)',
    '--editor-safe-bottom-effective': visualEdgeMitigation
      ? '0px'
      : 'env(safe-area-inset-bottom, 0px)',
  };
  const footerSafeAreaStyle = {
    paddingBottom: 'var(--editor-safe-bottom-effective)',
  };

  const activeTextareaStyle = {
    ...(activeColor ? { color: activeColor } : {}),
    ...(activeBold ? { fontWeight: 700 } : { fontWeight: 500 }),
    ...(activeItalic ? { fontStyle: 'italic' } : { fontStyle: 'normal' }),
    ...(Number.isFinite(activeSize) && activeSize > 0 ? { fontSize: `${activeSize}px` } : {}),
    textAlign: currentAlign,
  };

  const updateActiveValue = (value, textarea) => {
    if (activeSide === 'answer') setAnswer(value);
    else setQuestion(value);
    editorSession.updateValue(activeSide, value, textarea);
  };

  const updateActiveStyle = (suffix, value) => {
    updateStyle?.(`${activePrefix}${suffix}`, value);
  };

  const preserveToolbarFocus = (event) => event?.preventDefault?.();

  const closeColorMenu = (reason = 'selection') => (
    layerStack.dismissLayer(COLOR_LAYER_ID, colorLayerToken, reason)
  );
  const closeAlignMenu = (reason = 'selection') => (
    layerStack.dismissLayer(ALIGN_LAYER_ID, alignLayerToken, reason)
  );

  const toggleEditorLayer = (activation, id, returnTarget) => {
    layerStack.toggleLayer({
      id,
      ownerId: 'manual-editor-toolbar',
      kind: 'popover',
      focusPolicy: activation === 'pointer' ? 'pointer-preserve' : 'move-focus',
      returnTarget,
      replaceOwner: true,
    });
  };

  const switchSide = () => {
    if (layerStack.topId) layerStack.dismissTop('side-switch');
    editorSession.switchSide(reverseSide);
  };

  const handleSidePress = (event) => {
    handleFocusPreservingPress(event, switchSide);
  };

  const handleMenuPress = (event, id) => {
    const returnTarget = event.currentTarget;
    handleFocusPreservingPress(event, (activation) => {
      toggleEditorLayer(activation, id, returnTarget);
    });
  };

  const saveCard = async (keepEditing) => {
    if (!canSave) return false;

    const wasSaved = await onSaveCard?.();
    if (wasSaved === false) return false;

    if (keepEditing) {
      if (layerStack.topId) layerStack.dismissTop('save-and-continue');
      if (activeSide !== 'question') editorSession.switchSide('question');
      return true;
    }

    layerStack.dismissTop('save');
    return true;
  };

  const finishEditor = async () => {
    if (saving) return;

    if (!question.trim() || !answer.trim()) {
      layerStack.dismissTop('done');
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
      ref={dialogRef}
      className="fixed inset-0 z-[70] isolate overflow-hidden bg-white text-slate-900"
      role="dialog"
      aria-modal="true"
      aria-label={`Editar ${activeCopy.label.toLowerCase()} de la tarjeta`}
      data-active-side={activeSide}
      data-picker-status={editorSession.state.picker.status}
      data-geometry-phase={editorGeometry.phase}
      data-geometry-revision={editorGeometry.revision}
      data-geometry-epoch={editorGeometry.epoch}
      data-geometry-source={editorGeometry.source}
      data-geometry-orientation={editorGeometry.orientation}
      data-geometry-safe-bottom={visualEdgeMitigation ? 'visual-edge' : 'conservative'}
      data-editor-layer-top={layerStack.topId || ''}
      data-editor-layer-count={layerStack.layers.length}
      data-editor-geometry={JSON.stringify(editorGeometry)}
      data-testid="manual-card-editor-modal"
    >
      <OverlayScope
        portalTarget={overlayRootElement}
        layerStack={layerStack}
        bounds={editorGeometry.visual}
        geometry={editorGeometry}
        hostLayerId="manual-editor"
        ownsModality
        modalContentRef={editorSurfaceRef}
      >
      <div
        ref={editorSurfaceRef}
        className="fixed z-10 flex min-h-0 max-w-full flex-col overflow-hidden bg-white"
        style={editorSurfaceStyle}
        data-testid="manual-card-editor-surface"
      >
        <main
          ref={editorMainRef}
          className="relative z-10 flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain bg-[#f7f8fc] px-4 py-3 sm:px-6 sm:py-5"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              editorSession.resolveResumeFromGesture();
            }
          }}
        >
          <div className={`mx-auto flex w-full max-w-2xl flex-col gap-3 ${needsFocusResume ? 'flex-1 justify-end pb-4' : ''}`}>
            <div className="relative h-[clamp(8rem,20dvh,10rem)] shrink-0 overflow-hidden rounded-[1.5rem] border-2 border-slate-500/80 bg-white shadow-[0_18px_45px_-36px_rgba(15,23,42,0.55)] focus-within:border-slate-700 focus-within:ring-4 focus-within:ring-slate-900/[0.06]">
              <textarea
                ref={textareaRef}
                value={activeValue}
                onChange={(event) => {
                  updateActiveValue(event.target.value, event.target);
                  editorSession.observeInput();
                }}
                onSelect={() => editorSession.captureSelection(activeSide)}
                onFocus={() => editorSession.observeFocus(activeSide)}
                onBlur={() => editorSession.observeBlur(activeSide)}
                onBeforeInput={editorSession.observeInput}
                onInput={editorSession.observeInput}
                onCompositionStart={() => editorSession.startComposition(activeSide)}
                onCompositionEnd={(event) => editorSession.endComposition(activeSide, event.currentTarget)}
                placeholder={activeCopy.placeholder}
                aria-label={activeCopy.label}
                style={activeTextareaStyle}
                className="h-full min-h-0 w-full resize-none bg-transparent px-4 py-3 text-base leading-7 outline-none placeholder:font-medium placeholder:text-slate-300 sm:px-5 sm:py-4 sm:text-lg sm:leading-8"
                data-testid={`manual-card-editor-${activeSide}`}
              />

              {needsFocusResume && (
                <button
                  type="button"
                  onClick={editorSession.resolveResumeFromGesture}
                  className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/85 text-slate-700 backdrop-blur-sm animate-[fadeIn_0.15s_ease] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400"
                  aria-label={imageResume ? 'Toca para seguir escribiendo' : 'Toca para comenzar a escribir'}
                  data-testid="manual-card-editor-resume"
                >
                  {imageResume ? (
                    <ImagePlus className="mb-2 h-6 w-6 text-slate-500" />
                  ) : (
                    <Pencil className="mb-2 h-6 w-6 text-slate-500" />
                  )}
                  <span className="text-sm font-bold">
                    {imageResume ? 'Imagen cargada' : 'Listo para editar'}
                  </span>
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
          className="relative z-20 min-w-0 max-w-full shrink-0 overflow-x-hidden border-t border-slate-200/80 bg-white shadow-[0_-12px_35px_-28px_rgba(15,23,42,0.65)]"
          style={footerSafeAreaStyle}
        >
          <div className="relative z-10 mx-auto flex w-full max-w-2xl gap-2 border-b border-slate-100 bg-white px-3 py-2 sm:px-4">
            <button
              type="button"
              onPointerDown={handleSidePress}
              onClick={handleSidePress}
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
                onClick={() => {
                  editorSession.captureSelection(activeSide);
                  updateActiveStyle('Bold', !activeBold);
                }}
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
                onClick={() => {
                  editorSession.captureSelection(activeSide);
                  updateActiveStyle('Italic', !activeItalic);
                }}
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
                  onPointerDown={(event) => handleMenuPress(event, COLOR_LAYER_ID)}
                  onClick={(event) => handleMenuPress(event, COLOR_LAYER_ID)}
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
                    onPresetSelect={(value) => {
                      editorSession.captureSelection(activeSide);
                      updateActiveStyle('Color', value);
                    }}
                    onPickerRequest={() => editorSession.beginPicker('color')}
                    onPickerExternal={editorSession.markPickerExternal}
                    onPickerInput={editorSession.updatePickerDraft}
                    onPickerCommit={editorSession.commitPicker}
                    onPickerCancel={editorSession.cancelPicker}
                    onPickerReturnUnknown={editorSession.signalPickerReturn}
                    onClose={closeColorMenu}
                    anchorRef={colorAnchorRef}
                    editorGeometry={editorGeometry}
                    editorBoundsRef={editorMainRef}
                    placement="above"
                    variant="horizontal"
                    label={`Colores de ${activeCopy.label.toLowerCase()}`}
                    layerId={COLOR_LAYER_ID}
                  />
                )}
              </div>

              <div ref={alignAnchorRef} className="relative shrink-0">
                <button
                  type="button"
                  onPointerDown={(event) => handleMenuPress(event, ALIGN_LAYER_ID)}
                  onClick={(event) => handleMenuPress(event, ALIGN_LAYER_ID)}
                  aria-label={`Alineación: ${currentAlignOption.label}`}
                  aria-expanded={openMenu === 'align'}
                  className={controlButtonClass(currentAlign !== 'left')}
                  data-testid="manual-card-editor-align"
                >
                  <CurrentAlignIcon className="h-4 w-4" />
                </button>

                {openMenu === 'align' && (
                  <AlignmentPopover
                    anchorRef={alignAnchorRef}
                    geometry={editorGeometry}
                    layerStack={layerStack}
                    options={alignOptions}
                    currentAlign={currentAlign}
                    controlButtonClass={controlButtonClass}
                    onSelect={(value) => {
                      editorSession.captureSelection(activeSide);
                      setTextAlign?.(value);
                      closeAlignMenu('selection');
                    }}
                  />
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
      <EditorOverlayRoot ref={setOverlayRoot} geometry={editorGeometry} />
      </OverlayScope>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modal, document.body)
    : modal;
}
