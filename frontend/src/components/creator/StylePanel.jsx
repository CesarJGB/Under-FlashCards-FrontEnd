// ARCHIVO: frontend/src/components/creator/StylePanel.jsx
import { createPortal } from 'react-dom';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ImagePlus, Plus, Minus, Bold, Italic, Pipette, X } from 'lucide-react';
import { requestColorPickerFromClick } from './manual-editor/manualEditorSession';

const VIEWPORT_MARGIN = 8;
const PALETTE_GAP = 8;
const COLOR_INPUT_FALLBACK = '#ffffff';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function toColorInputValue(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (/^#[0-9a-f]{6}$/.test(normalized)) return normalized;
  if (/^#[0-9a-f]{3}$/.test(normalized)) {
    return `#${normalized.slice(1).split('').map((digit) => `${digit}${digit}`).join('')}`;
  }
  return COLOR_INPUT_FALLBACK;
}

export function ColorSwatchButton({ value }) {
  const normalizedValue = typeof value === 'string' ? value.trim() : '';
  const swatchStyle = normalizedValue
    ? { backgroundColor: normalizedValue }
    : { backgroundColor: '#ffffff' };

  return (
    <span
      aria-hidden="true"
      className="flex h-5 w-5 items-center justify-center rounded-[4px] border-2 border-slate-500/70 bg-white p-0.5 dark:border-slate-300/70 dark:bg-slate-900"
    >
      <span
        className="block h-full w-full rounded-[2px] border border-black/10"
        style={swatchStyle}
      />
    </span>
  );
}

export function ColorPalette({
  value,
  swatches,
  onChange,
  onClose,
  anchorRef,
  placement = 'above',
  variant = 'grid',
  label,
  onPresetSelect,
  onPickerRequest,
  onPickerExternal,
  onPickerInput,
  onPickerCommit,
  onPickerCancel,
  onPickerReturnUnknown,
  editorGeometry,
  editorBoundsRef,
}) {
  const paletteRef = useRef(null);
  const colorInputRef = useRef(null);
  const [position, setPosition] = useState(null);
  const normalizedValue = value || '';
  const colorInputValue = toColorInputValue(normalizedValue);
  const initialColorInputValue = useRef(colorInputValue);
  const localTransactionCounterRef = useRef(0);
  const activeCustomTransactionRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const hasSharedGeometry = Boolean(
    editorGeometry
    && editorGeometry.visual
    && editorGeometry.layout
  );

  useEffect(() => {
    const input = colorInputRef.current;
    if (!input) return undefined;

    const handleInput = (event) => {
      const transactionId = activeCustomTransactionRef.current;
      if (transactionId == null) return;
      onPickerInput?.(transactionId, event.target.value);
    };

    const handleChange = (event) => {
      const transactionId = activeCustomTransactionRef.current;
      if (transactionId == null) return;
      const accepted = onPickerCommit?.(transactionId, event.target.value);
      if (accepted === false) return;
      activeCustomTransactionRef.current = null;
      onChange(event.target.value);
      onClose?.();
    };

    const handleCancel = () => {
      const transactionId = activeCustomTransactionRef.current;
      if (transactionId == null) return;
      onPickerCancel?.(transactionId);
      activeCustomTransactionRef.current = null;
    };

    input.addEventListener('input', handleInput);
    input.addEventListener('change', handleChange);
    input.addEventListener('cancel', handleCancel);
    return () => {
      input.removeEventListener('input', handleInput);
      input.removeEventListener('change', handleChange);
      input.removeEventListener('cancel', handleCancel);
    };
  }, [onChange, onClose, onPickerCancel, onPickerCommit, onPickerInput]);

  useLayoutEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;

    let frameId = 0;
    if (hasSharedGeometry && editorGeometry.phase === 'settling') setPosition(null);

    const measure = () => {
      frameId = 0;

      const anchor = anchorRef?.current;
      const palette = paletteRef.current;
      if (!anchor) {
        if (hasSharedGeometry) onCloseRef.current?.();
        return;
      }
      if (!palette) return;

      const anchorRect = anchor.getBoundingClientRect();
      const paletteRect = palette.getBoundingClientRect();
      const dialogRect = anchor.closest('[role="dialog"]')?.getBoundingClientRect();

      const sharedVisual = hasSharedGeometry ? editorGeometry.visual : null;
      const visualViewport = hasSharedGeometry ? null : window.visualViewport;
      const viewportLeft = sharedVisual?.left ?? Math.max(0, visualViewport?.offsetLeft || 0);
      const viewportTop = sharedVisual?.top ?? Math.max(0, visualViewport?.offsetTop || 0);
      const viewportWidth = sharedVisual?.width ?? visualViewport?.width ?? window.innerWidth;
      const viewportHeight = sharedVisual?.height ?? visualViewport?.height ?? window.innerHeight;
      const viewportRight = viewportLeft + viewportWidth;
      const viewportBottom = viewportTop + viewportHeight;
      const editorBounds = hasSharedGeometry
        ? editorBoundsRef?.current?.getBoundingClientRect?.()
        : null;

      // VisualViewport and DOM rects are expressed in CSS pixels. Scale is
      // retained by the shared snapshot for policy/diagnostics and must not be
      // multiplied into these coordinates a second time.
      const minLeft = Math.max(
        viewportLeft + VIEWPORT_MARGIN,
        editorBounds
          ? editorBounds.left + VIEWPORT_MARGIN
          : (dialogRect?.left ?? VIEWPORT_MARGIN),
      );
      const maxRight = Math.min(
        viewportRight - VIEWPORT_MARGIN,
        editorBounds
          ? editorBounds.right - VIEWPORT_MARGIN
          : (dialogRect?.right ?? viewportRight - VIEWPORT_MARGIN),
      );
      const minTop = Math.max(
        viewportTop + VIEWPORT_MARGIN,
        dialogRect?.top ?? viewportTop + VIEWPORT_MARGIN,
      );
      const maxBottom = Math.min(
        viewportBottom - VIEWPORT_MARGIN,
        dialogRect?.bottom ?? viewportBottom - VIEWPORT_MARGIN,
      );

      const paletteWidth = Math.min(paletteRect.width, Math.max(1, maxRight - minLeft));
      const paletteHeight = Math.min(paletteRect.height, Math.max(1, maxBottom - minTop));
      const maxLeft = Math.max(minLeft, maxRight - paletteWidth);
      const maxTop = Math.max(minTop, maxBottom - paletteHeight);

      const left = clamp(anchorRect.right - paletteWidth, minLeft, maxLeft);
      const preferredTop = placement === 'below'
        ? anchorRect.bottom + PALETTE_GAP
        : anchorRect.top - paletteHeight - PALETTE_GAP;
      const oppositeTop = placement === 'below'
        ? anchorRect.top - paletteHeight - PALETTE_GAP
        : anchorRect.bottom + PALETTE_GAP;
      const fits = (top) => top >= minTop && top + paletteHeight <= maxBottom;
      const top = fits(preferredTop)
        ? preferredTop
        : fits(oppositeTop)
          ? oppositeTop
          : clamp(preferredTop, minTop, maxTop);

      const nextPosition = {
        left: Math.round(left),
        top: Math.round(top),
        width: Math.round(paletteWidth),
        maxHeight: Math.round(Math.max(1, maxBottom - minTop)),
      };
      setPosition((current) => (
        current?.left === nextPosition.left
        && current?.top === nextPosition.top
        && current?.width === nextPosition.width
        && current?.maxHeight === nextPosition.maxHeight
          ? current
          : nextPosition
      ));
    };

    const updatePosition = () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(measure);
    };

    updatePosition();
    if (!hasSharedGeometry) {
      window.addEventListener('resize', updatePosition);
      window.visualViewport?.addEventListener('resize', updatePosition);
      window.visualViewport?.addEventListener('scroll', updatePosition);
    }
    // The ActionSheet content scrolls inside its own element, so listen in capture mode.
    document.addEventListener('scroll', updatePosition, true);

    let resizeObserver;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updatePosition);
      if (anchorRef?.current) resizeObserver.observe(anchorRef.current);
      if (paletteRef.current) resizeObserver.observe(paletteRef.current);
    }

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      if (!hasSharedGeometry) {
        window.removeEventListener('resize', updatePosition);
        window.visualViewport?.removeEventListener('resize', updatePosition);
        window.visualViewport?.removeEventListener('scroll', updatePosition);
      }
      document.removeEventListener('scroll', updatePosition, true);
      resizeObserver?.disconnect();
    };
  }, [
    anchorRef,
    editorBoundsRef,
    editorGeometry?.epoch,
    editorGeometry?.phase,
    editorGeometry?.revision,
    editorGeometry?.source,
    editorGeometry?.visual?.scale,
    hasSharedGeometry,
    placement,
  ]);

  if (typeof document === 'undefined') return null;

  const isHorizontal = variant === 'horizontal';
  const palette = (
    <div
      ref={paletteRef}
      data-color-palette="true"
      data-color-palette-variant={variant}
      data-color-palette-geometry={hasSharedGeometry ? 'shared' : 'legacy-compatible'}
      data-color-palette-epoch={editorGeometry?.epoch}
      data-color-palette-revision={editorGeometry?.revision}
      data-color-palette-scale={editorGeometry?.visual?.scale}
      role="dialog"
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onClose?.();
        }
      }}
      className={`fixed z-[120] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl animate-[slideUp_0.1s_ease-out] dark:border-slate-700 dark:bg-slate-800 ${isHorizontal
        ? `flex w-max flex-nowrap items-center gap-2 overflow-x-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${hasSharedGeometry ? 'max-w-none' : 'max-w-[calc(100vw-1rem)]'}`
        : `grid w-[168px] grid-cols-4 gap-2 ${hasSharedGeometry ? 'max-w-none' : 'max-w-[calc(100vw-1rem)]'}`}`}
      style={{
        left: `${position?.left ?? 0}px`,
        top: `${position?.top ?? 0}px`,
        width: position ? `${position.width}px` : undefined,
        maxWidth: position ? `${position.width}px` : undefined,
        maxHeight: position ? `${position.maxHeight}px` : undefined,
        visibility: position ? 'visible' : 'hidden',
        overflowY: position ? 'auto' : undefined,
        touchAction: isHorizontal ? 'pan-x' : undefined,
        WebkitOverflowScrolling: isHorizontal ? 'touch' : undefined,
      }}
    >
      {swatches.map((color) => {
        const isSelected = normalizedValue === color.value;

        return (
          <button
            key={color.value || 'default'}
            type="button"
            title={color.label}
            aria-label={color.label}
            aria-pressed={isSelected}
            onPointerDown={(event) => {
              // Keep the textarea focused while a swatch is selected. The
              // click event still fires after preventDefault on pointerdown.
              event.preventDefault();
            }}
            onClick={() => {
              (onPresetSelect || onChange)(color.value);
              onClose?.();
            }}
            style={color.value ? { backgroundColor: color.value } : undefined}
            className={`relative min-h-9 min-w-9 rounded-xl border transition-[box-shadow,transform,filter] duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${
              isSelected
                ? 'scale-110 border-transparent ring-2 ring-slate-900 ring-offset-1 dark:ring-slate-100'
                : 'border-slate-200 hover:scale-105 dark:border-slate-600'
            } ${!color.value ? 'bg-slate-100 after:absolute after:inset-0 after:flex after:items-center after:justify-center after:font-bold after:text-slate-500 after:content-["×"] dark:bg-slate-700 dark:after:text-slate-300' : ''}`}
          />
        );
      })}

        <button
          type="button"
          className="group relative flex min-h-9 min-w-9 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-slate-300 bg-gradient-to-tr from-amber-400 via-rose-400 to-indigo-400 shadow-xs transition-transform [@media(hover:hover)]:hover:scale-105 dark:border-slate-600"
          title="Color personalizado"
          aria-label="Color personalizado"
          onClick={() => {
            // This semantic click covers touch, mouse, keyboard and assistive
            // activation while preserving the transient user activation.
            const transactionId = onPickerRequest?.('color')
              ?? (localTransactionCounterRef.current + 1);
            if (!onPickerRequest) localTransactionCounterRef.current = transactionId;
            activeCustomTransactionRef.current = transactionId;
            const input = colorInputRef.current;
            if (!input) {
              onPickerReturnUnknown?.(transactionId);
              return;
            }
            if (input.value !== colorInputValue) input.value = colorInputValue;
            const result = requestColorPickerFromClick(input);
            if (result.requested) onPickerExternal?.(transactionId, result.method);
            else onPickerReturnUnknown?.(transactionId);
          }}
        >
          <Pipette className="relative z-10 h-3.5 w-3.5 text-white drop-shadow-xs transition-transform group-hover:scale-110" aria-hidden="true" />
        </button>
        <input
          ref={colorInputRef}
          type="color"
          // Debe ser no controlado: en iOS, volver a escribir `value` mientras
          // el selector nativo está abierto puede cerrarlo tras el primer cambio.
          defaultValue={initialColorInputValue.current}
          className="sr-only"
          tabIndex={-1}
          aria-label={`Elegir ${label || 'color'}`}
        />
    </div>
  );

  return createPortal(
    <>
      <button
        type="button"
        tabIndex={-1}
        className="fixed inset-0 z-[110] cursor-default bg-transparent"
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onClose?.();
        }}
        aria-hidden="true"
      />
      {palette}
    </>,
    document.body,
  );
}

export default function StylePanel({
  ALIGNS,
  SWATCHES,
  textAlign,
  setTextAlign,
  bgImage,
  setBgImage,
  styles,
  updateStyle,
  handleBgFile,
  compact = false,
}) {
  const [openColor, setOpenColor] = useState(null);
  const bgImageInputRef = useRef(null);
  const qColorAnchorRef = useRef(null);
  const aColorAnchorRef = useRef(null);
  const bgColorAnchorRef = useRef(null);
  const openColorRef = useRef(null);
  const colorReturnFocusRef = useRef(null);
  const focusRestoreFrameRef = useRef(null);

  const closeColor = () => {
    const wasOpen = openColorRef.current !== null;
    openColorRef.current = null;
    setOpenColor(null);

    // El backdrop es portalizado y no debe convertirse en el nuevo elemento
    // activo al cerrar. Conservamos el foco que existía antes de abrirlo para
    // que una interacción móvil no oculte el teclado accidentalmente.
    const target = colorReturnFocusRef.current;
    colorReturnFocusRef.current = null;
    if (target && typeof window !== 'undefined' && document.activeElement !== target) {
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
      });
    }

    return wasOpen;
  };

  const rememberColorFocus = (event) => {
    event?.preventDefault?.();
    if (typeof document === 'undefined') return;
    if (colorReturnFocusRef.current) return;
    const activeElement = document.activeElement;
    colorReturnFocusRef.current = activeElement instanceof HTMLElement && activeElement !== document.body
      ? activeElement
      : null;
  };

  const handleColorTriggerPointerDown = (event) => {
    event.preventDefault();
    if (openColorRef.current === null) rememberColorFocus();
  };

  const toggleColor = (colorId) => {
    if (openColorRef.current === colorId) {
      closeColor();
      return;
    }

    if (!colorReturnFocusRef.current && typeof document !== 'undefined') rememberColorFocus();
    if (focusRestoreFrameRef.current && typeof window !== 'undefined') {
      window.cancelAnimationFrame(focusRestoreFrameRef.current);
      focusRestoreFrameRef.current = null;
    }
    openColorRef.current = colorId;
    setOpenColor(colorId);
  };

  useEffect(() => () => {
    if (focusRestoreFrameRef.current && typeof window !== 'undefined') {
      window.cancelAnimationFrame(focusRestoreFrameRef.current);
    }
  }, []);

  const openBgImagePicker = () => {
    const input = bgImageInputRef.current;
    if (!input) return;
    input.value = '';
    input.click();
  };

  const renderStyleGroup = (title, prefix, colorId, colorAnchorRef) => {
    const sizeKey = `${prefix}Size`;
    const boldKey = `${prefix}Bold`;
    const italicKey = `${prefix}Italic`;
    const colorKey = `${prefix}Color`;
    const currentSizeNum = Number(styles[sizeKey]) || 16;
    const colorOpen = openColor === colorId;

    return (
      <div className={`relative rounded-xl border border-slate-200/60 bg-white shadow-xs dark:border-slate-700 dark:bg-slate-800 ${compact ? 'p-2.5' : 'p-3'}`}>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{title}</p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-900/70">
            <button
              type="button"
              onClick={() => updateStyle(sizeKey, Math.max(12, currentSizeNum - 1))}
              className="flex min-h-9 min-w-9 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-white dark:text-slate-300 dark:hover:bg-slate-700"
              aria-label={`Reducir tamaño de ${title.toLowerCase()}`}
            >
              <Minus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <span className="min-w-[38px] text-center font-mono text-[11px] font-extrabold text-slate-800 dark:text-slate-100">{currentSizeNum}px</span>
            <button
              type="button"
              onClick={() => updateStyle(sizeKey, Math.min(40, currentSizeNum + 1))}
              className="flex min-h-9 min-w-9 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-white dark:text-slate-300 dark:hover:bg-slate-700"
              aria-label={`Aumentar tamaño de ${title.toLowerCase()}`}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => updateStyle(boldKey, !styles[boldKey])}
              aria-label={`Negrita de ${title.toLowerCase()}`}
              aria-pressed={Boolean(styles[boldKey])}
              className={`flex min-h-10 min-w-10 items-center justify-center rounded-lg border transition-colors ${styles[boldKey] ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
            >
              <Bold className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => updateStyle(italicKey, !styles[italicKey])}
              aria-label={`Cursiva de ${title.toLowerCase()}`}
              aria-pressed={Boolean(styles[italicKey])}
              className={`flex min-h-10 min-w-10 items-center justify-center rounded-lg border transition-colors ${styles[italicKey] ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
            >
              <Italic className="h-3.5 w-3.5" aria-hidden="true" />
            </button>

            <div ref={colorAnchorRef} className="relative shrink-0">
              <button
                type="button"
                onPointerDown={handleColorTriggerPointerDown}
                onClick={() => toggleColor(colorId)}
                aria-label={`Color de ${title.toLowerCase()}`}
                aria-expanded={colorOpen}
                className={`flex min-h-10 min-w-10 items-center justify-center rounded-lg border transition-all ${
                  colorOpen
                    ? 'ring-2 ring-indigo-400 ring-offset-1 dark:ring-offset-slate-800'
                    : ''
                } ${styles[colorKey]
                  ? 'border-slate-300 bg-white shadow-xs dark:border-slate-600 dark:bg-slate-800'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
              >
                <ColorSwatchButton value={styles[colorKey]} />
              </button>
              {colorOpen && (
                <ColorPalette
                  value={styles[colorKey]}
                  swatches={SWATCHES}
                  onChange={(value) => updateStyle(colorKey, value)}
                  onClose={closeColor}
                  anchorRef={colorAnchorRef}
                  placement="above"
                  label={`Colores de ${title.toLowerCase()}`}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`${compact ? 'mt-0' : 'mt-3'} space-y-3 animate-[fadeIn_0.12s_ease]`}>
      <div className={`grid grid-cols-2 gap-2 rounded-xl border border-slate-200/40 bg-slate-100/50 dark:border-slate-700/60 dark:bg-slate-900/40 ${compact ? 'p-2.5' : 'p-3'}`}>
        <div className="flex flex-col items-center justify-center text-center">
          <p className="mb-1.5 w-full text-[10px] font-bold uppercase tracking-wide text-slate-400">Alineación</p>
          <div className="flex justify-center gap-1.5">
            {ALIGNS.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={textAlign === value}
                onClick={() => setTextAlign(value)}
                className={`flex min-h-10 min-w-10 items-center justify-center rounded-lg border transition-colors ${textAlign === value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center justify-center text-center">
          <p className="mb-1.5 w-full text-[10px] font-bold uppercase tracking-wide text-slate-400">Fondo</p>
          <div className="flex min-w-0 items-center justify-center gap-2">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
              {bgImage ? (
                <>
                  <button
                    type="button"
                    onClick={openBgImagePicker}
                    className="flex h-10 w-10 cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 dark:border-slate-600 dark:bg-slate-800"
                    title="Cambiar imagen de fondo"
                    aria-label="Cambiar imagen de fondo"
                  >
                    <img src={bgImage} alt="Imagen de fondo" className="h-full w-full object-cover" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setBgImage?.('')}
                    aria-label="Quitar imagen de fondo"
                    className="absolute -right-1 -top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-slate-700 text-white shadow-sm transition-colors active:bg-rose-600 [@media(hover:hover)]:hover:bg-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 dark:border-slate-900"
                  >
                    <X className="h-2.5 w-2.5" aria-hidden="true" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={openBgImagePicker}
                  className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:active:bg-slate-700"
                  title="Añadir imagen de fondo"
                  aria-label="Añadir imagen de fondo"
                >
                  <ImagePlus className="h-5 w-5" aria-hidden="true" />
                </button>
              )}
              <input ref={bgImageInputRef} type="file" accept="image/*" onChange={handleBgFile} className="hidden" />
            </div>

            <div className="h-5 w-px shrink-0 bg-slate-200 dark:bg-slate-700" />

            <div ref={bgColorAnchorRef} className="relative shrink-0">
              <button
                type="button"
                onPointerDown={handleColorTriggerPointerDown}
                onClick={() => toggleColor('bg')}
                title="Color de fondo sólido"
                aria-label="Color de fondo sólido"
                aria-expanded={openColor === 'bg'}
                className={`flex min-h-10 min-w-10 items-center justify-center rounded-lg border transition-all ${
                  openColor === 'bg'
                    ? 'ring-2 ring-indigo-400 ring-offset-1 dark:ring-offset-slate-800'
                    : ''
                } ${styles.bgColor
                  ? 'border-slate-300 bg-white shadow-xs dark:border-slate-600 dark:bg-slate-800'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
              >
                <ColorSwatchButton value={styles.bgColor} />
              </button>

              {openColor === 'bg' && (
                <ColorPalette
                  value={styles.bgColor}
                  swatches={SWATCHES}
                  onChange={(value) => updateStyle('bgColor', value)}
                  onClose={closeColor}
                  anchorRef={bgColorAnchorRef}
                  placement="below"
                  label="Colores de fondo"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {renderStyleGroup('Estilo de la Pregunta', 'q', 'question', qColorAnchorRef)}
        {renderStyleGroup('Estilo de la Respuesta', 'a', 'answer', aColorAnchorRef)}
      </div>
    </div>
  );
}
