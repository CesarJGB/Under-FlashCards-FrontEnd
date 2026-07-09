// FILE: frontend/src/components/library/info/EvaluationModal.jsx
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';

export default function EvaluationModal({ open, onClose, onSave, parentChildren = [], parentWeight = 100, initial = null, depth = 1, isRoot = false }) {
  const [name, setName] = useState(initial?.name || '');
  const [type, setType] = useState(initial?.type || 'item');
  const [weight, setWeight] = useState(initial?.weight ?? 0);
  const [grade, setGrade] = useState(initial?.grade == null ? '' : String(initial.grade));
  // 🎯 NUEVO: Estado para controlar la escala de calificación (por defecto 100)
  const [gradingBase, setGradingBase] = useState(initial?.gradingBase || 100);
  const [error, setError] = useState('');

  useEffect(() => {
    setName(initial?.name || '');
    const startType = isRoot ? 'folder' : (initial?.type || 'item');
    setType(startType);
    setWeight(initial?.weight ?? 0);
    setGrade(initial?.grade == null ? '' : String(initial.grade));
    setGradingBase(initial?.gradingBase || 100); // Sincroniza la base guardada
    setError('');
  }, [initial, open, isRoot]);

  const titleText = isRoot ? (initial ? 'Editar Criterio Base' : 'Nuevo Criterio Base') : (initial ? 'Editar Subcriterio' : 'Nuevo Subcriterio');
  const descriptionText = isRoot ? 'Configura un criterio principal para la evaluación de la materia.' : (type === 'folder' ? 'Subcarpeta contenedora para organizar entregables.' : 'Ítem evaluable con nota opcional.');
  const nameLabel = isRoot ? 'Nombre del Criterio Base' : 'Nombre';

  const handleSave = async () => {
    console.log('[EvaluationModal] Intentando guardar:', { name, type, weight, grade, gradingBase, isRoot, depth });
    try {
      setError('');
      
      if (depth > 3) { setError('No se permite superar los 3 niveles de profundidad.'); return; }
      if (!name.trim()) { setError('El nombre es obligatorio.'); return; }
      
      const w = Number(weight || 0);
      if (isNaN(w) || w < 0 || w > 100) { setError('El peso debe ser un número entre 0 y 100.'); return; }

      // CORRECCIÓN MATEMÁTICA: Sumar hermanos excluyendo el que se edita
      const siblings = parentChildren || [];
      const replacingId = initial?.id || initial?._id || null;
      
      const currentSiblingsSum = siblings.reduce((acc, s) => {
        const sId = s.id || s._id;
        if (replacingId && sId === replacingId) return acc;
        return acc + (typeof s.weight === 'number' ? s.weight : Number(s.weight || 0));
      }, 0);

      if (currentSiblingsSum + w > parentWeight) { 
        setError(`La suma total (${currentSiblingsSum + w}%) supera el límite permitido por el padre (${parentWeight}%). Falta asignar: ${parentWeight - currentSiblingsSum}%.`); 
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
        
        // 🎯 VALIDACIÓN DINÁMICA: Valida contra la base seleccionada en lugar de un 100 estático
        if (g != null && (isNaN(g) || g < 0 || g > baseValue)) { 
          setError(`La calificación obtenida debe estar entre 0 y ${baseValue} según la base seleccionada.`); 
          return; 
        }
        
        payload.grade = g;
        payload.gradingBase = baseValue; // Guardamos la escala en el objeto
      } else {
        payload.children = initial?.children || [];
      }

      console.log('[EvaluationModal] Enviando payload final al padre:', payload);
      
      const success = await onSave(payload);
      if (success !== false) {
        onClose();
      }
    } catch (err) {
      console.error('[EvaluationModal] Error crítico en el guardado:', err);
      setError('Ocurrió un error inesperado al intentar guardar.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-6">
        <DialogHeader>
          <DialogTitle className="text-slate-950 dark:text-slate-50">{titleText}</DialogTitle>
          <DialogDescription className="text-slate-500 dark:text-slate-400">{descriptionText}</DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4 mt-2" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{nameLabel}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="w-full" placeholder="Ej. Exámenes, Tareas, Proyecto..." />
          </div>

          {!isRoot && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tipo de elemento</label>
              <div className="flex gap-2 w-full bg-slate-50 dark:bg-slate-950 p-1 rounded-xl border border-slate-100 dark:border-slate-900">
                <button
                  type="button"
                  onClick={() => setType('folder')}
                  className={`flex-1 text-center py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${type === 'folder' ? 'bg-white dark:bg-slate-800 shadow-xs text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>
                  Subcarpeta
                </button>
                <button
                  type="button"
                  onClick={() => setType('item')}
                  className={`flex-1 text-center py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${type === 'item' ? 'bg-white dark:bg-slate-800 shadow-xs text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>
                  Ítem Calificable
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Peso relativo (%)</label>
            <Input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} className="w-full" placeholder="0" min="0" max="100" />
          </div>

          {/* 🎯 NUEVO: Formulario selector de escala de evaluación */}
          {type === 'item' && !isRoot && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Base de calificación</label>
              <select
                value={gradingBase}
                onChange={(e) => {
                  setGradingBase(Number(e.target.value));
                  setGrade(''); // Resetea la nota actual para evitar discrepancias de escala al cambiar
                }}
                className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-800 px-3 text-sm bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
              >
                <option value={100}>Base 100 (0 - 100)</option>
                <option value={10}>Base 10 (0 - 10)</option>
                <option value={5}>Base 5 (0 - 5)</option>
              </select>
            </div>
          )}

          {type === 'item' && !isRoot && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Calificación obtenida (opcional)</label>
              <Input 
                type="number" 
                value={grade} 
                onChange={(e) => setGrade(e.target.value)} 
                className="w-full" 
                placeholder={gradingBase === 100 ? "Ej. 85" : gradingBase === 10 ? "Ej. 9" : "Ej. 4"} 
                min="0" 
                max={gradingBase} 
              />
            </div>
          )}

          {error && <div className="text-xs font-medium text-red-500 mt-1 bg-red-50 dark:bg-red-950/30 p-2.5 rounded-xl border border-red-100 dark:border-red-900/30">{error}</div>}
        </form>

        <DialogFooter className="mt-4">
          <div className="flex justify-end gap-3 w-full">
            <Button variant="outline" onClick={onClose} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs cursor-pointer">Guardar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
