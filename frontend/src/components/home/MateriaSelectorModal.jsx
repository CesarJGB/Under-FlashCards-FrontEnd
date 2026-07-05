import React from 'react';
import { X, Check, CheckSquare, Square } from 'lucide-react';

export default function MateriaSelectorModal({
  materias,
  selectedMaterias,
  onToggle,
  onSelectAll,
  onClearAll,
  onClose
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
            Seleccionar Materias
          </h3>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>

        {/* Acciones rápidas */}
        <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex gap-2">
          <button
            onClick={onSelectAll}
            className="flex-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-2 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-950/60 transition-colors"
          >
            Seleccionar todas
          </button>
          <button
            onClick={onClearAll}
            className="flex-1 text-xs font-bold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-3 py-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            Limpiar selección
          </button>
        </div>

        {/* Lista de materias */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {materias.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-xs text-zinc-400">No hay materias disponibles</p>
            </div>
          ) : (
            materias.map((materia) => {
              const isSelected = selectedMaterias.includes(materia.id);
              return (
                <button
                  key={materia.id}
                  onClick={() => onToggle(materia.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20'
                      : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  {isSelected ? (
                    <CheckSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  ) : (
                    <Square className="w-5 h-5 text-zinc-400 shrink-0" />
                  )}
                  <div className="flex-1 text-left">
                    <p className="text-xs font-bold text-zinc-800 dark:text-zinc-100 truncate">
                      {materia.title}
                    </p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      {materia.masteryPercentage}% dominio · {materia.totalCards} tarjetas
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer con contador */}
        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <p className="text-xs text-zinc-500 text-center">
            {selectedMaterias.length} de {materias.length} materias seleccionadas
          </p>
        </div>
      </div>
    </div>
  );
}

