// FILE: frontend/src/components/library/info/EvaluationFolderView.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Folder, FileText, Edit2, Trash2, ChevronRight, CheckCircle2, Sparkles, AlertTriangle, Plus } from 'lucide-react';
import { calculateGoalMetrics } from '../../../lib/evaluationUtils';

export default function EvaluationFolderView({ 
  nodes = [], 
  globalProgress = 0,       
  targetGrade = 70,          
  rootSum = 100,             
  isRoot = true,             
  readOnly = false,
  onAdd,                     
  onUpdateTargetGrade,       
  onOpenFolder = () => {}, 
  onEdit = () => {}, 
  onDelete = () => {}, 
  onChangeGrade = () => {} 
}) {
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [tempTarget, setTempTarget] = useState(targetGrade);

  useEffect(() => {
    setTempTarget(targetGrade);
  }, [targetGrade]);

  const { reached, pointsDifference, message } = calculateGoalMetrics(globalProgress, targetGrade);

  // 📊 Ordenamos automáticamente los criterios de mayor a menor peso (%)
  const sortedNodes = useMemo(() => {
    return [...nodes].sort((a, b) => (b.weight || 0) - (a.weight || 0));
  }, [nodes]);

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
    <div className="space-y-5">
      {/* 🎯 1. PANEL DE METAS Y RENDIMIENTO GLOBAL CONSOLIDADO (Sinfonía Simétrica) */}
      <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
        <div className="flex flex-row items-start justify-between gap-4 mb-4">
          
          {/* Bloque Izquierdo: Meta Propuesta (Ahora perfectamente alineado sin el icono) */}
          <div className="flex flex-col items-start justify-start min-w-0">
            <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider leading-none">
              Meta Propuesta
            </span>
            {!readOnly && isEditingTarget ? (
              <div className="flex items-center gap-1.5 mt-1.5">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={tempTarget}
                  onChange={(e) => setTempTarget(e.target.value)}
                  className="w-14 text-sm font-semibold rounded-md border border-slate-300 dark:border-slate-700 px-1 py-0.5 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 text-center focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  autoFocus
                />
                <button onClick={handleSaveTarget} className="text-[11px] bg-indigo-600 hover:bg-indigo-500 text-white px-1.5 py-0.5 rounded-md transition-colors cursor-pointer font-medium">
                  OK
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 mt-1.5">
                <span className="text-xl font-extrabold text-slate-800 dark:text-slate-200 truncate leading-none">
                  {targetGrade} <span className="text-xs font-normal text-slate-400 lowercase">pts</span>
                </span>
                {!readOnly && (
                  <button onClick={() => setIsEditingTarget(true)} title="Editar meta" className="p-1 rounded-md text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer">
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Bloque Derecho: Llevas Acumulado */}
          <div className="text-right flex flex-col items-end justify-start shrink-0">
            <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider leading-none">
              Llevas acumulado
            </span>
            <span className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 block mt-1.5 leading-none">
              {parseFloat(globalProgress.toFixed(2))}%
            </span>
            <div className="mt-2.5 flex items-center justify-end gap-1 text-[11px] leading-none">
              <span className="text-slate-400 dark:text-slate-500">Suma raíz:</span>
              <span className={`font-bold ${rootSum === 100 ? 'text-emerald-500 dark:text-emerald-400' : 'text-amber-500 dark:text-amber-400'}`}>
                {rootSum}%
              </span>
            </div>
          </div>

        </div>

        {/* Notificación Dinámica de progreso */}
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

        {rootSum !== 100 && (
          <div className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-medium">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>La suma de los criterios base no es 100%.</span>
          </div>
        )}
      </div>

      {/* 📑 2. SUB-HEADER Y ACCIONES */}
      <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-4">
        <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
          {isRoot ? 'Criterios base' : 'Subcriterios actuales'}
        </div>
        {!readOnly && (
          <button onClick={onAdd} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer shadow-xs transition-all active:scale-98"> 
            <Plus className="w-3.5 h-3.5" /> Nuevo {isRoot ? 'Criterio' : 'Subcriterio'}
          </button>
        )}
      </div>

      {/* 📂 3. LISTADO DE NODOS ORDENADOS */}
      <div className="space-y-3">
        {sortedNodes.length === 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-sm text-slate-500 text-center">
            No hay elementos creados aún.
          </div>
        )}

        {sortedNodes.map((n) => {
          const currentBase = n.gradingBase || 100;

          return (
            <div key={n.id || n._id} className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl shadow-xs transition-all hover:border-slate-300 dark:hover:border-slate-700">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0">
                  {n.type === 'folder' ? <Folder className="w-5 h-5 text-indigo-500" /> : <FileText className="w-5 h-5 text-indigo-400" />}
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
                  readOnly ? (
                    <div className="w-20 text-sm text-center rounded-lg border border-slate-200 dark:border-slate-800 px-2 py-1 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50">
                      {n.grade == null ? 'Sin nota' : n.grade}
                    </div>
                  ) : (
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
                  )
                )}

                {!readOnly && (
                  <button onClick={() => onEdit(n)} title="Editar" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors cursor-pointer">
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
                {!readOnly && (
                  <button onClick={() => onDelete(n)} title="Eliminar" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-rose-600 transition-colors cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
