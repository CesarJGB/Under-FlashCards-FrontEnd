import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import ActionSheet from '../../common/ActionSheet';
import { CardFrame } from '../LivePreview';

const normalizeSide = (side) => (side === 'answer' ? 'answer' : 'question');

export default function ImageActionSheet({
  open,
  initialSide,
  originalImage,
  originalSide,
  question,
  answer,
  styles,
  textAlign,
  portalTarget,
  beginPicker,
  markPickerExternal,
  updatePickerDraft,
  commitPicker,
  cancelPicker,
  onApply,
  onClose,
}) {
  const [draftSide, setDraftSide] = useState(() => normalizeSide(initialSide));
  const [draftFile, setDraftFile] = useState(null);
  const [draftUrl, setDraftUrl] = useState('');
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState('');
  const objectUrlRef = useRef('');
  const transactionIdRef = useRef(null);
  const pointerTransactionRef = useRef(false);
  const appliedRef = useRef(false);

  const releaseObjectUrl = () => {
    if (!objectUrlRef.current) return;
    URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = '';
  };

  useEffect(() => () => releaseObjectUrl(), []);

  const beginNativeSelection = () => {
    const transactionId = beginPicker?.('image');
    transactionIdRef.current = transactionId ?? null;
    return transactionId;
  };

  const handleFilePointerDown = (event) => {
    if (event.isPrimary === false || (typeof event.button === 'number' && event.button !== 0)) return;
    pointerTransactionRef.current = true;
    beginNativeSelection();
  };

  const handleFileClick = () => {
    const transactionId = pointerTransactionRef.current
      ? transactionIdRef.current
      : beginNativeSelection();
    pointerTransactionRef.current = false;
    if (transactionId != null) markPickerExternal?.(transactionId);
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      setError('Selecciona un archivo de imagen válido.');
      return;
    }
    let transactionId = transactionIdRef.current;
    if (transactionId == null) transactionId = beginNativeSelection();
    if (transactionId != null) {
      updatePickerDraft?.(transactionId, { type: file.type, size: file.size });
    }
    releaseObjectUrl();
    const nextUrl = URL.createObjectURL(file);
    objectUrlRef.current = nextUrl;
    setDraftFile(file);
    setDraftUrl(nextUrl);
    setRemoved(false);
    setError('');
    event.target.value = '';
  };

  const handleNativeCancel = () => {
    const transactionId = transactionIdRef.current;
    if (transactionId != null) cancelPicker?.(transactionId);
    transactionIdRef.current = null;
    pointerTransactionRef.current = false;
  };

  const cancel = (reason = 'cancel') => {
    handleNativeCancel();
    onClose?.(reason);
  };

  const apply = () => {
    if (appliedRef.current) return;
    appliedRef.current = true;
    const transactionId = transactionIdRef.current;
    if (transactionId != null) {
      commitPicker?.(transactionId, draftFile
        ? { type: draftFile.type, size: draftFile.size }
        : null);
      transactionIdRef.current = null;
    }
    onApply?.({ file: draftFile, side: draftSide, removed });
  };

  const previewImage = removed ? '' : (draftUrl || originalImage || '');

  return (
    <ActionSheet
      open={open}
      title="Imagen de la tarjeta"
      onClose={(reason) => cancel(reason)}
      compact
      portalTarget={portalTarget}
      footer={(
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => cancel('cancel')}
            className="min-h-11 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            data-testid="image-sheet-cancel"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={apply}
            className="min-h-11 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white dark:bg-white dark:text-slate-900"
            data-testid="image-sheet-apply"
          >
            Aplicar
          </button>
        </div>
      )}
    >
      <div
        className="space-y-3"
        data-image-sheet="true"
        data-original-side={originalSide || ''}
        data-draft-side={draftSide}
        data-has-draft-file={draftFile ? 'true' : 'false'}
      >
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="group" aria-label="Destino de la imagen">
          {[
            ['question', 'Pregunta'],
            ['answer', 'Respuesta'],
          ].map(([side, label]) => (
            <button
              key={side}
              type="button"
              aria-pressed={draftSide === side}
              onClick={() => setDraftSide(side)}
              className={`min-h-11 rounded-lg px-3 text-sm font-bold transition-colors ${draftSide === side
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 dark:text-slate-300'}`}
              data-testid={`image-sheet-side-${side}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/60">
          {previewImage ? (
            <CardFrame
              question={question}
              answer={answer}
              bgImage=""
              textAlign={textAlign}
              styles={styles}
              contentImage={previewImage}
              imageSide={draftSide}
            />
          ) : (
            <div className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-center dark:border-slate-600 dark:bg-slate-900">
              <ImagePlus className="h-7 w-7 text-slate-400" aria-hidden="true" />
              <span className="mt-2 text-sm font-bold text-slate-600 dark:text-slate-200">Sin imagen</span>
              <span className="mt-1 text-xs text-slate-400">Selecciona una para previsualizarla.</span>
            </div>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="relative flex min-h-11 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm focus-within:ring-2 focus-within:ring-indigo-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
            <ImagePlus className="h-4 w-4" aria-hidden="true" />
            <span>{previewImage ? 'Cambiar imagen' : 'Seleccionar imagen'}</span>
            <input
              type="file"
              accept="image/*"
              aria-label={previewImage ? 'Cambiar imagen' : 'Seleccionar imagen'}
              data-native-image-input="true"
              data-testid="image-sheet-file-input"
              onPointerDown={handleFilePointerDown}
              onClick={handleFileClick}
              onChange={handleFileChange}
              onCancel={handleNativeCancel}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>

          {previewImage && (
            <button
              type="button"
              onClick={() => {
                releaseObjectUrl();
                setDraftUrl('');
                setDraftFile(null);
                setRemoved(true);
                setError('');
              }}
              className="min-h-11 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
              data-testid="image-sheet-remove"
            >
              <span className="inline-flex items-center gap-2"><Trash2 className="h-4 w-4" aria-hidden="true" /> Eliminar imagen</span>
            </button>
          )}
        </div>
        {error && <p role="alert" className="text-xs font-semibold text-rose-600">{error}</p>}
      </div>
    </ActionSheet>
  );
}
