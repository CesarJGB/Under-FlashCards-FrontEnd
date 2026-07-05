import React, { useState, useEffect } from 'react';
import { Layers, AlertCircle, Settings, Plus } from 'lucide-react';
import MateriaSelectorModal from './MateriaSelectorModal';

export default function QuickViewGrid({ 
  enrichedMaterias, 
  getKnowledgeAccent, 
  getParcialesBadge,
  userId
}) {
  const [selectedMaterias, setSelectedMaterias] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Cargar selección guardada
  useEffect(() => {
    if (userId) {
      const saved = localStorage.getItem(`quickView_materias_${userId}`);
      if (saved) {
        setSelectedMaterias(JSON.parse(saved));
      }
    }
  }, [userId]);

  // Guardar selección cuando cambie
  useEffect(() => {
    if (userId && selectedMaterias.length > 0) {
      localStorage.setItem(`quickView_materias_${userId}`, JSON.stringify(selectedMaterias));
    }
  }, [selectedMaterias, userId]);

  const handleToggleMateria = (materiaId) => {
    setSelectedMaterias(prev => {
      if (prev.includes(materiaId)) {
        return prev.filter(id => id !== materiaId);
      }
      return [...prev, materiaId];
    });
  };

  const handleSelectAll = () => {
    setSelectedMaterias(enrichedMaterias.map(m => m.id));
  };

  const handleClearAll = () => {
    setSelectedMaterias([]);
  };

  // Filtrar materias según selección
  const visibleMaterias = selectedMaterias.length > 0
    ? enrichedMaterias.filter(m => selectedMaterias.includes(m.id))
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-500" />
          Vista Rápida de Asignaturas
        </h2>
        
        <button 
          onClick={() => setIsModalOpen(true)}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <Settings className="w-4 h-4 text-zinc-400" />
        </button>
      </div>
      
      {/* Estado vacío */}
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
                className="group bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200/70 dark:border-zinc-800 flex flex-col items-center text-center hover:shadow-md transition-shadow"
              >
                <div className="relative w-16 h-16 mb-2">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke="currentColor"
                      strokeWidth="6"
                      fill="none"
                      className="text-zinc-100 dark:text-zinc-800"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke="currentColor"
                      strokeWidth="6"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
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

      {/* Modal de selección */}
      {isModalOpen && (
        <MateriaSelectorModal
          materias={enrichedMaterias}
          selectedMaterias={selectedMaterias}
          onToggle={handleToggleMateria}
          onSelectAll={handleSelectAll}
          onClearAll={handleClearAll}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}

