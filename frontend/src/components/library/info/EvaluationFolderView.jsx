// FILE: frontend/src/components/library/info/EvaluationFolderView.jsx
import React, { useState, useEffect } from 'react';
import { Folder, FileText, Edit2, Trash2, ChevronRight, Target, CheckCircle2, Sparkles } from 'lucide-react';
import { calculateGoalMetrics } from '../../../lib/evaluationUtils';

export default function EvaluationFolderView({ 
  nodes = [], 
  globalProgress = 0,       // 📊 Puntos acumulados globales actuales de la materia (ej: 55.4)
  targetGrade = 70,          // 🎯 Meta guardada en la base de datos (por defecto 70)
  onUpdateTargetGrade,       // 🚀 Callback para enviar la nueva meta modificada al backend
  onOpenFolder = () => {}, 
  onEdit = () => {}, 
  onDelete = () => {}, 
  onChangeGrade = () => {} 
}) {
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [tempTarget, setTempTarget] = useState(targetGrade);

  // Sincronizar el input si la meta cambia externamente
  useEffect(() => {
    setTempTarget(targetGrade);
  }, [targetGrade]);

  // Ejecutamos la lógica de nuestro motor matemático extendido
  const { reached, pointsDifference, message } = calculateGoalMetrics(globalProgress, targetGrade);

  const handleSaveTarget = () => {
    const val = Number(tempTarget);
    if (isNaN(val) || val < 0 || val > 100) {
      alert("La meta de calificación debe ser un número entre 0 y 100.");
      return;
    }
    if (onUpdateTargetGrade) {
      onUpdateTargetGrade(val);
    }
    setIsEditingTarget(false);
  };

  return (
    <div className="space-y-4">
      {/* 🎯 PANEL DE METAS Y RENDIMIENTO GLOBAL */}
      <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Meta Propuesta</div>
              {isEditingTarget ? (
                <div className="flex items-center gap-2 mt-0.5">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={tempTarget}
                    onChange={(e) => setTempTarget(e.target.value)}
                    className="w-16 text-sm font-semibold rounded-md border border-slate-300 dark:border-slate-700 px-1.5 py-0.5 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 text-center focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    autoFocus
                  />
                  <button onClick={handleSaveTarget} className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-0.5 rounded-md transition-colors cursor-pointer font-medium">
                    Guardar
                  </button>
                  <button onClick={() => { setIsEditingTarget(false); setTempTarget(targetGrade); }} className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer">
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-lg font-bold text-slate-800 dark:text-slate-200">{targetGrade} pts</span>
                  <button onClick={() => setIsEditingTarget(true)} title="Editar meta" className="p-1 rounded-md text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="text-right sm:block flex justify-between items-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200 dark:border-slate-800">
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500 sm:block">Llevas acumulado:</span>
            <span className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 sm:mt-0.5 block">{parseFloat(globalProgress.toFixed(2))}%</span>
          </div>
        </div>

        {/* Notificación Dinámica */}
        <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm border font-medium ${
          reached 
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
            : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
        }`}>
          {reached ? (
            <Sparkles className="w-4 h-4 shrink-0 text-emerald-500 animate-pulse" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-indigo-500" />
          )}
          <span>{message}</span>
        </div>
      </div>

      {/* 📂 LISTADO DE NODOS EXISTENTES */}
      <div className="space-y-3">
        {nodes.length === 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-sm text-slate-500">
            No hay elementos.
          </div>
        )}

        {nodes.map((n) => {
          const currentBase = n.gradingBase || 100;

          return (
            <div key={n.id || n._id} className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl shadow-xs transition-all">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0">
                  {n.type === 'folder' ? <Folder className="w-5 h-5 text-emerald-500" /> : <FileText className="w-5 h-5 text-indigo-500" />}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-50 truncate">{n.name}</div>
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
    </div>
  );
}
