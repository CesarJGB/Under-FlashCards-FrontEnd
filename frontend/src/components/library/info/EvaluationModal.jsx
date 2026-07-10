// FILE: frontend/src/components/library/info/EvaluationModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';

export default function EvaluationModal({ open, onClose, onSave, parentChildren = [], parentWeight = 100, initial = null, depth = 1, isRoot = false }) {
  const keyboardHeight = useKeyboardHeight();
  const inputRef = useRef(null);
  
  const [name, setName] = useState(initial?.name || '');
  const [type, setType] = useState(initial?.type || 'item');
  const [weight, setWeight] = useState(initial?.weight ?? 0);
  const [grade, setGrade] = useState(initial?.grade == null ? '' : String(initial.grade));
  const [gradingBase, setGradingBase] = useState(initial?.gradingBase || 100);
  const [error, setError] = useState('');

  const isEditing = !!initial;
  const titleText = isRoot 
    ? (isEditing ? 'Editar Criterio Base' : 'Nuevo Criterio Base') 
    : (isEditing ? 'Editar Subcriterio' : 'Nuevo Subcriterio');
  const descriptionText = isRoot 
    ? 'Configura un criterio principal para la evaluación de la materia.' 
    : (type === 'folder' ? 'Subcarpeta contenedora para organizar entregables.' : 'Ítem evaluable con nota opcional.');

  // Enfocar input al montar
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Resetear estados cuando cambia initial o se abre/cierra
  useEffect(() => {
    if (open) {
      setName(initial?.name || '');
      const startType = isRoot ? 'folder' : (initial?.type || 'item');
      setType(startType);
      setWeight(initial?.weight ?? 0);
      setGrade(initial?.grade == null ? '' : String(initial.grade));
      setGradingBase(initial?.gradingBase || 100);
      setError('');
    }
  }, [initial, open, isRoot]);

  const handleSave = async () => {
    try {
      setError('');
      
      if (depth > 3) { setError('No se permite superar los 3 niveles de profundidad.'); return; }
      if (!name.trim()) { setError('El nombre es obligatorio.'); return; }
      
      const w = Number(weight || 0);
      if (isNaN(w) || w < 0 || w > 100) { setError('El peso debe ser un número entre 0 y 100.'); return; }

      const siblings = parentChildren || [];
      const replacingId = initial?.id || initial?._id || null;
      
      const currentSiblingsSum = siblings.reduce((acc, s) => {
        const sId = s.id || s._id;
        if (replacingId && sId === replacingId) return acc;
        return acc + (typeof s.weight === 'number' ? s.weight : Number(s.weight || 0));
      }, 0);

      if (currentSiblingsSum + w > parentWeight) { 
        setError(`La suma total (${currentSiblingsSum + w}%) supera el límite permitido por el padre (${parentWeight}%).`); 
        return; 
      }

      const effectiveType = isRoot ? 'folder' : type;
      let payload = {
        ...(initial || {}),
        name: name.trim(),
        type: effectiveType,
        weight: w
      };

      if (effectiveType === 'item') {
        const g = grade === '' ? null : Number(grade);
        const baseValue = Number(gradingBase || 100);
        
        if (g != null && (isNaN(g) || g < 0 || g > baseValue)) { 
          setError(`La calificación debe estar entre 0 y ${baseValue}.`); 
          return; 
        }
        
        payload.grade = g;
        payload.gradingBase = baseValue;
      } else {
        payload.children = initial?.children || [];
      }
      
      const success = await onSave(payload);
      if (success !== false) {
        handleClose();
      }
    } catch (err) {
      console.error('[EvaluationModal] Error:', err);
      setError('Ocurrió un error al guardar.');
    }
  };

  const handleClose = () => {
    onClose();
  };

  if (!open) return null;

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
          className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-sm pointer-events-auto animate-[slideUp_0.3s_cubic-bezier(0.32,0.72,0,1)] max-h-[85vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-6 pb-6 pt-5">
            {/* Header */}
            <div className="flex items-start justify-between mb-5">
              <div className="flex-1 pr-3">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                  {titleText}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {descriptionText}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="w-9 h-9 bg-slate-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center hover:bg-slate-200 dark:hover:bg-zinc-700 active:scale-95 transition-all duration-200 flex-shrink-0"
              >
                <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
              {/* Nombre */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  {isRoot ? 'Nombre del Criterio Base' : 'Nombre'}
                </label>
                <input 
                  ref={inputRef}
                  type="text" 
                  required 
                  placeholder={isRoot ? "Ej: Exámenes, Tareas, Proyecto..." : "Ej: Matemáticas Avanzadas"} 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                  autoCapitalize="off"
                  className="w-full text-base font-medium border-2 border-slate-200 dark:border-zinc-700 rounded-2xl px-4 py-3.5 bg-slate-50 dark:bg-zinc-800 dark:text-white focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-900 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-200 placeholder:text-slate-400 dark:placeholder:text-zinc-500" 
                />
              </div>

              {/* Tipo de elemento (solo si no es root) */}
              {!isRoot && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Tipo de elemento
                  </label>
                  <div className="flex gap-2 p-1 bg-slate-100 dark:bg-zinc-800 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setType('folder')}
                      className={`flex-1 py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${type === 'folder' ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                    >
                      Subcarpeta
                    </button>
                    <button
                      type="button"
                      onClick={() => setType('item')}
                      className={`flex-1 py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${type === 'item' ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                    >
                      Ítem Calificable
                    </button>
                  </div>
                </div>
              )}

              {/* Peso */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Peso relativo (%)
                </label>
                <input 
                  type="number" 
                  required
                  min="0" 
                  max="100"
                  value={weight} 
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="0"
                  className="w-full text-base font-medium border-2 border-slate-200 dark:border-zinc-700 rounded-2xl px-4 py-3.5 bg-slate-50 dark:bg-zinc-800 dark:text-white focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-900 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-200 placeholder:text-slate-400 dark:placeholder:text-zinc-500" 
                />
              </div>

              {/* Base de calificación (solo si es item y no root) */}
              {type === 'item' && !isRoot && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Base de calificación
                  </label>
                  <select
                    value={gradingBase}
                    onChange={(e) => {
                      setGradingBase(Number(e.target.value));
                      setGrade('');
                    }}
                    className="w-full text-base font-medium border-2 border-slate-200 dark:border-zinc-700 rounded-2xl px-4 py-3.5 bg-slate-50 dark:bg-zinc-800 dark:text-white focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-900 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-200 cursor-pointer appearance-none"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem' }}
                  >
                    <option value={100}>Base 100 (0 - 100)</option>
                    <option value={10}>Base 10 (0 - 10)</option>
                    <option value={5}>Base 5 (0 - 5)</option>
                  </select>
                </div>
              )}

              {/* Calificación (solo si es item y no root) */}
              {type === 'item' && !isRoot && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Calificación obtenida <span className="font-normal text-slate-500">(opcional)</span>
                  </label>
                  <input 
                    type="number" 
                    value={grade} 
                    onChange={(e) => setGrade(e.target.value)}
                    placeholder={gradingBase === 100 ? "Ej. 85" : gradingBase === 10 ? "Ej. 9" : "Ej. 4"}
                    min="0" 
                    max={gradingBase}
                    className="w-full text-base font-medium border-2 border-slate-200 dark:border-zinc-700 rounded-2xl px-4 py-3.5 bg-slate-50 dark:bg-zinc-800 dark:text-white focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-900 focus:ring-4 focus:ring-indigo-500/10 transition-all duration-200 placeholder:text-slate-400 dark:placeholder:text-zinc-500" 
                  />
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-3 rounded-2xl border border-red-100 dark:border-red-900/30">
                  {error}
                </div>
              )}
              
              {/* Botones */}
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
                  {isEditing ? 'Guardar cambios' : (isRoot ? 'Crear criterio' : 'Crear subcriterio')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
