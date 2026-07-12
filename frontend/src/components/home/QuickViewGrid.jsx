// FILE: frontend/src/components/home/QuickViewGrid.jsx
import React, { useState } from 'react';
import { Layers, Settings, Plus } from 'lucide-react';
import MateriaSelectorModal from './MateriaSelectorModal';
import { buildQuickViewNavigationTarget } from './quickViewNavigation';

export default function QuickViewGrid({ 
  enrichedMaterias, 
  visibleMaterias,
  selectedMaterias,
  isInitialLoad,
  onToggleMateria,
  onSelectAll,
  onClearAll,
  getKnowledgeAccent, 
  getParcialesBadge,
  onMateriaClick
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const handleCardClick = (materia) => {
    if (!onMateriaClick) return;
    onMateriaClick(buildQuickViewNavigationTarget(materia));
  };

  if (isInitialLoad && selectedMaterias.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-500" />
            Vista Rápida de Asignaturas
          </h2>
        </div>
        <div className="p-10 text-center rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
          <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-zinc-700 dark:text-zinc-300 text-xs font-bold">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-500" />
          Vista Rápida de Asignaturas
          {/* Indicador sutil de sync eliminado (sin UI). Sincronización en background sigue funcionando. */}
        </h2>
        
        <button 
          onClick={() => setIsModalOpen(true)}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <Settings className="w-4 h-4 text-zinc-400" />
        </button>
      </div>

      {visibleMaterias.length === 0 ? (
        <div className="p-10 text-center rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
          <Plus className="w-7 h-7 text-zinc-400 mx-auto mb-2" />
          <p className="text-zinc-700 dark:text-zinc-300 text-xs font-bold">
            No hay materias en vista rápida
          </p>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Presiona el ícono de configuración para seleccionar materias
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {visibleMaterias.map((materia) => {
            const accent = getKnowledgeAccent(materia.masteryPercentage);
            const circumference = 2 * Math.PI * 28;
            const strokeDashoffset = circumference - (materia.masteryPercentage / 100) * circumference;
            const parcialesBadge = getParcialesBadge(materia.activeParciales);
            
            return (
              <div 
                key={materia.id}
                onClick={() => handleCardClick(materia)}
                className="group bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200/70 dark:border-zinc-800 flex flex-col items-center text-center hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-900 transition-all cursor-pointer active:scale-[0.97]"
              >
                <div className="relative w-16 h-16 mb-2">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="none" className="text-zinc-100 dark:text-zinc-800" />
                    <circle 
                      cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="none" 
                      strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                      className={`${accent.circle} transition-all duration-500`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-black text-zinc-800 dark:text-zinc-200">
                      {materia.masteryPercentage}%
                    </span>
                  </div>
                </div>

                <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-100 truncate w-full px-1">
                  {materia.title}
                </h3>

                {parcialesBadge && (
                  <span className="text-[9px] font-bold mt-1 px-1.5 py-0.5 rounded text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40">
                    {parcialesBadge}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <MateriaSelectorModal
          materias={enrichedMaterias}
          selectedMaterias={selectedMaterias}
          onToggle={onToggleMateria}
          onSelectAll={onSelectAll}
          onClearAll={onClearAll}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}
