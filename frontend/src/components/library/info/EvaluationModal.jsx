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
        <DialogHeader>
          <DialogTitle>{initial ? 'Editar criterio' : 'Nuevo criterio'}</DialogTitle>
          <DialogDescription>
            {type === 'folder' ? 'Carpeta contenedora (puede tener subcriterios)' : 'Ítem calificable (nota opcional)'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <label className="text-xs font-medium">Nombre</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />

          <label className="text-xs font-medium">Tipo</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setType('folder')} className={`px-3 py-1 rounded-xl ${type === 'folder' ? 'bg-slate-200' : 'bg-transparent'}`}>Carpeta</button>
            <button type="button" onClick={() => setType('item')} className={`px-3 py-1 rounded-xl ${type === 'item' ? 'bg-slate-200' : 'bg-transparent'}`}>Ítem</button>
          </div>

          <label className="text-xs font-medium">Peso (%)</label>
          <Input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />

          {type === 'item' && (
            <>
              <label className="text-xs font-medium">Calificación (opcional)</label>
              <Input type="number" value={grade} onChange={(e) => setGrade(e.target.value)} />
            </>
          )}

          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>

        <DialogFooter>
          <div className="flex gap-2 w-full">
            <Button variant="outline" onClick={onClose} className="w-full">Cancelar</Button>
            <Button onClick={handleSave} className="w-full">Guardar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
