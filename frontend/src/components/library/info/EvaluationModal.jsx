import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';

// Modal para crear/editar nodo (folder | item)
export default function EvaluationModal({ open, onClose, onSave, parentChildren = [], parentWeight = 100, initial = null, depth = 1, isRoot = false }) {
  const [name, setName] = useState(initial?.name || '');
  const [type, setType] = useState(initial?.type || 'item');
  const [weight, setWeight] = useState(initial?.weight ?? 0);
  const [grade, setGrade] = useState(initial?.grade == null ? '' : String(initial.grade));
  const [error, setError] = useState('');

  useEffect(() => {
    setName(initial?.name || '');
    // si es nivel raíz forzamos 'folder'
    const startType = isRoot ? 'folder' : (initial?.type || 'item');
    setType(startType);
    setWeight(initial?.weight ?? 0);
    setGrade(initial?.grade == null ? '' : String(initial.grade));
    setError('');
  }, [initial, open, isRoot]);

  const titleText = isRoot ? (initial ? 'Editar Criterio Base' : 'Nuevo Criterio Base') : (initial ? 'Editar criterio' : 'Nuevo criterio');
  const descriptionText = isRoot ? 'Criterio raíz de la materia (contenedor principal).' : (type === 'folder' ? 'Carpeta contenedora (puede tener subcriterios)' : 'Ítem calificable (nota opcional)');
  const nameLabel = isRoot ? 'Nombre del Criterio' : 'Nombre';

  const handleSave = async () => {
    // Logear inputs al inicio para diagnóstico
    console.log('[EvaluationModal] handleSave input:', { name, type, weight, grade, initial, isRoot, depth });
    try {
      setError('');
      // Depth rule: max 3
      if (depth > 3) { setError('No se puede crear más de 3 niveles.'); return; }
      if (!name.trim()) { setError('El nombre es requerido.'); return; }
      const w = Number(weight || 0);
      if (isNaN(w) || w < 0 || w > 100) { setError('Peso inválido (0-100).'); return; }

      // Validate siblings weight (asegurar sumar números incluso si weight fue string)
      const siblings = parentChildren || [];
      const replacingId = initial?.id || initial?._id || null;
      const sum = siblings.reduce((acc, s) => {
        if (replacingId && (s.id === replacingId || s._id === replacingId)) return acc + w;
        return acc + (typeof s.weight === 'number' ? s.weight : Number(s.weight || 0));
      }, 0);
      if (sum > parentWeight) { setError('La suma de los subcriterios excede el peso permitido por el padre.'); return; }

      const effectiveType = isRoot ? 'folder' : type;

      if (effectiveType === 'item') {
        const g = grade === '' ? null : Number(grade);
        if (g != null && (isNaN(g) || g < 0 || g > 100)) { setError('Calificación inválida (0-100).'); return; }
        const payload = { ...(initial || {}), name: name.trim(), type: 'item', weight: w, grade: g };
        console.log('[EvaluationModal] saving payload:', payload);
        const result = await onSave(payload);
        console.log('[EvaluationModal] onSave result:', result);
        if (result === false) { setError('No se pudo guardar.'); return; }
        // cerrar modal si el padre no lo hace
        onClose();
      } else {
        const payload = { ...(initial || {}), name: name.trim(), type: 'folder', weight: w, children: initial?.children || [] };
        console.log('[EvaluationModal] saving payload:', payload);
        const result = await onSave(payload);
        console.log('[EvaluationModal] onSave result:', result);
        if (result === false) { setError('No se pudo guardar.'); return; }
        onClose();
      }
    } catch (err) {
      console.error('[EvaluationModal] save error:', err);
      setError('Error al guardar. Revisa la consola.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        {/* Contenedor principal con fondo sólido y bordes que soportan modo oscuro */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-6 flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{titleText}</DialogTitle>
            <DialogDescription>{descriptionText}</DialogDescription>
          </DialogHeader>

          {/* Formulario en flujo vertical limpio */}
          <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium">{nameLabel}</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="w-full" />
            </div>

            {/* Selector de tipo: oculto en level root */}
            {!isRoot && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium">Tipo</label>
                {/* Dos botones paralelos que ocupan 50% cada uno */}
                <div className="flex gap-2 w-full">
                  <button
                    type="button"
                    onClick={() => setType('folder')}
                    className={`flex-1 text-center py-2 rounded-xl border transition-colors ${type === 'folder' ? 'bg-slate-200 border-slate-300 dark:bg-slate-800 dark:border-slate-700' : 'bg-transparent border-slate-200/0 dark:border-slate-800/0'}`}>
                    Subcarpeta
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('item')}
                    className={`flex-1 text-center py-2 rounded-xl border transition-colors ${type === 'item' ? 'bg-slate-200 border-slate-300 dark:bg-slate-800 dark:border-slate-700' : 'bg-transparent border-slate-200/0 dark:border-slate-800/0'}`}>
                    Ítem
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium">Peso (%)</label>
              <Input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} className="w-full" />
            </div>

            {/* Calificación solo si es ítem y no estamos en root */}
            {type === 'item' && !isRoot && (
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
