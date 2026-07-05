// FILE: frontend/src/components/home/QuickViewGrid.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Layers, Settings, Plus, Loader2 } from 'lucide-react';
import MateriaSelectorModal from './MateriaSelectorModal';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export default function QuickViewGrid({ 
  enrichedMaterias, 
  getKnowledgeAccent, 
  getParcialesBadge,
  userId,
  onMateriaClick // 👈 Prop agregada para la navegación interactiva
}) {
  const [selectedMaterias, setSelectedMaterias] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Cargar preferencias desde backend + localStorage
  useEffect(() => {
    if (!userId) return;

    const loadPreferences = async () => {
      setIsLoading(true);
      
      // 1. Cargar desde localStorage inmediatamente (caché)
      const cached = localStorage.getItem(`quickView_materias_${userId}`);
      if (cached) {
        setSelectedMaterias(JSON.parse(cached));
      }

      // 2. Sincronizar con backend
      try {
        const res = await fetch(`${BACKEND_URL}/api/users/${userId}/preferences`);
        if (res.ok) {
          const data = await res.json();
          const serverMaterias = data.quickViewMaterias || [];
          setSelectedMaterias(serverMaterias);
          // Actualizar caché local
          localStorage.setItem(`quickView_materias_${userId}`, JSON.stringify(serverMaterias));
        }
      } catch (error) {
        console.error('Error al cargar preferencias:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, [userId]);

  // Guardar cambios en backend + localStorage
  const savePreferences = useCallback(async (materiasIds) => {
    if (!userId) return;

    // Actualizar localStorage inmediatamente
    localStorage.setItem(`quickView_materias_${userId}`, JSON.stringify(materiasIds));

    // Sincronizar con backend
    setIsSaving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/users/${userId}/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quickViewMaterias: materiasIds })
      });

      if (!res.ok) {
        throw new Error('Error al guardar preferencias');
      }
    } catch (error) {
      console.error('Error al sincronizar preferencias:', error);
    } finally {
      setIsSaving(false);
    }
  }, [userId]);

  const handleToggleMateria = (materiaId) => {
    setSelectedMaterias(prev => {
      const newSelection = prev.includes(materiaId)
        ? prev.filter(id => id !== materiaId)
        : [...prev, materiaId];
      
      savePreferences(newSelection);
      return newSelection;
    });
  };

  const handleSelectAll = () => {
    const allIds = enrichedMaterias.map(m => m.id);
    setSelectedMaterias(allIds);
    savePreferences(allIds);
  };

  const handleClearAll = () => {
    setSelectedMaterias([]);
    savePreferences([]);
  };

  // Handler de navegación inteligente basado en parciales activos
  const handleCardClick = (materia) => {
    if (!onMateriaClick) return;
    
    const ap = materia.activeParciales || [];
    const isFiltered = ap.length > 0 && ap.length < 3;
    
    if (!isFiltered) {
      // Caso A: Dominio general (0 o 3 parciales) → Selector de parciales amplio
      onMateriaClick({ 
        materiaId: materia.id, 
        parcialNumber: null, 
        temaId: null, 
        subtemaId: null 
      });
    } else if (ap.length === 1) {
      // Caso B: 1 parcial activo → Va directo a los temas de ese parcial único
      onMateriaClick({ 
        materiaId: materia.id, 
        parcialNumber: ap[0], 
        temaId: null, 
        subtemaId: null 
      });
    } else {
      // Caso C: 2 parciales activos → Abre el selector filtrado en ParcialesLevel
      onMateriaClick({ 
        materiaId: materia.id, 
        parcialNumber: null, 
        temaId: null, 
        subtemaId: null,
        filterActiveParciales: true
      });
    }
  };

  // Filtrar materias según selección para renderizado
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
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors relative"
          disabled={isSaving}
        >
          <Settings className={`w-4 h-4 text-zinc-400 ${isSaving ? 'animate-spin' : ''}`} />
          {isSaving && (
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
          )}
        </button>
      </div>
      
      {/* Estado de carga inicial */}
      {isLoading ? (
        <div className="p-10 text-center rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
          <Loader2 className="w-7 h-7 text-zinc-400 mx-auto mb-2 animate-spin" />
          <p className="text-zinc-700 dark:text-zinc-300 text-xs font-bold">
            Cargando materias...
          </p>
        </div>
      ) : visibleMaterias.length === 0 ? (
        /* Estado vacío */
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
        /* Grid de materias interactivo */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {visibleMaterias.map((materia) => {
            const accent = getKnowledgeAccent(materia.masteryPercentage);
            const circumference = 2 * Math.PI * 28;
            const strokeDashoffset = circumference - (materia.masteryPercentage / 100) * circumference;
            const parcialesBadge = getParcialesBadge(materia.activeParciales);
            
            return (
              <div 
                key={materia.id}
                onClick={() => handleCardClick(materia)} // 👈 Dispara la redirección inteligente
                className="group bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200/70 dark:border-zinc-800 flex flex-col items-center text-center hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-900 transition-all cursor-pointer active:scale-[0.97]"
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
