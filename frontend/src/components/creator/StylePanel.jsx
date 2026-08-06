// ARCHIVO: frontend/src/components/creator/StylePanel.jsx
import { createPortal } from 'react-dom';
import { useLayoutEffect, useRef, useState } from 'react';
import { ImagePlus, Plus, Minus, Bold, Italic, Palette, Pipette, X, Check, CircleOff } from 'lucide-react';

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

function ColorPalette({ value, swatches, onChange, onClose, anchorRef, placement = 'above', label, title }) {
  const paletteRef = useRef(null);
  const colorInputRef = useRef(null);
  const [position, setPosition] = useState(null);
  const normalizedValue = value || '';
  const colorInputValue = toColorInputValue(normalizedValue);
  const initialColorInputValue = useRef(colorInputValue);
  const selectedSwatch = swatches.find((swatch) => swatch.value === normalizedValue);
  const currentLabel = selectedSwatch?.label || (value ? 'Personalizado' : 'Predeterminado');
  const isCustomColor = Boolean(normalizedValue) && !selectedSwatch;

  useLayoutEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;

    let frameId = 0;

    const measure = () => {
      frameId = 0;

      const anchor = anchorRef?.current;
      const palette = paletteRef.current;
      if (!anchor || !palette) return;

      const anchorRect = anchor.getBoundingClientRect();
      const paletteRect = palette.getBoundingClientRect();
      const dialogRect = anchor.closest('[role="dialog"]')?.getBoundingClientRect();

      const minLeft = Math.max(VIEWPORT_MARGIN, dialogRect?.left ?? VIEWPORT_MARGIN);
      const maxRight = Math.min(window.innerWidth - VIEWPORT_MARGIN, dialogRect?.right ?? window.innerWidth - VIEWPORT_MARGIN);
      const minTop = Math.max(VIEWPORT_MARGIN, dialogRect?.top ?? VIEWPORT_MARGIN);
      const maxBottom = Math.min(window.innerHeight - VIEWPORT_MARGIN, dialogRect?.bottom ?? window.innerHeight - VIEWPORT_MARGIN);

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

      setPosition({ left: Math.round(left), top: Math.round(top) });
    };

    const updatePosition = () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(measure);
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.visualViewport?.addEventListener('resize', updatePosition);
    window.visualViewport?.addEventListener('scroll', updatePosition);
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
      window.removeEventListener('resize', updatePosition);
      window.visualViewport?.removeEventListener('resize', updatePosition);
      window.visualViewport?.removeEventListener('scroll', updatePosition);
      document.removeEventListener('scroll', updatePosition, true);
      resizeObserver?.disconnect();
    };
  }, [anchorRef, placement]);

  if (typeof document === 'undefined') return null;

  const palette = (
    <div
      ref={paletteRef}
      data-color-palette="true"
      role="dialog"
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onClose?.();
        }
      }}
      className="fixed z-[120] w-[204px] max-w-[calc(100vw-1rem)] rounded-[20px] border border-slate-200/90 bg-white p-2.5 shadow-[0_18px_42px_-18px_rgba(15,23,42,0.42)] ring-1 ring-black/5 animate-[slideUp_0.12s_ease-out] dark:border-slate-700 dark:bg-slate-800 dark:ring-white/5"
      style={{
        left: `${position?.left ?? 0}px`,
        top: `${position?.top ?? 0}px`,
        visibility: position ? 'visible' : 'hidden',
      }}
    >
      <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
        <span className="min-w-0 truncate text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</span>
        <span className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500">
          <span
            style={normalizedValue ? { backgroundColor: normalizedValue } : undefined}
            className="h-3.5 w-3.5 shrink-0 rounded-md border border-slate-200 bg-slate-100 shadow-inner dark:border-slate-600 dark:bg-slate-700"
            aria-hidden="true"
          />
          <span className="max-w-[90px] truncate">{currentLabel}</span>
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2" role="group" aria-label="Colores disponibles">
        {swatches.map((color) => {
          const isSelected = normalizedValue === color.value;
          const isLight = !color.value || color.value.toLowerCase() === '#ffffff';

          return (
            <button
              key={color.value || 'default'}
              type="button"
              title={color.label}
              aria-label={color.label}
              aria-pressed={isSelected}
              onClick={() => {
                onChange(color.value);
                onClose?.();
              }}
              style={color.value ? { backgroundColor: color.value } : undefined}
              className={`relative flex aspect-square min-w-0 items-center justify-center rounded-[13px] border transition-[box-shadow,transform,filter] duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${
                isSelected
                  ? 'border-transparent ring-2 ring-slate-900 ring-offset-2 dark:ring-slate-100'
                  : 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-600'
              } ${!color.value ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
            >
              {color.value ? null : <CircleOff className="h-4 w-4 text-slate-500 dark:text-slate-300" aria-hidden="true" />}
              {isSelected && (
                <span className={`absolute inset-0 flex items-center justify-center rounded-[13px] ${isLight ? 'bg-slate-900/5' : 'bg-black/10'}`}>
                  <Check className={`h-4 w-4 stroke-[3] ${isLight ? 'text-slate-700 dark:text-slate-200' : 'text-white drop-shadow-sm'}`} aria-hidden="true" />
                </span>
              )}
            </button>
          );
        })}

        <label
          style={isCustomColor ? { backgroundColor: value } : undefined}
          className={`relative flex aspect-square min-w-0 cursor-pointer items-center justify-center overflow-hidden rounded-[13px] border shadow-xs transition-[box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-md focus-within:ring-2 focus-within:ring-indigo-400 focus-within:ring-offset-2 dark:border-slate-600 dark:focus-within:ring-offset-slate-800 ${isCustomColor ? 'border-transparent ring-2 ring-slate-900 ring-offset-2 dark:ring-slate-100' : 'border-slate-300 bg-gradient-to-tr from-amber-400 via-rose-400 to-indigo-400'}`}
          title="Color personalizado"
          aria-label="Color personalizado"
        >
          {isCustomColor ? (
            <Check className="relative z-10 h-4 w-4 stroke-[3] text-white drop-shadow-sm" aria-hidden="true" />
          ) : (
            <Pipette className="relative z-10 h-4 w-4 text-white drop-shadow-sm" aria-hidden="true" />
          )}
        <input
          ref={colorInputRef}
          type="color"
          // Debe ser no controlado: en iOS, volver a escribir `value` mientras
          // el selector nativo está abierto puede cerrarlo tras el primer cambio.
          defaultValue={initialColorInputValue.current}
          onPointerDown={() => {
            // Sincroniza el valor sólo justo antes de abrir el selector. Durante
            // la edición no se toca el DOM, así el selector puede emitir todos
            // sus cambios intermedios sin reiniciarse.
            if (colorInputRef.current && colorInputRef.current.value !== colorInputValue) {
              colorInputRef.current.value = colorInputValue;
            }
          }}
          onFocus={() => {
            if (colorInputRef.current && colorInputRef.current.value !== colorInputValue) {
              colorInputRef.current.value = colorInputValue;
            }
          }}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0"
          aria-label={`Elegir ${label || 'color'}`}
        />
        </label>
      </div>
    </div>
  );

  return createPortal(
    <>
      <button
        type="button"
        tabIndex={-1}
        className="fixed inset-0 z-[110] cursor-default bg-transparent"
        onClick={onClose}
        aria-label="Cerrar paleta de colores"
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

  const closeColor = () => {
    const activeColor = openColor;
    setOpenColor(null);

    // Mantiene el teclado/foco en el control que abrió la paleta, no en el
    // backdrop portalizado.
    window.requestAnimationFrame(() => {
      const anchor = activeColor === 'question'
        ? qColorAnchorRef.current
        : activeColor === 'answer'
          ? aColorAnchorRef.current
          : bgColorAnchorRef.current;
      anchor?.querySelector('button')?.focus();
    });
  };

  const toggleColor = (colorId) => {
    setOpenColor((current) => (current === colorId ? null : colorId));
  };

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
                onClick={() => toggleColor(colorId)}
                style={styles[colorKey] ? { backgroundColor: styles[colorKey] } : {}}
                aria-label={`Color de ${title.toLowerCase()}`}
                aria-expanded={colorOpen}
                className={`flex min-h-10 min-w-10 items-center justify-center rounded-lg border transition-all ${styles[colorKey] ? 'border-transparent text-white shadow-xs' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
              >
                <Palette className="h-3.5 w-3.5" aria-hidden="true" />
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
                  title={title.replace(/^Estilo de la /i, '')}
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
                onClick={() => toggleColor('bg')}
                style={styles.bgColor ? { backgroundColor: styles.bgColor } : {}}
                title="Color de fondo sólido"
                aria-label="Color de fondo sólido"
                aria-expanded={openColor === 'bg'}
                className={`flex min-h-10 min-w-10 items-center justify-center rounded-lg border transition-all ${
                  styles.bgColor ? 'border-transparent text-white shadow-xs' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                <Palette className="h-3.5 w-3.5" aria-hidden="true" />
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
                  title="Fondo"
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
