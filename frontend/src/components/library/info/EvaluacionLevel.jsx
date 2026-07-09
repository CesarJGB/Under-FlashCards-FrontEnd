// FILE: frontend/src/components/library/info/EvaluacionLevel.jsx
import React, { useState, useMemo } from 'react';
import { ArrowLeft, FileText, Plus, Milestone } from 'lucide-react';
import EvaluationFolderView from './EvaluationFolderView';
import EvaluationModal from './EvaluationModal';
import { getJSON, setJSON } from '../../../lib/safeLocalStorage';
import { cloneDeep, computeAccumulatedPercent, validateTreeRecursively } from '../../../lib/evaluationUtils';
import { toast } from '../../../hooks/use-toast';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export default function EvaluacionLevel({ onBack, materia, materias, setMaterias, userId }) {
  const [navStack, setNavStack] = useState([]); // array of ids representing path from root
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

  // Helper: update the tree immutably given a function that mutates a cloned tree
  const updateTree = async (mutator) => {
    const prevMaterias = cloneDeep(materias);
    const nextMaterias = prevMaterias.map(m => ((m._id || m.id) === (materia._id || materia.id) ? { ...m } : m));
    const target = nextMaterias.find(m => (m._id || m.id) === (materia._id || materia.id));
    if (!target) return;
    const treeClone = cloneDeep(target.evaluationCriteria || []);
    mutator(treeClone);
    // Validate client-side quickly
    const valid = validateTreeRecursively(treeClone);
    if (!valid.ok) {
      toast({ title: 'Validación', description: valid.error || 'Estructura inválida.' });
      return false;
    }

    target.evaluationCriteria = treeClone;

    // Optimistic update
    setMaterias(nextMaterias);
    try { setJSON(`materias_${userId}`, nextMaterias); } catch (e) { /* ignore */ }

    // Persist to backend
    try {
      const res = await fetch(`${BACKEND_URL}/api/academic/materias/${materia._id || materia.id}/evaluation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluationCriteria: treeClone })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Error al guardar en servidor');
      }
      // success: optionally update with server response
      const data = await res.json().catch(() => null);
      if (data?.materia) {
        const updated = nextMaterias.map(m => (String(m._id || m.id) === String(data.materia.id || data.materia._id) ? { ...m, ...data.materia } : m));
        setMaterias(updated);
        try { setJSON(`materias_${userId}`, updated); } catch (e) { /* ignore */ }
      }
      return true;
    } catch (err) {
      console.error('[EvaluacionLevel] sync error:', err.message);
      // rollback
      setMaterias(prevMaterias);
      try { setJSON(`materias_${userId}`, prevMaterias); } catch (e) { /* ignore */ }
      toast({ title: 'Error', description: 'No se pudo sincronizar el criterio. Cambios revertidos.' });
      return false;
    }
  };

  const openAddModal = () => { setModalInitial(null); setModalOpen(true); };

  const handleAddOrEdit = async (node) => {
    // node may or may not have id
    if (!node.id) node.id = (typeof window !== 'undefined' && window.crypto?.randomUUID) ? window.crypto.randomUUID() : `${Date.now()}`;
    await updateTree((tree) => {
      if (!modalInitial) {
        // add to currentNode.children
        // find currentNode in tree by navStack
        if (!navStack.length) {
          tree.push(node);
        } else {
          let n = { children: tree };
          for (const id of navStack) {
            n = (n.children || []).find(c => (c.id || c._id) === id);
            if (!n) break;
          }
          if (n) n.children = n.children || [], n.children.push(node);
        }
      } else {
        // edit node: find and replace
        const replace = (arr) => {
          for (let i = 0; i < arr.length; i++) {
            if ((arr[i].id || arr[i]._id) === (node.id || node._id)) { arr[i] = { ...arr[i], ...node }; return true; }
            if (arr[i].children) {
              if (replace(arr[i].children)) return true;
            }
          }
          return false;
        };
        replace(tree);
      }
    });
    setModalOpen(false);
    setModalInitial(null);
  };

  const handleEdit = (n) => { setModalInitial(n); setModalOpen(true); };

  const handleDelete = async (n) => {
    if (!confirm('Eliminar este criterio?')) return;
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
          if ((x.id || x._id) === (itemNode.id || itemNode._id)) { x.grade = newGrade == null ? null : Number(newGrade); return true; }
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
    <div className="animate-[fadeIn_0.15s_ease] space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors cursor-pointer group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Volver a información
      </button>

      <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40">
          <FileText className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-950 dark:text-slate-50 tracking-tight">Criterios de Evaluación</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{materia?.name} • Reglas y porcentajes</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-500">Nota actual</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-50">{accumulated == null ? '—' : `${Math.round(accumulated)}%`}</div>
            <div className="text-xs text-slate-500">Puntos evaluados: {accumulated == null ? 0 : 'calculado'}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">Suma raíz</div>
            <div className={`text-sm font-medium ${rootSum === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>{rootSum}%</div>
            {rootSum !== 100 && <div className="text-xs text-amber-600">La suma de criterios raíz no es 100%</div>}
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-medium">{navStack.length ? 'Carpeta' : 'Criterios raíz'}</div>
            <div className="flex items-center gap-2">
              {navStack.length > 0 && (
                <button onClick={handleBackFolder} className="text-sm px-3 py-1 rounded-lg border">Atrás</button>
              )}
              <button onClick={openAddModal} className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-indigo-600 text-white text-sm"> <Plus className="w-4 h-4" /> Nuevo</button>
            </div>
          </div>

          <EvaluationFolderView
            nodes={currentNode.children || []}
            onOpenFolder={handleOpenFolder}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onChangeGrade={handleChangeGrade}
          />
        </div>
      </div>

      <EvaluationModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setModalInitial(null); }}
        onSave={handleAddOrEdit}
        parentChildren={currentNode.children || []}
        parentWeight={navStack.length ? (() => {
          // find parent node weight
          let node = { children: evaluationTree };
          for (const id of navStack) { node = (node.children || []).find(c => (c.id || c._id) === id) || { children: [] }; }
          return node.weight || 100;
        })() : 100}
        initial={modalInitial}
        depth={navStack.length + 1}
      />
    </div>
  );
}
