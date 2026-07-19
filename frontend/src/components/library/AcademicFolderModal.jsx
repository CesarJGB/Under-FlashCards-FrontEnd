import React, { useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, Palette, Wand2 } from 'lucide-react';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';
import { MATERIA_PALETTE } from '../../lib/materiaColors';

export default function AcademicFolderModal({ 
  academicModal, academicInput, setAcademicInput, 
  academicColor, setAcademicColor,
  setAcademicModal, handleCreateAcademicFolder, handleUpdateAcademicFolder 
}) {
  const keyboardHeight = useKeyboardHeight();
  const inputRef = useRef(null);
  const [step, setStep] = useState('main'); // 'main' | 'customization'

  const isEditing = !!academicModal?.editing;
  const isMateria = academicModal?.type === 'materia';
  const canPickColor = isMateria && typeof setAcademicColor === 'function';

  // Enfocar input y precargar nombre/color al abrir (o al cambiar de carpeta a editar)
  useEffect(() => {
    setStep('main');
    setAcademicInput(academicModal?.editing?.name || '');
    if (typeof setAcademicColor === 'function') {
      setAcademicColor(academicModal?.editing?.color || null);
    }
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicModal]);

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
    if (typeof setAcademicColor === 'function') setAcademicColor(null);
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

            {/* ==================== VISTA PRINCIPAL ==================== */}
            {step === 'main' && (
              <div className="animate-[fadeIn_0.2s_ease]">
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
                        ? 'Modifica la información de esta carpeta' 
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
                <form onSubmit={handleSubmit} className="space-y-3">
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

                  {canPickColor && (
                    <button
                      type="button"
                      onClick={() => setStep('customization')}
                      className="w-full flex items-center justify-between p-4 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl hover:border-indigo-300 hover:bg-indigo-50/30 dark:hover:bg-zinc-800 transition-all duration-200"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: academicColor || '#e5e7eb' }}
                        >
                          {academicColor ? (
                            <Palette className="w-5 h-5 text-white" />
                          ) : (
                            <Wand2 className="w-5 h-5 text-slate-500" />
                          )}
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">Color de la materia</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {academicColor ? 'Color personalizado' : 'Automático'}
                          </p>
                        </div>
                      </div>
                      <ChevronLeft className="w-5 h-5 text-slate-400 rotate-180" />
                    </button>
                  )}

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
            )}

            {/* ==================== VISTA PERSONALIZACIÓN (color) ==================== */}
            {step === 'customization' && canPickColor && (
              <div className="animate-[fadeIn_0.2s_ease]">
                <div className="flex items-center gap-3 mb-5">
                  <button
                    type="button"
                    onClick={() => setStep('main')}
                    className="w-9 h-9 bg-slate-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center hover:bg-slate-200 dark:hover:bg-zinc-700 active:scale-95 transition-all duration-200 flex-shrink-0"
                  >
                    <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                  </button>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-0.5">Color de la materia</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Se usa en el ícono y el acento de la tarjeta</p>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                    Elige un color
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {/* Opción "Automático" primero, luego la paleta */}
                    {[null, ...MATERIA_PALETTE].map((c) => {
                      const isSelected = (academicColor || null) === c;
                      return (
                        <button
                          key={c ?? 'auto'}
                          type="button"
                          onClick={() => setAcademicColor(c)}
                          style={c ? { backgroundColor: c } : undefined}
                          className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center transition-all duration-200 ${
                            c ? '' : 'bg-slate-200 dark:bg-zinc-700'
                          } ${
                            isSelected
                              ? 'ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-zinc-800 border-white scale-105'
                              : 'border-white dark:border-zinc-800 hover:scale-105'
                          }`}
                          title={c ? c : 'Automático'}
                        >
                          {!c && <Wand2 className="w-4 h-4 text-slate-500 dark:text-slate-300" />}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-zinc-700">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 cursor-pointer">
                      <input
                        type="color"
                        value={academicColor || '#6366F1'}
                        onChange={(e) => setAcademicColor(e.target.value)}
                        className="w-6 h-6 rounded cursor-pointer border border-slate-300 dark:border-zinc-600"
                      />
                      Color personalizado
                    </label>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setStep('main')}
                  className="w-full h-12 bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-semibold rounded-2xl hover:bg-slate-800 dark:hover:bg-slate-100 active:scale-[0.98] transition-all duration-200 cursor-pointer mt-4"
                >
                  Listo
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
