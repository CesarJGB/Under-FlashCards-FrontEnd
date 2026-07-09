import React from 'react';
import { Folder, FileText, Edit2, Trash2, ChevronRight } from 'lucide-react';

export default function EvaluationFolderView({ nodes = [], onOpenFolder = () => {}, onEdit = () => {}, onDelete = () => {}, onChangeGrade = () => {} }) {
  return (
    <div className="space-y-3">
      {nodes.length === 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-sm text-slate-500">No hay elementos.</div>
      )}

      {nodes.map((n) => (
        <div key={n.id || n._id} className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
              {n.type === 'folder' ? <Folder className="w-5 h-5 text-emerald-500" /> : <FileText className="w-5 h-5 text-indigo-500" />}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900 dark:text-slate-50 truncate">{n.name}</div>
              <div className="text-xs text-slate-500">Peso: {n.weight}% {n.type === 'item' && n.grade != null ? `• Nota: ${n.grade}` : ''}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {n.type === 'folder' && (
              <button onClick={() => onOpenFolder(n)} title="Abrir" className="p-2 rounded-md hover:bg-slate-100">
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {n.type === 'item' && (
              <input
                type="number"
                value={n.grade ?? ''}
                placeholder="—"
                onChange={(e) => onChangeGrade(n, e.target.value === '' ? null : Number(e.target.value))}
                className="w-20 text-sm rounded-md border px-2 py-1"
              />
            )}

            <button onClick={() => onEdit(n)} title="Editar" className="p-2 rounded-md hover:bg-slate-100">
              <Edit2 className="w-4 h-4" />
            </button>
            <button onClick={() => onDelete(n)} title="Eliminar" className="p-2 rounded-md hover:bg-slate-100">
              <Trash2 className="w-4 h-4 text-rose-600" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
