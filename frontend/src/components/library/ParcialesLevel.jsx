import React, { useState, useEffect } from 'react'; // 👈 Agregar useEffect
import { ChevronRight } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export default function ParcialesLevel({
  temas = [],
  currentPath,
  setCurrentPath,
  materia,
  onActiveParcialesChange,
  filterActiveOnly = false // 👈 NUEVO
}) {
  const partialsConfig = [
    { num: 1, label: 'Primer parcial' },
    { num: 2, label: 'Segundo parcial' },
    { num: 3, label: 'Tercer parcial' }
  ];

  const [activeParciales, setActiveParciales] = useState(
    materia?.activeParciales || [1, 2, 3]
  );

  // 👇 NUEVO: Sincronizar estado local cuando cambia la materia
  useEffect(() => {
    setActiveParciales(materia?.activeParciales || [1, 2, 3]);
  }, [materia?._id, materia?.id, materia?.activeParciales]);

  const handleToggle = async (e, parcialNum) => {
    e.stopPropagation();
    const isActive = activeParciales.includes(parcialNum);
    const next = isActive
      ? activeParciales.filter(n => n !== parcialNum)
      : [...activeParciales, parcialNum].sort();

    if (next.length === 0) return;

    setActiveParciales(next);

    try {
      const res = await fetch(`${BACKEND_URL}/api/academic/materias/${currentPath.materiaId}/active-parciales`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeParciales: next })
      });
      if (!res.ok) {
        setActiveParciales(activeParciales);
        return;
      }
      if (onActiveParcialesChange) onActiveParcialesChange(currentPath.materiaId, next);
    } catch {
      setActiveParciales(activeParciales);
    }
  };

  // 👇 NUEVO: Filtrar configuración según modo
  const visiblePartials = filterActiveOnly
    ? partialsConfig.filter(p => activeParciales.includes(p.num))
    : partialsConfig;

  return (
    <div className="mt-6 animate-[fadeIn_0.15s_ease]">
      {/* 👇 Mensaje contextual cuando está filtrado */}
      {filterActiveOnly && (
        <div className="mb-4 px-4 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
          <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
            Mostrando solo parciales activos en Vista Rápida
          </p>
          <button 
            onClick={() => setCurrentPath({ ...currentPath })} // Trigger re-render sin filtro
            className="text-[11px] text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-200 mt-0.5 font-medium underline underline-offset-2"
          >
            Ver todos los parciales
          </button>
        </div>
      )}

      <div className={`grid gap-4 ${
        filterActiveOnly && visiblePartials.length === 2 
          ? 'grid-cols-1 sm:grid-cols-2' 
          : 'grid-cols-1 sm:grid-cols-3'
      }`}>
        {visiblePartials.map((p) => {
          const count = temas.filter(
            t => String(t.materiaId || '') === String(currentPath.materiaId) && t.parcialNumber === p.num
          ).length;
          const isActive = activeParciales.includes(p.num);

          return (
            <div
              key={p.num}
              onClick={() => setCurrentPath({ ...currentPath, parcialNumber: p.num })}
              className="bg-white border border-slate-200 p-5 rounded-2xl hover:border-indigo-200 hover:shadow-xs transition-all duration-200 cursor-pointer flex flex-col justify-between h-32 active:scale-[0.98] group"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-slate-950 tracking-tight group-hover:text-indigo-600 transition-colors">
                  {p.label}
                </h4>
                {/* Solo mostrar toggle si NO estamos en modo filtrado */}
                {!filterActiveOnly && (
                  <button
                    onClick={(e) => handleToggle(e, p.num)}
                    className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
                      isActive ? 'bg-indigo-500' : 'bg-slate-300'
                    }`}
                    title={isActive ? 'Incluido en dominio' : 'Excluido del dominio'}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                      isActive ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                <span>{count} tema(s)</span>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all duration-200" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

