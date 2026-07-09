import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';

// Modal para crear/editar nodo (folder | item)
export default function EvaluationModal({ open, onClose, onSave, parentChildren = [], parentWeight = 100, initial = null, depth = 1 }) {
  const [name, setName] = useState(initial?.name || '');
  const [type, setType] = useState(initial?.type || 'item');
  const [weight, setWeight] = useState(initial?.weight ?? 0);
  const [grade, setGrade] = useState(initial?.grade == null ? '' : String(initial.grade));
  const [error, setError] = useState('');

  useEffect(() => {
    setName(initial?.name || '');
    setType(initial?.type || 'item');
    setWeight(initial?.weight ?? 0);
    setGrade(initial?.grade == null ? '' : String(initial.grade));
    setError('');
  }, [initial, open]);

  const handleSave = () => {
    setError('');
    // Depth rule: max 3
    if (depth > 3) return setError('No se puede crear más de 3 niveles.');
    if (!name.trim()) return setError('El nombre es requerido.');
    const w = Number(weight || 0);
    if (isNaN(w) || w < 0 || w > 100) return setError('Peso inválido (0-100).');

    // Validate siblings weight
    const siblings = parentChildren || [];
    const replacingId = initial?.id || initial?._id || null;
    const sum = siblings.reduce((acc, s) => {
      if (replacingId && (s.id === replacingId || s._id === replacingId)) return acc + w;
      return acc + (typeof s.weight === 'number' ? s.weight : 0);
    }, 0);
    if (sum > parentWeight) return setError('La suma de los subcriterios excede el peso permitido por el padre.');

    if (type === 'item') {
      const g = grade === '' ? null : Number(grade);
      if (g != null && (isNaN(g) || g < 0 || g > 100)) return setError('Calificación inválida (0-100).');
      onSave({ ...(initial || {}), name: name.trim(), type: 'item', weight: w, grade: g });
    } else {
      onSave({ ...(initial || {}), name: name.trim(), type: 'folder', weight: w, children: initial?.children || [] });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        {/* Contenedor principal con fondo sólido y bordes que soportan modo oscuro */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-6 flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{initial ? 'Editar criterio' : 'Nuevo criterio'}</DialogTitle>
            <DialogDescription>
              {type === 'folder' ? 'Carpeta contenedora (puede tener subcriterios)' : 'Ítem calificable (nota opcional)'}
            </DialogDescription>
          </DialogHeader>

          {/* Formulario en flujo vertical limpio */}
          <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium">Nombre</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="w-full" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium">Tipo</label>
              {/* Dos botones paralelos que ocupan 50% cada uno */}
              <div className="flex gap-2 w-full">
                <button
                  type="button"
                  onClick={() => setType('folder')}
                  className={`flex-1 text-center py-2 rounded-xl border transition-colors ${type === 'folder' ? 'bg-slate-200 border-slate-300 dark:bg-slate-800 dark:border-slate-700' : 'bg-transparent border-slate-200/0 dark:border-slate-800/0'}`}>
                  Carpeta
                </button>
                <button
                  type="button"
                  onClick={() => setType('item')}
                  className={`flex-1 text-center py-2 rounded-xl border transition-colors ${type === 'item' ? 'bg-slate-200 border-slate-300 dark:bg-slate-800 dark:border-slate-700' : 'bg-transparent border-slate-200/0 dark:border-slate-800/0'}`}>
                  Ítem
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium">Peso (%)</label>
              <Input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} className="w-full" />
            </div>

            {type === 'item' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium">Calificación (opcional)</label>
                <Input type="number" value={grade} onChange={(e) => setGrade(e.target.value)} className="w-full" />
              </div>
            )}

            {error && <div className="text-sm text-red-600">{error}</div>}
          </form>

          <DialogFooter>
            <div className="flex justify-end gap-3 mt-2 w-full">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={handleSave}>Guardar</Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
