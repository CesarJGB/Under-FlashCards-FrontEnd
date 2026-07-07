// FILE: frontend/src/components/home/QuickViewGrid.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Layers, Settings, Plus } from 'lucide-react';
import MateriaSelectorModal from './MateriaSelectorModal';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
import { getJSON, setJSON } from '../../lib/safeLocalStorage';

export default function QuickViewGrid({ 
  enrichedMaterias, 
  getKnowledgeAccent, 
  getParcialesBadge,
  userId,
  onMateriaClick
}) {
  const [selectedMaterias, setSelectedMaterias] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Ref para evitar race conditions en desmontaje
  const isMounted = useRef(true);
  const abortController = useRef(null);

  // ========================================================================
  // CARGA INICIAL CON CONFIANZA EN CACHÉ (stale-while-revalidate)
  // ========================================================================
  useEffect(() => {
    if (!userId) return;
    isMounted.current = true;

    const loadPreferences = async () => {
      // 1. Cargar desde localStorage INMEDIATAMENTE (sin spinner)
    const cached = getJSON(`quickView_materias_${userId}`);
    const cachedTimestamp = getJSON(`quickView_materias_${userId}_ts`);

    if (cached) {
      if (isMounted.current) setSelectedMaterias(cached);
    }

    // 2. Decidir si necesitamos sincronizar con backend
    const cacheAge = cachedTimestamp ? Date.now() - Number(cachedTimestamp) : Infinity;
      const needsSync = cacheAge > CACHE_TTL_MS;

      if (!needsSync) {
        // Caché fresco → no hacer fetch, solo marcar como listo
        if (isMounted.current) setIsInitialLoad(false);
        return;
      }

      // 3. Sincronización silenciosa en background
      
      // Cancelar request anterior si existe
      if (abortController.current) abortController.current.abort();
      abortController.current = new AbortController();

      try {
        const res = await fetch(`${BACKEND_URL}/api/users/${userId}/preferences`, {
          signal: abortController.current.signal
        });
        
        if (!isMounted.current) return;
        
        if (res.ok) {
          const data = await res.json();
          const serverMaterias = data.quickViewMaterias || [];
          
          // Actualizar estado solo si cambió (evita re-render innecesario)
          setSelectedMaterias(prev => {
            if (JSON.stringify(prev) === JSON.stringify(serverMaterias)) return prev;
            setJSON(`quickView_materias_${userId}`, serverMaterias);
            setJSON(`quickView_materias_${userId}_ts`, Date.now());
            return serverMaterias;
          });
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('[QuickViewGrid] Error al sincronizar:', error);
        }
      } finally {
        if (isMounted.current) {
          setIsInitialLoad(false);
        }
      }
    };

    loadPreferences();

    return () => {
      isMounted.current = false;
      if (abortController.current) abortController.current.abort();
    };
  }, [userId]);

  // ========================================================================
  // GUARDAR CON OPTIMISTIC UPDATE
  // ========================================================================
  const savePreferences = useCallback(async (materiasIds) => {
    if (!userId) return;

    // Actualizar localStorage INMEDIATAMENTE + timestamp
    setJSON(`quickView_materias_${userId}`, materiasIds);
    setJSON(`quickView_materias_${userId}_ts`, Date.now());

    // Sincronización silenciosa en background (sin UI de "saving")
    try {
      const res = await fetch(`${BACKEND_URL}/api/users/${userId}/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quickViewMaterias: materiasIds })
      });
      
      if (!res.ok) throw new Error('Error al sincronizar');
    } catch (error) {
      console.error('[QuickViewGrid] Error en sync:', error);
      // Opcional: retry o notificar al usuario si es crítico
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

  const handleCardClick = (materia) => {
    if (!onMateriaClick) return;
    
    const ap = materia.activeParciales || [];
    const isFiltered = ap.length > 0 && ap.length < 3;
    
    if (!isFiltered) {
      onMateriaClick({ materiaId: materia.id, parcialNumber: null, temaId: null, subtemaId: null });
    } else if (ap.length === 1) {
      onMateriaClick({ materiaId: materia.id, parcialNumber: ap[0], temaId: null, subtemaId: null });
    } else {
      onMateriaClick({ 
        materiaId: materia.id, 
        parcialNumber: null, 
        temaId: null, 
        subtemaId: null,
        filterActiveParciales: true
      });
    }
  };

  // ========================================================================
  // RENDERIZADO
  // ========================================================================
  const visibleMaterias = selectedMaterias.length > 0
    ? enrichedMaterias.filter(m => selectedMaterias.includes(m.id))
    : [];

  // Caso 1: Primera carga sin caché (usuario nuevo o localStorage vacío)
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
          onToggle={handleToggleMateria}
          onSelectAll={handleSelectAll}
          onClearAll={handleClearAll}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}
