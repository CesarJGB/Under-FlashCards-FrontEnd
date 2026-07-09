// FILE: frontend/src/components/library/info/EvaluationFolderView.jsx
import React from 'react';
import { Folder, FileText, Edit2, Trash2, ChevronRight } from 'lucide-react';

export default function EvaluationFolderView({ 
  nodes = [], 
  onOpenFolder = () => {}, 
  onEdit = () => {}, 
  onDelete = () => {}, 
  onChangeGrade = () => {} 
}) {
  return (
    <div className="space-y-3">
      {nodes.length === 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-sm text-slate-500">
          No hay elementos.
        </div>
      )}

      {nodes.map((n) => {
        // Determinamos el límite máximo según la base de calificación configurada
        const currentBase = n.gradingBase || 100;

        return (
          <div key={n.id || n._id} className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl shadow-xs transition-all">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0">
                {n.type === 'folder' ? <Folder className="w-5 h-5 text-emerald-500" /> : <FileText className="w-5 h-5 text-indigo-500" />}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-900 dark:text-slate-50 truncate">{n.name}</div>
                {/* 🎯 Mostramos visualmente la nota junto con su base correspondiente (ej: 10/10 o 85/100) */}
                <div className="text-xs text-slate-500 truncate">
                  Peso: {n.weight}% {n.type === 'item' && n.grade != null ? `• Nota: ${n.grade}/${currentBase}` : n.type === 'item' ? `• Escala: 0-${currentBase}` : ''}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {n.type === 'folder' && (
                <button onClick={() => onOpenFolder(n)} title="Abrir subcriterios" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors cursor-pointer">
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}

              {n.type === 'item' && (
                <input
                  type="number"
                  min="0"
                  max={currentBase}
                  value={n.grade ?? ''}
                  placeholder={`0-${currentBase}`}
                  onChange={(e) => {
                    if (e.target.value === '') {
                      onChangeGrade(n, null);
                      return;
                    }
                    
                    let val = Number(e.target.value);
                    
                    // 📢 Validación interactiva de límites máximos y mínimos
                    if (val > currentBase) {
                      alert(`La nota máxima permitida para este criterio es ${currentBase}. Se ajustará automáticamente.`);
                      val = currentBase;
                    } else if (val < 0) {
                      val = 0;
                    }
                    
                    onChangeGrade(n, val);
                  }}
                  className="w-20 text-sm text-center rounded-lg border border-slate-200 dark:border-slate-800 px-2 py-1 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              )}

              <button onClick={() => onEdit(n)} title="Editar" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors cursor-pointer">
                <Edit2 className="w-4 h-4" />
              </button>
              <button onClick={() => onDelete(n)} title="Eliminar" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-rose-600 transition-colors cursor-pointer">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
