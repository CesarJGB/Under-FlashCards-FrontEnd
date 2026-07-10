// FILE: frontend/src/components/library/info/EvaluacionLevel.jsx
import React, { useState, useMemo } from 'react';
import EvaluationFolderView from './EvaluationFolderView';
import EvaluationModal from './EvaluationModal';
import { setJSON } from '../../../lib/safeLocalStorage';
import { cloneDeep, computeAccumulatedPercent, validateTreeRecursively } from '../../../lib/evaluationUtils';
import { toast } from '../../../hooks/use-toast';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export default function EvaluacionLevel({ onBack, materia, materias, setMaterias, userId }) {
  const [navStack, setNavStack] = useState([]); 
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitial, setModalInitial] = useState(null);

  const evaluationTree = materia?.evaluationCriteria || [];

  const currentNode = useMemo(() => {
    if (!navStack.length) return { children: evaluationTree };
    let node = { children: evaluationTree };
    for (const id of navStack) {
      node = (node.children || []).find(c => (c.id || c._id) === id) || { children: [] };
    }
    return node;
  }, [navStack, evaluationTree]);

  const handleUpdateTargetGrade = async (newMeta) => {
    const materiaId = materia?._id || materia?.id;
    if (!materiaId) return;

    const prevMaterias = cloneDeep(materias);
    const nextMaterias = prevMaterias.map(m => 
      ((m._id || m.id) === materiaId ? { ...m, metaCalificacion: newMeta } : m)
    );

    setMaterias(nextMaterias);
    try { setJSON(`materias_${userId}`, nextMaterias); } catch (e) { console.error(e); }

    try {
      const res = await fetch(`${BACKEND_URL}/api/academic/materias/${materiaId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId
        },
        body: JSON.stringify({ metaCalificacion: newMeta })
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Error al guardar la meta en el servidor.');
      }

      const data = await res.json().catch(() => null);
      if (data) {
        const updated = nextMaterias.map(m => 
          (String(m._id || m.id) === String(data.id || data._id) ? { ...m, ...data } : m)
        );
        setMaterias(updated);
        try { setJSON(`materias_${userId}`, updated); } catch (e) { console.error(e); }
        toast({ title: 'Meta actualizada', description: `Nueva meta fijada en ${newMeta} puntos.` });
      }
    } catch (err) {
      console.error('[EvaluacionLevel:updateTargetGrade] Error:', err.message);
      setMaterias(prevMaterias);
      try { setJSON(`materias_${userId}`, prevMaterias); } catch (e) { console.error(e); }
      toast({ title: 'Error de servidor', description: 'No se pudo guardar la meta. Cambios revertidos.' });
    }
  };

  const updateTree = async (mutator) => {
    const prevMaterias = cloneDeep(materias);
    const nextMaterias = prevMaterias.map(m => ((m._id || m.id) === (materia._id || materia.id) ? { ...m } : m));
    const target = nextMaterias.find(m => (m._id || m.id) === (materia._id || materia.id));
    
    if (!target) return false;
    
    const treeClone = cloneDeep(target.evaluationCriteria || []);
    mutator(treeClone);

    const valid = validateTreeRecursively(treeClone);
    if (!valid.ok) {
      toast({ title: 'Validación de Criterios', description: valid.error || 'Estructura inválida.' });
      return false;
    }

    target.evaluationCriteria = treeClone;

    setMaterias(nextMaterias);
    try { setJSON(`materias_${userId}`, nextMaterias); } catch (e) { console.error(e); }

    try {
      const res = await fetch(`${BACKEND_URL}/api/academic/materias/${materia._id || materia.id}/evaluation`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-Id': userId 
        },
        body: JSON.stringify({ evaluationCriteria: treeClone })
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Error al guardar en el servidor');
      }

      const data = await res.json().catch(() => null);
      if (data?.materia) {
        const updated = nextMaterias.map(m => (String(m._id || m.id) === String(data.materia.id || data.materia._id) ? { ...m, ...data.materia } : m));
        setMaterias(updated);
        try { setJSON(`materias_${userId}`, updated); } catch (e) { console.error(e); }
      }
      return true;
    } catch (err) {
      console.error('[EvaluacionLevel] Error de sincronización:', err.message);
      setMaterias(prevMaterias);
      try { setJSON(`materias_${userId}`, prevMaterias); } catch (e) { console.error(e); }
      toast({ title: 'Error de servidor', description: 'No se pudo guardar en la base de datos. Cambios revertidos.' });
      return false;
    }
  };

  const openAddModal = () => { setModalInitial(null); setModalOpen(true); };

  const handleAddOrEdit = async (node) => {
    if (!node.id) {
      node.id = (typeof window !== 'undefined' && window.crypto?.randomUUID) ? window.crypto.randomUUID() : `${Date.now()}`;
    }

    const success = await updateTree((tree) => {
      if (!modalInitial) {
        if (!navStack.length) {
          tree.push(node);
        } else {
          let n = { children: tree };
          for (const id of navStack) {
            n = (n.children || []).find(c => (c.id || c._id) === id);
            if (!n) break;
          }
          if (n) {
            n.children = n.children || [];
            n.children.push(node);
          }
        }
      } else {
        const replace = (arr) => {
          for (let i = 0; i < arr.length; i++) {
            if ((arr[i].id || arr[i]._id) === (node.id || node._id)) { 
              arr[i] = { ...arr[i], ...node }; 
              return true; 
            }
            if (arr[i].children) {
              if (replace(arr[i].children)) return true;
            }
          }
          return false;
        };
        replace(tree);
      }
    });

    return success; 
  };

  const handleEdit = (n) => { setModalInitial(n); setModalOpen(true); };

  const handleDelete = async (n) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este criterio y todo su contenido?')) return;
    await updateTree((tree) => {
      const remove = (arr) => {
        const idx = arr.findIndex(x => (x.id || x._id) === (n.id || n._id));
        if (idx !== -1) { arr.splice(idx, 1); return true; }
        for (const c of arr) {
          if (c.children && remove(c.children)) return true;
        }
        return false;
      };
      remove(tree);
    });
  };

  const handleOpenFolder = (n) => { setNavStack(prev => [...prev, n.id || n._id]); };
  const handleBackFolder = () => { setNavStack(prev => prev.slice(0, -1)); };

  const handleChangeGrade = async (itemNode, newGrade) => {
    await updateTree((tree) => {
      const replace = (arr) => {
        for (const x of arr) {
          if ((x.id || x._id) === (itemNode.id || itemNode._id)) { 
            x.grade = newGrade == null ? null : Number(newGrade); 
            return true; 
          }
          if (x.children) if (replace(x.children)) return true;
        }
        return false;
      };
      replace(tree);
    });
  };

  const rootSum = (evaluationTree || []).reduce((a, c) => a + (c.weight || 0), 0);
  const accumulated = computeAccumulatedPercent({ type: 'folder', children: evaluationTree });

  return (
    <div className="animate-[fadeIn_0.15s_ease] pt-2">
      {/* 🧼 Contenedor unificado y limpio acoplado directamente al menú superior */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs max-w-3xl mx-auto">
        
        {/* El botón de "Atrás" de navegación interna se activa únicamente al navegar dentro de subcarpetas */}
        {navStack.length > 0 && (
          <div className="mb-4">
            <button onClick={handleBackFolder} className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-medium cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
              ← Atrás
            </button>
          </div>
        )}

        <EvaluationFolderView
          nodes={currentNode.children || []}
          globalProgress={accumulated || 0}
          targetGrade={materia?.metaCalificacion ?? 70}
          rootSum={rootSum}
          isRoot={navStack.length === 0}
          onAdd={openAddModal}
          onOpenFolder={handleOpenFolder}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onChangeGrade={handleChangeGrade}
          onUpdateTargetGrade={handleUpdateTargetGrade}
        />
      </div>

      <EvaluationModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setModalInitial(null); }}
        onSave={handleAddOrEdit}
        parentChildren={currentNode.children || []}
        parentWeight={navStack.length ? (() => {
          let node = { children: evaluationTree };
          for (const id of navStack) { node = (node.children || []).find(c => (c.id || c._id) === id) || { children: [] }; }
          return node.weight || 100;
        })() : 100}
        initial={modalInitial}
        depth={navStack.length + 1}
        isRoot={navStack.length === 0}
      />
    </div>
  );
}
