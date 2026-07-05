// ARCHIVO: frontend/src/components/library/AcademicFolderModal.jsx
import React, { useEffect, useState, useRef } from 'react';
import { X } from 'lucide-react';

export default function AcademicFolderModal({ 
  academicModal, academicInput, setAcademicInput, 
  setAcademicModal, handleCreateAcademicFolder 
}) {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const titleInputRef = useRef(null);

  const calculateKeyboardHeight = () => {
    if (!window.visualViewport) return 0;
    const diff = window.innerHeight - window.visualViewport.height;
    // Si la diferencia es significativa, es el teclado
    return diff > 150 ? diff : 0;
  };

  // Escuchar cambios de redimensionamiento del viewport (ej. rotación o teclado dinámico)
  useEffect(() => {
    const handleResize = () => {
      setKeyboardHeight(calculateKeyboardHeight());
    };

    window.visualViewport?.addEventListener('resize', handleResize);
    return () => window.visualViewport?.removeEventListener('resize', handleResize);
  }, []);

  // Calcular al montar para mitigar desfases iniciales
  useEffect(() => {
    const timer = setTimeout(() => {
      setKeyboardHeight(calculateKeyboardHeight());
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Ajustar la altura cuando el input recibe el foco
  const handleInputFocus = () => {
    setTimeout(() => {
      setKeyboardHeight(calculateKeyboardHeight());
    }, 300);
  };

  const getTypeName = (type) => {
    const names = {
      materia: 'materia',
      tema: 'tema',
      subtema: 'subtema'
    };
    return names[type] || 'carpeta';
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/40 z-[70] animate-[fadeIn_0.2s_ease]"
        onClick={() => { setAcademicModal(null); setAcademicInput(''); }}
      />

      {/* Modal con ajuste dinámico */}
      <div 
        className="fixed inset-0 z-[80] flex items-center justify-center px-4 pointer-events-none"
        style={{
          paddingBottom: keyboardHeight > 0 ? `${keyboardHeight + 20}px` : '0'
        }}
      >
        <div 
          className="bg-white rounded-3xl shadow-2xl w-full max-w-sm pointer-events-auto animate-[slideUp_0.3s_cubic-bezier(0.32,0.72,0,1)] max-h-[80vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Contenido */}
          <div className="px-6 pb-6 pt-5">
            {/* Header */}
            <div className="flex items-start justify-between mb-5">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-slate-900 mb-1">
                  Crear nueva {getTypeName(academicModal.type)}
                </h3>
                <p className="text-sm text-slate-600">
                  Ingresa el nombre para organizar tu contenido
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setAcademicModal(null); setAcademicInput(''); }}
                className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center hover:bg-slate-200 active:scale-95 transition-all duration-200 flex-shrink-0 ml-3"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleCreateAcademicFolder} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Nombre
                </label>
                <input 
                  ref={titleInputRef}
                  type="text" 
                  autoFocus 
                  required 
                  onFocus={handleInputFocus}
                  placeholder={`Ej: Matemáticas ${getTypeName(academicModal.type) === 'materia' ? 'Avanzadas' : '1'}`} 
                  value={academicInput} 
                  onChange={(e) => setAcademicInput(e.target.value)} 
                  className="w-full text-base font-medium border-2 border-slate-200 rounded-2xl px-4 py-3.5 bg-slate-50 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 transition-all duration-200 placeholder:text-slate-400" 
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => { setAcademicModal(null); setAcademicInput(''); }} 
                  className="flex-1 h-12 border-2 border-slate-200 text-slate-700 font-semibold rounded-2xl hover:bg-slate-50 active:scale-[0.98] transition-all duration-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-1 h-12 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold rounded-2xl hover:from-indigo-700 hover:to-violet-700 active:scale-[0.98] transition-all duration-200 cursor-pointer shadow-lg shadow-indigo-500/25"
                >
                  Crear {getTypeName(academicModal.type)}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
