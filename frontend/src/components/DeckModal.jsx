// ARCHIVO: frontend/src/components/DeckModal.jsx
import { useState, useEffect } from 'react';
import { X, ImagePlus, Loader2, Check, Palette, Upload } from 'lucide-react';

const COLOR_SWATCHES = [
  '#ffffff', '#fde68a', '#fca5a5', '#a7f3d0',
  '#93c5fd', '#c4b5fd', '#f9a8d4', '#1f2937',
];

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function DeckModal({ initial, onClose, onSave }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [coverColor, setCoverColor] = useState(initial?.coverColor || '#ffffff');
  const [coverImage, setCoverImage] = useState(initial?.coverImage || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Detección de teclado
  useEffect(() => {
    const handleResize = () => {
      if (window.visualViewport) {
        const viewportHeight = window.visualViewport.height;
        const windowHeight = window.innerHeight;
        const diff = windowHeight - viewportHeight;
        setKeyboardHeight(diff > 100 ? diff : 0);
      }
    };

    window.visualViewport?.addEventListener('resize', handleResize);
    return () => window.visualViewport?.removeEventListener('resize', handleResize);
  }, []);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      setError('La imagen es muy grande (máx. 1.5MB).');
      return;
    }
    setError('');
    setCoverImage(await fileToBase64(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError('');
    try {
      await onSave({ title: title.trim(), coverColor, coverImage });
    } catch (err) {
      setError(err.message || 'No se pudo guardar el mazo.');
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

      {/* Bottom Sheet */}
      <div 
        className="fixed inset-0 z-[80] flex items-center justify-center px-4 pointer-events-none"
        style={{
          paddingBottom: keyboardHeight > 0 ? `${keyboardHeight + 20}px` : '0'
        }}
      >
        <div 
          className="bg-white rounded-3xl shadow-2xl w-full max-w-sm pointer-events-auto animate-[slideUp_0.3s_cubic-bezier(0.32,0.72,0,1)] max-h-[85vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 bg-slate-300 rounded-full" />
          </div>

          {/* Contenido */}
          <div className="px-6 pb-6 pt-2">
            {/* Header */}
            <div className="flex items-start justify-between mb-5">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-slate-900 mb-1">
                  {initial ? 'Editar mazo' : 'Nuevo mazo'}
                </h3>
                <p className="text-sm text-slate-600">
                  {initial ? 'Modifica la información del mazo' : 'Crea un nuevo mazo de flashcards'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center hover:bg-slate-200 active:scale-95 transition-all duration-200 flex-shrink-0 ml-3"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Título */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Título del mazo
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Biología 101"
                  className="w-full text-base font-medium border-2 border-slate-200 rounded-2xl px-4 py-3.5 bg-slate-50 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 transition-all duration-200 placeholder:text-slate-400"
                />
              </div>

              {/* Color de portada - Compacto */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Color de portada
                </label>
                <button
                  type="button"
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className="w-full flex items-center gap-3 p-3 border-2 border-slate-200 rounded-2xl hover:border-indigo-300 hover:bg-indigo-50/30 transition-all duration-200"
                >
                  <div 
                    className="w-10 h-10 rounded-xl border-2 border-white shadow-sm flex-shrink-0"
                    style={{ backgroundColor: coverColor }}
                  />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-slate-900">
                      {showColorPicker ? 'Selecciona un color' : 'Color actual'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {showColorPicker ? 'Toca para cerrar' : coverColor.toUpperCase()}
                    </p>
                  </div>
                  <Palette className="w-5 h-5 text-slate-400" />
                </button>

                {/* Selector de colores */}
                {showColorPicker && (
                  <div className="mt-3 p-3 bg-slate-50 rounded-2xl border border-slate-200 animate-[fadeIn_0.2s_ease]">
                    <div className="grid grid-cols-4 gap-2">
                      {COLOR_SWATCHES.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => { setCoverColor(c); setShowColorPicker(false); }}
                          style={{ backgroundColor: c }}
                          className={`w-12 h-12 rounded-xl border-2 transition-all duration-200 ${
                            coverColor === c 
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
                          onChange={(e) => { setCoverColor(e.target.value); setShowColorPicker(false); }}
                          className="w-6 h-6 rounded cursor-pointer border border-slate-300"
                        />
                        Color personalizado
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Imagen de portada */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Imagen de portada <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 flex items-center justify-center gap-2 cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 hover:border-indigo-400 hover:bg-indigo-50/30 hover:text-indigo-600 transition-all duration-200">
                    <Upload className="w-5 h-5" />
                    {coverImage ? 'Cambiar imagen' : 'Subir imagen'}
                    <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
                  </label>
                  {coverImage && (
                    <div className="relative">
                      <img src={coverImage} alt="portada" className="w-16 h-16 rounded-xl object-cover border-2 border-white shadow-sm" />
                      <button 
                        type="button" 
                        onClick={() => setCoverImage('')} 
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 active:scale-95 transition-all shadow-sm"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

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
        </div>
      </div>
    </>
  );
}

