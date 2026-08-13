// ARCHIVO: frontend/src/components/DeckModal.jsx
import { useState, useRef } from 'react';
import { X, Loader2, Check, Sparkles, Upload, ChevronLeft } from 'lucide-react';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';
import { DECK_COLOR_SWATCHES } from '../lib/deckColors';
import { generateCoverThumbnail } from '../lib/coverThumbnail';
import {
  createCoverThumbnailTracker,
  beginThumbnailGeneration,
  trackThumbnailPromise,
  isCurrentThumbnailToken,
  cancelThumbnailGeneration,
  resolveSubmitThumbnail,
} from '../lib/coverThumbnailTracker';
import { buildDeckCoverPayload } from '../lib/imageDelivery';

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function DeckModal({ initial, onClose, onSave, nameOnly = false, entityLabel = 'mazo' }) {
  const isEditing = Boolean(initial);
  const [title, setTitle] = useState(initial?.title || '');
  const [coverColor, setCoverColor] = useState(initial?.coverColor || '#ffffff');
  const [coverColorTouched, setCoverColorTouched] = useState(false);
  // coverImage guarda SIEMPRE la portada completa (para escrituras); la
  // miniatura es un campo aparte. En edición puede no existir portada completa
  // (el resumen ligero sólo trae coverImageThumb): la previsualización usa
  // coverImage || coverThumb y, si la portada no se toca, los campos de imagen
  // se omiten del payload para no sobrescribir la portada almacenada.
  const [coverImage, setCoverImage] = useState(initial?.coverImage || '');
  const [coverThumb, setCoverThumb] = useState(initial?.coverImageThumb || '');
  const [coverChanged, setCoverChanged] = useState(false);
  // Rastreador puro de generaciones de miniatura en curso: garantiza que una
  // generación obsoleta no escriba coverThumb ni sea esperada por el guardado.
  const thumbTrackerRef = useRef(null);
  if (thumbTrackerRef.current === null) {
    thumbTrackerRef.current = createCoverThumbnailTracker();
  }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('main'); // 'main' | 'customization'

  const keyboardHeight = useKeyboardHeight();
  const hasInitialCoverColor = typeof initial?.coverColor === 'string' && Boolean(initial.coverColor.trim());
  const previewCover = coverImage || coverThumb;
  const hasConfiguredCover = coverColorTouched || hasInitialCoverColor || Boolean(previewCover);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      setError('La imagen es muy grande (máx. 1.5MB).');
      return;
    }
    setError('');
    // Cada selección invalida cualquier generación anterior: sólo la última
    // puede actualizar el estado o guardarse.
    const token = beginThumbnailGeneration(thumbTrackerRef.current);
    try {
      // La portada completa queda disponible de inmediato; la miniatura se
      // genera después sin bloquear la previsualización.
      const base64 = await fileToBase64(file);
      if (!isCurrentThumbnailToken(thumbTrackerRef.current, token)) return;
      setCoverImage(base64);
      setCoverThumb('');
      setCoverChanged(true);
      const thumbPromise = generateCoverThumbnail(file).then((thumb) => {
        if (isCurrentThumbnailToken(thumbTrackerRef.current, token)) setCoverThumb(thumb);
        return thumb;
      });
      trackThumbnailPromise(thumbTrackerRef.current, token, thumbPromise);
      await thumbPromise;
    } catch {
      if (isCurrentThumbnailToken(thumbTrackerRef.current, token)) {
        setError('Error al procesar la imagen.');
      }
    }
  };

  const handleRemoveCover = () => {
    // Cancelación segura: invalida el token (la finalización tardía de una
    // miniatura pendiente no podrá restaurar coverThumb) y neutraliza la
    // promesa pendiente (el guardado no la esperará). coverChanged se
    // conserva true para que el payload envíe ambos campos vacíos.
    cancelThumbnailGeneration(thumbTrackerRef.current);
    setCoverImage('');
    setCoverThumb('');
    setCoverChanged(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError('');
    try {
      if (nameOnly) {
        await onSave({ title: title.trim() });
        return;
      }
      // Token vigente al iniciar el guardado: define el snapshot válido.
      const tracker = thumbTrackerRef.current;
      const submitToken = tracker.token;
      let thumb = coverThumb;
      if (coverChanged) {
        // Espera únicamente la promesa correspondiente a ese token. Si la
        // portada cambió durante la espera, el snapshot quedó obsoleto y el
        // intento se aborta por completo: no se construye payload de portada
        // ni se llama a onSave; el usuario puede guardar de nuevo el estado
        // actual (saving vuelve a false).
        const result = await resolveSubmitThumbnail(tracker, submitToken, coverThumb);
        if (result.aborted) {
          setSaving(false);
          return;
        }
        thumb = result.thumb;
      }
      const payload = { title: title.trim() };
      if (coverColorTouched) payload.coverColor = coverColor;
      Object.assign(
        payload,
        buildDeckCoverPayload({ isEditing, coverChanged, coverImage, coverThumb: thumb }),
      );
      await onSave(payload);
    } catch (err) {
      setError(err.message || `No se pudo guardar el ${entityLabel}.`);
      setSaving(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 z-[70] animate-[fadeIn_0.2s_ease]"
        onClick={onClose}
      />

      {/* Modal centrado con ajuste de teclado */}
      <div
        className="fixed inset-0 z-[80] flex items-center justify-center px-4 pointer-events-none"
        style={{ paddingBottom: keyboardHeight > 0 ? `${keyboardHeight}px` : '0' }}
      >
        <div
          className="bg-white rounded-3xl shadow-2xl w-full max-w-sm pointer-events-auto animate-[slideUp_0.3s_cubic-bezier(0.32,0.72,0,1)] transition-all duration-300 ease-out"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 bg-slate-300 rounded-full" />
          </div>

          {/* Contenido */}
          <div className="px-6 pb-6 pt-2">

            {/* ==================== VISTA PRINCIPAL ==================== */}
            {step === 'main' && (
              <div className="animate-[fadeIn_0.2s_ease]">
                {/* Header */}
                <div className="flex items-start justify-between mb-5">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-slate-900 mb-1">
                      {initial ? `Editar ${entityLabel}` : `Nuevo ${entityLabel}`}
                    </h3>
                    <p className="text-sm text-slate-600">
                      {initial ? `Modifica la información del ${entityLabel}` : `Crea un nuevo ${entityLabel}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center hover:bg-slate-200 active:scale-95 transition-all duration-200 flex-shrink-0 ml-3"
                  >
                    <X className="w-5 h-5 text-slate-600" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                  {/* Título */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Título del {entityLabel}
                    </label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ej: Biología 101"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck="false"
                      autoCapitalize="off"
                      enterKeyHint="done"
                      className="w-full text-base font-medium border-2 border-slate-200 rounded-2xl px-4 py-3.5 bg-slate-50 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 transition-all duration-200 placeholder:text-slate-400"
                    />
                  </div>

                  {!nameOnly && (
                    <button
                      type="button"
                      onClick={() => setStep('customization')}
                      disabled={saving}
                      className="w-full flex items-center justify-between p-4 border-2 border-slate-200 rounded-2xl hover:border-indigo-300 hover:bg-indigo-50/30 transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Sparkles className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-slate-900">Personalización avanzada</p>
                          <p className="text-xs text-slate-500">
                            {hasConfiguredCover
                              ? 'Color e imagen configurados'
                              : 'Color y portada opcionales'}
                          </p>
                        </div>
                      </div>
                      <ChevronLeft className="w-5 h-5 text-slate-400 rotate-180" />
                    </button>
                  )}

                  {/* Error */}
                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                      <p className="text-sm text-red-600 font-medium">{error}</p>
                    </div>
                  )}

                  {/* Botones */}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 h-12 border-2 border-slate-200 text-slate-700 font-semibold rounded-2xl hover:bg-slate-50 active:scale-[0.98] transition-all duration-200 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={saving || !title.trim()}
                      className="flex-1 h-12 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold rounded-2xl hover:from-indigo-700 hover:to-violet-700 active:scale-[0.98] transition-all duration-200 cursor-pointer shadow-lg shadow-indigo-500/25 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {saving ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> Guardando...</>
                      ) : (
                        <><Check className="w-5 h-5" /> Guardar</>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ==================== VISTA PERSONALIZACIÓN ==================== */}
            {step === 'customization' && (
              <div className="animate-[fadeIn_0.2s_ease]">
                {/* Header con botón volver */}
                <div className="flex items-center gap-3 mb-5">
                  <button
                    type="button"
                    onClick={() => setStep('main')}
                    className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center hover:bg-slate-200 active:scale-95 transition-all duration-200 flex-shrink-0"
                  >
                    <ChevronLeft className="w-5 h-5 text-slate-600" />
                  </button>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-slate-900 mb-0.5">Personalización</h3>
                    <p className="text-sm text-slate-600">Color e imagen de portada</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Color de portada */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                      Color de portada
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {DECK_COLOR_SWATCHES.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            setCoverColor(c);
                            setCoverColorTouched(true);
                          }}
                          aria-label={`Seleccionar color ${c}`}
                          aria-pressed={(coverColorTouched || hasInitialCoverColor) && coverColor === c}
                          style={{ backgroundColor: c }}
                          className={`w-12 h-12 rounded-xl border-2 transition-all duration-200 ${
                            (coverColorTouched || hasInitialCoverColor) && coverColor === c
                              ? 'ring-2 ring-offset-2 ring-indigo-500 border-white scale-105'
                              : 'border-white hover:scale-105'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
                        <input
                          type="color"
                          value={coverColor}
                          onChange={(e) => {
                            setCoverColor(e.target.value);
                            setCoverColorTouched(true);
                          }}
                          className="w-6 h-6 rounded cursor-pointer border border-slate-300"
                        />
                        Color personalizado
                      </label>
                    </div>
                  </div>

                  {/* Imagen de portada */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                      Imagen de portada <span className="text-slate-400 font-normal">(opcional)</span>
                    </label>
                    <label className={`flex items-center justify-center gap-2 cursor-pointer rounded-xl border-2 border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 hover:border-indigo-400 hover:bg-indigo-50/30 hover:text-indigo-600 transition-all duration-200 ${saving ? 'pointer-events-none opacity-50' : ''}`}>
                      <Upload className="w-5 h-5" />
                      {previewCover ? 'Cambiar imagen' : 'Subir imagen'}
                      <input type="file" accept="image/*" onChange={handleFile} disabled={saving} className="hidden" />
                    </label>
                    {previewCover && (
                      <div className="mt-3 flex items-center gap-3">
                        <img src={previewCover} alt="portada" className="w-14 h-14 rounded-xl object-cover border-2 border-white shadow-sm" />
                        <button
                          type="button"
                          onClick={handleRemoveCover}
                          disabled={saving}
                          className="text-sm text-red-600 font-medium hover:underline disabled:opacity-50 disabled:pointer-events-none"
                        >
                          Quitar imagen
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Botón Listo */}
                  <button
                    type="button"
                    onClick={() => setStep('main')}
                    className="w-full h-12 bg-slate-900 text-white font-semibold rounded-2xl hover:bg-slate-800 active:scale-[0.98] transition-all duration-200 cursor-pointer mt-2"
                  >
                    Listo
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
