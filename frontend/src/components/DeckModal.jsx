// ARCHIVO: frontend/src/components/DeckModal.jsx
import { useState, useEffect, useRef } from 'react';
import { X, ImagePlus, Loader2, Check, Sparkles, Upload, ChevronDown, ChevronUp } from 'lucide-react';

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
  const [showCustomization, setShowCustomization] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0); // Regresamos al estado local para control fino
  const titleInputRef = useRef(null);

  // Detección base del teclado
  useEffect(() => {
    const handleVisualViewportResize = () => {
      if (!window.visualViewport) return;
      
      const currentHeight = window.visualViewport.height < window.innerHeight 
        ? window.innerHeight - window.visualViewport.height 
        : 0;
      
      setKeyboardHeight(currentHeight > 150 ? currentHeight : 0);
    };

    handleVisualViewportResize();
    
    window.visualViewport?.addEventListener('resize', handleVisualViewportResize);
    return () => window.visualViewport?.removeEventListener('resize', handleVisualViewportResize);
  }, []);

  // Enfocar el input automáticamente al abrir el modal
  useEffect(() => {
    const timer = setTimeout(() => {
      titleInputRef.current?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  // Foco optimizado con retraso coordinado para evitar brincos visuales
  const handleTitleFocus = () => {
    setShowCustomization(false);
    
    // El colapso toma ~300ms por la transición CSS y el teclado ~200ms en aparecer.
    // Recalculamos justo después de que ambos eventos terminen.
    setTimeout(() => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.clientHeight;
      const diff = windowHeight - documentHeight;
      setKeyboardHeight(diff > 80 ? diff : 0);
    }, 350);
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      setError('La imagen es muy grande (máx. 1.5MB).');
      return;
    }
    setError('');
    try {
      const base64 = await fileToBase64(file);
      setCoverImage(base64);
    } catch (err) {
      setError('Error al procesar la imagen.');
    }
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

      {/* Bottom Sheet con ajuste dinámico */}
      <div 
        className="fixed inset-0 z-[80] flex items-center justify-center px-4 pointer-events-none"
        style={{
          paddingBottom: keyboardHeight > 0 ? `${keyboardHeight}px` : '0'
        }}
      >
        {/* Contenedor del Modal con Transición suave animada */}
        <div 
          className="bg-white rounded-3xl shadow-2xl w-full max-w-sm pointer-events-auto animate-[slideUp_0.3s_cubic-bezier(0.32,0.72,0,1)] max-h-[80vh] overflow-y-auto transition-all duration-300 ease-out"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Handle estético visual */}
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
                  Título del mazo
                </label>
                <input
                  ref={titleInputRef}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onFocus={handleTitleFocus}
                  placeholder="Ej: Biología 101"
                  className="w-full text-base font-medium border-2 border-slate-200 rounded-2xl px-4 py-3.5 bg-slate-50 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 transition-all duration-200 placeholder:text-slate-400"
                />
              </div>

              {/* Botón de Personalización Avanzada */}
              <button
                type="button"
                onClick={() => setShowCustomization(!showCustomization)}
                className="w-full flex items-center justify-between p-4 border-2 border-slate-200 rounded-2xl hover:border-indigo-300 hover:bg-indigo-50/30 transition-all duration-200"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-slate-900">Personalización avanzada</p>
                    <p className="text-xs text-slate-500">
                      {coverColor !== '#ffffff' || coverImage ? 'Color e imagen configurados' : 'Color y portada opcionales'}
                    </p>
                  </div>
                </div>
                {showCustomization ? (
                  <ChevronUp className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
              </button>

              {/* Sección de Personalización */}
              {showCustomization && (
                <div className="space-y-3 animate-[fadeIn_0.2s_ease]">
                  
                  {/* Color de portada */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                      Color de portada
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {COLOR_SWATCHES.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCoverColor(c)}
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
                          onChange={(e) => setCoverColor(e.target.value)}
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
                    <label className="flex items-center justify-center gap-2 cursor-pointer rounded-xl border-2 border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 hover:border-indigo-400 hover:bg-indigo-50/30 hover:text-indigo-600 transition-all duration-200">
                      <Upload className="w-5 h-5" />
                      {coverImage ? 'Cambiar imagen' : 'Subir imagen'}
                      <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
                    </label>
                    {coverImage && (
                      <div className="mt-3 flex items-center gap-3">
                        <img src={coverImage} alt="portada" className="w-14 h-14 rounded-xl object-cover border-2 border-white shadow-sm" />
                        <button 
                          type="button" 
                          onClick={() => setCoverImage('')} 
                          className="text-sm text-red-600 font-medium hover:underline"
                        >
                          Quitar imagen
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm text-red-600 font-medium">{error}</p>
                </div>
              )}

              {/* Botones de acción */}
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
