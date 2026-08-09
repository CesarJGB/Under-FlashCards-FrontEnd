import { useRef, useState } from 'react';
import ActionSheet from '../../common/ActionSheet';
import { hexToHsl, hslToHex, normalizeHexColor } from './colorUtils';

function ColorRange({ label, value, min, max, gradient, onChange, valueText }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
        <span>{label}</span>
        <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{valueText}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        aria-label={label}
        aria-valuetext={valueText}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-11 w-full cursor-pointer accent-slate-900 dark:accent-white"
        style={{ background: gradient }}
      />
    </label>
  );
}

export default function CustomColorActionSheet({
  open,
  originalColor,
  fallbackColor = '#0f172a',
  targetLabel,
  portalTarget,
  onApply,
  onClose,
}) {
  const normalizedOriginal = normalizeHexColor(originalColor);
  const initialHex = normalizedOriginal || normalizeHexColor(fallbackColor) || '#0f172a';
  const [draft, setDraft] = useState(() => hexToHsl(initialHex));
  const [hexInput, setHexInput] = useState(initialHex);
  const [previewHex, setPreviewHex] = useState(initialHex);
  const [hexError, setHexError] = useState('');
  const appliedRef = useRef(false);
  const draftRef = useRef(draft);
  const draftHex = previewHex;

  const updateDraft = (field, value) => {
    const next = { ...draftRef.current, [field]: value };
    const nextHex = hslToHex(next.h, next.s, next.l);
    draftRef.current = next;
    setDraft(next);
    setHexInput(nextHex);
    setPreviewHex(nextHex);
    setHexError('');
  };

  const handleHexChange = (event) => {
    const rawValue = event.target.value;
    setHexInput(rawValue);
    const normalized = normalizeHexColor(rawValue);
    if (!normalized) {
      setHexError('Escribe un color hexadecimal válido, por ejemplo #13579b.');
      return;
    }
    setHexError('');
    const nextDraft = hexToHsl(normalized);
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    setHexInput(normalized);
    setPreviewHex(normalized);
  };

  const apply = () => {
    const normalized = normalizeHexColor(hexInput);
    if (!normalized) {
      setHexError('Escribe un color hexadecimal válido, por ejemplo #13579b.');
      return;
    }
    if (appliedRef.current) return;
    appliedRef.current = true;
    onApply?.(normalized);
  };

  return (
    <ActionSheet
      open={open}
      title="Color personalizado"
      onClose={onClose}
      compact
      portalTarget={portalTarget}
      footer={(
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onClose?.('cancel')}
            className="min-h-11 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            data-testid="custom-color-cancel"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={apply}
            className="min-h-11 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white dark:bg-white dark:text-slate-900"
            data-testid="custom-color-apply"
          >
            Aplicar
          </button>
        </div>
      )}
    >
      <div
        className="space-y-3"
        data-custom-color-sheet="true"
        data-original-color={normalizedOriginal || ''}
        data-draft-color={draftHex}
        data-target-label={targetLabel}
      >
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Se aplicará a {targetLabel || 'la tarjeta'} solo cuando pulses Aplicar.
        </p>

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <div
            className="flex min-h-24 items-end rounded-2xl border border-black/10 p-3 shadow-inner"
            style={{ backgroundColor: draftHex }}
            data-testid="custom-color-preview"
          >
            <span className="rounded-lg bg-black/55 px-2 py-1 font-mono text-xs font-bold text-white">
              {draftHex}
            </span>
          </div>
          <div className="flex min-w-20 flex-col items-center justify-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Anterior</span>
            <span
              className="h-10 w-10 rounded-xl border border-slate-300 shadow-sm dark:border-slate-600"
              style={{ backgroundColor: normalizedOriginal || fallbackColor }}
              data-testid="custom-color-original"
            />
            <span className="font-mono text-[10px] text-slate-500">{normalizedOriginal || 'Por defecto'}</span>
          </div>
        </div>

        <div className="space-y-1 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-800/70">
          <ColorRange
            label="Tono"
            min={0}
            max={359}
            value={draft.h}
            valueText={`${draft.h} grados`}
            gradient="linear-gradient(90deg,#ef4444,#eab308,#22c55e,#06b6d4,#3b82f6,#a855f7,#ef4444)"
            onChange={(value) => updateDraft('h', value)}
          />
          <ColorRange
            label="Saturación"
            min={0}
            max={100}
            value={draft.s}
            valueText={`${draft.s}%`}
            gradient={`linear-gradient(90deg,hsl(${draft.h} 0% ${draft.l}%),hsl(${draft.h} 100% ${draft.l}%))`}
            onChange={(value) => updateDraft('s', value)}
          />
          <ColorRange
            label="Luminosidad"
            min={0}
            max={100}
            value={draft.l}
            valueText={`${draft.l}%`}
            gradient={`linear-gradient(90deg,#000,hsl(${draft.h} ${draft.s}% 50%),#fff)`}
            onChange={(value) => updateDraft('l', value)}
          />
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-200">Hexadecimal</span>
          <input
            type="text"
            inputMode="text"
            autoCapitalize="off"
            spellCheck="false"
            value={hexInput}
            onChange={handleHexChange}
            aria-invalid={Boolean(hexError)}
            aria-describedby={hexError ? 'custom-color-hex-error' : undefined}
            className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-base text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            data-testid="custom-color-hex"
          />
        </label>
        {hexError && (
          <p id="custom-color-hex-error" role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-300">
            {hexError}
          </p>
        )}
      </div>
    </ActionSheet>
  );
}
