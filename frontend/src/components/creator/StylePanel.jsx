// ARCHIVO: frontend/src/components/creator/StylePanel.jsx
import { useState } from 'react';
import { ImagePlus, Plus, Minus, Bold, Italic, Palette, Pipette } from 'lucide-react';

function ColorPalette({ value, swatches, onChange, onClose, compact = false, placement = 'above', label }) {
  const palette = (
    <div
      className={[
        'grid grid-cols-4 gap-2 w-[168px] p-2 rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800',
        compact
          ? 'relative mt-2 self-end'
          : placement === 'above'
            ? 'absolute right-0 bottom-full mb-2 z-[65]'
            : 'absolute right-0 top-full mt-2 z-[65]',
      ].join(' ')}
      aria-label={label}
    >
      {swatches.map((color) => (
        <button
          key={color.value}
          type="button"
          title={color.label}
          aria-label={color.label}
          aria-pressed={value === color.value}
          onClick={() => {
            onChange(color.value);
            onClose?.();
          }}
          style={color.value ? { backgroundColor: color.value } : {}}
          className={`relative min-h-9 min-w-9 rounded-xl border transition-all ${
            value === color.value
              ? 'scale-110 ring-2 ring-slate-900 ring-offset-1 dark:ring-slate-100'
              : 'border-slate-200 hover:scale-105 dark:border-slate-600'
          } ${!color.value ? 'bg-slate-100 after:absolute after:inset-0 after:flex after:items-center after:justify-center after:text-xs after:font-bold after:text-slate-500 after:content-["×"] dark:bg-slate-700 dark:after:text-slate-300' : ''}`}
        />
      ))}

      <label
        className="relative flex min-h-9 min-w-9 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-slate-300 bg-gradient-to-tr from-amber-400 via-rose-400 to-indigo-400 shadow-xs transition-transform hover:scale-105 dark:border-slate-600"
        title="Color personalizado"
        aria-label="Color personalizado"
      >
        <Pipette className="relative z-10 h-3.5 w-3.5 text-white drop-shadow-xs" aria-hidden="true" />
        <input
          type="color"
          value={value && value.startsWith('#') ? value : '#ffffff'}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 z-0 scale-150 cursor-pointer opacity-0"
          aria-label={`Elegir ${label || 'color'}`}
        />
      </label>
    </div>
  );

  if (compact) return palette;

  return (
    <>
      <div className="fixed inset-0 z-[60]" onClick={onClose} aria-hidden="true" />
      {palette}
    </>
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
  const [qColorOpen, setQColorOpen] = useState(false);
  const [aColorOpen, setAColorOpen] = useState(false);
  const [bgColorOpen, setBgColorOpen] = useState(false);

  const renderStyleGroup = (title, prefix, colorOpen, setColorOpen) => {
    const sizeKey = `${prefix}Size`;
    const boldKey = `${prefix}Bold`;
    const italicKey = `${prefix}Italic`;
    const colorKey = `${prefix}Color`;
    const currentSizeNum = Number(styles[sizeKey]) || 16;

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

            <div className={compact ? 'relative flex flex-col items-end' : 'relative'}>
              <button
                type="button"
                onClick={() => setColorOpen(!colorOpen)}
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
                  onClose={() => setColorOpen(false)}
                  compact={compact}
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
          <div className="flex items-center justify-center gap-2">
            <label className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
              <ImagePlus className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" /> <span>Imagen</span>
              <input type="file" accept="image/*" onChange={handleBgFile} className="hidden" />
            </label>
            {bgImage && <button type="button" onClick={() => setBgImage('')} className="min-h-10 shrink-0 px-1 text-xs text-red-600 hover:underline dark:text-red-400">Quitar</button>}

            <div className="w-[1px] h-5 bg-slate-200 mx-0.5 shrink-0" />

            <div className={compact ? 'relative flex flex-col items-end' : 'relative'}>
              <button
                type="button"
                onClick={() => setBgColorOpen(!bgColorOpen)}
                style={styles.bgColor ? { backgroundColor: styles.bgColor } : {}}
                title="Color de fondo sólido"
                aria-label="Color de fondo sólido"
                aria-expanded={bgColorOpen}
                className={`flex min-h-10 min-w-10 items-center justify-center rounded-lg border transition-all ${
                  styles.bgColor ? 'border-transparent text-white shadow-xs' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                <Palette className="h-3.5 w-3.5" aria-hidden="true" />
              </button>

              {bgColorOpen && (
                <ColorPalette
                  value={styles.bgColor}
                  swatches={SWATCHES}
                  onChange={(value) => updateStyle('bgColor', value)}
                  onClose={() => setBgColorOpen(false)}
                  compact={compact}
                  placement="below"
                  label="Colores de fondo"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {renderStyleGroup('Estilo de la Pregunta', 'q', qColorOpen, setQColorOpen)}
        {renderStyleGroup('Estilo de la Respuesta', 'a', aColorOpen, setAColorOpen)}
      </div>
    </div>
  );
}
