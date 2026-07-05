import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';

export default function AcademicFolderModal({ 
  academicModal, academicInput, setAcademicInput, 
  setAcademicModal, handleCreateAcademicFolder, handleUpdateAcademicFolder 
}) {
  const keyboardHeight = useKeyboardHeight();
  const inputRef = useRef(null);
  
  const isEditing = !!academicModal?.editing;

  // Enfocar input al montar
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  const getTypeName = (type) => {
    const names = { materia: 'materia', tema: 'tema', subtema: 'subtema' };
    return names[type] || 'carpeta';
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!academicInput.trim()) return;
    
    if (isEditing && handleUpdateAcademicFolder) {
      handleUpdateAcademicFolder(e);
    } else {
      handleCreateAcademicFolder(e);
    }
  };

  const handleClose = () => {
    setAcademicModal(null);
    setAcademicInput('');
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/40 z-[70] animate-[fadeIn_0.2s_ease]"
        onClick={handleClose}
      />

      {/* Modal centrado con ajuste de teclado */}
      <div 
        className="fixed inset-0 z-[80] flex items-center justify-center px-4 pointer-events-none"
        style={{ paddingBottom: keyboardHeight > 0 ? `${keyboardHeight}px` : '0' }}
      >
        <div 
          className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-sm pointer-events-auto animate-[slideUp_0.3s_cubic-bezier(0.32,0.72,0,1)] max-h-[80vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-6 pb-6 pt-5">
            {/* Header dinámico */}
            <div className="flex items-start justify-between mb-5">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                  {isEditing 
                    ? `Editar ${getTypeName(academicModal?.type)}` 
                    : `Crear nueva ${getTypeName(academicModal?.type)}`}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {isEditing 
                    ? 'Modifica el nombre de esta carpeta' 
                    : 'Ingresa el nombre para organizar tu contenido'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="w-9 h-9 bg-slate-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center hover:bg-slate-200 dark:hover:bg-zinc-700 active:scale-95 transition-all duration-200 flex-shrink-0 ml-3"
              >
                <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Nombre
                </label>
                <input 
                  ref={inputRef}
                  type="text" 
                  required 
                  placeholder={`Ej: Matemáticas ${getTypeName(academicModal?.type) === 'materia' ? 'Avanzadas' : '1'}`} 
                  value={academicInput} 
                  onChange={(e) => setAcademicInput(e.target.value)}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                  autoCapitalize="off"
                  enterKeyHint="done"
                  className="w-full text-base font-medium border-2 border-slate-200 dark:border-zinc-700 rounded-2xl px-4 py-3.5 bg-slate-50 dark:bg-zinc-800 dark:text-white focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-900 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-200 placeholder:text-slate-400 dark:placeholder:text-zinc-500" 
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={handleClose}
                  className="flex-1 h-12 border-2 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-slate-300 font-semibold rounded-2xl hover:bg-slate-50 dark:hover:bg-zinc-800 active:scale-[0.98] transition-all duration-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-1 h-12 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold rounded-2xl hover:from-indigo-700 hover:to-violet-700 active:scale-[0.98] transition-all duration-200 cursor-pointer shadow-lg shadow-indigo-500/25"
                >
                  {isEditing ? 'Guardar cambios' : `Crear ${getTypeName(academicModal?.type)}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

