// ARCHIVO: frontend/src/components/library/LibraryToolbar.jsx
import { useState } from 'react';
import {
  Search,
  Filter, // Cambiamos SlidersHorizontal por Filter para matchear la referencia
  Grid,
  List,
  Check,
  Clock,
  History,
  ArrowDownAZ,
  ArrowDownWideNarrow,
  ArrowUpWideNarrow
} from 'lucide-react';

const SORT_OPTIONS = [
  { label: 'Más recientes', value: 'recent', icon: Clock },
  { label: 'Más antiguos', value: 'oldest', icon: History },
  { label: 'Orden alfabético', value: 'alpha', icon: ArrowDownAZ },
  { label: 'Mayor número de tarjetas', value: 'cards-desc', icon: ArrowDownWideNarrow },
  { label: 'Menor número de tarjetas', value: 'cards-asc', icon: ArrowUpWideNarrow }
];

const DEFAULT_SORT = 'recent';

export default function LibraryToolbar({
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  viewMode,
  setViewMode
}) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const hasActiveFilter = sortBy !== DEFAULT_SORT;

  return (
    // Aumenté un poco el margen superior y separación para que respire mejor
    <div className="mt-3 flex gap-3 items-center w-full relative">

      {/* Input de Búsqueda de Mazos - Estilo Moderno Sin Bordes */}
      <div className="relative flex-1">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar..." // Texto más limpio como en la referencia
          // Cambios clave: bg-slate-100, sin border, rounded-2xl, text-sm, sombra suave al hacer focus
          className="w-full h-12 pl-11 pr-4 bg-slate-100 rounded-2xl text-sm font-medium text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/5 focus:shadow-[0_4px_12px_rgba(0,0,0,0.05)] placeholder:text-slate-400 transition-all"
        />
      </div>

      {/* Botón de Opciones (Ordenar + Vista) - Estilo Moderno Sin Bordes */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOptionsOpen(!optionsOpen)}
          // Cambios clave: w-12 h-12, bg-slate-100, sin border, sombra sutil al activar
          className={`relative w-12 h-12 rounded-2xl flex items-center justify-center cursor-pointer transition-all active:scale-[0.95] ${
            optionsOpen
              ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200/70 hover:text-slate-900'
          }`}
          title="Opciones de biblioteca"
        >
          <Filter className="w-[18px] h-[18px]" />
          {hasActiveFilter && !optionsOpen && (
            // El punto de "filtro activo" ahora tiene un color azul/índigo para destacar sobre el gris
            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-indigo-500 ring-2 ring-slate-100" />
          )}
        </button>

        {/* Desplegable Contextual Unificado (Sort + Grid View) */}
        {optionsOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-transparent"
              onClick={() => setOptionsOpen(false)}
            />
            {/* Mejorado el shadow y el borde del dropdown */}
            <div className="absolute right-0 mt-2 w-64 origin-top-right bg-white/95 backdrop-blur-xl border border-slate-100 rounded-2xl shadow-2xl shadow-slate-900/10 z-50 p-1.5 animate-[slideUp_0.15s_ease-out] flex flex-col gap-0.5">

              {/* SECCIÓN 1: ORDENAMIENTO */}
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2.5 py-1.5 block">
                Ordenar por
              </span>

              {SORT_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isActive = sortBy === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setSortBy(opt.value); setOptionsOpen(false); }}
                    className={`w-full text-left px-2.5 py-2 hover:bg-slate-50 text-[12px] font-semibold rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer ${
                      isActive ? 'text-slate-950 bg-slate-50' : 'text-slate-600'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-slate-900' : 'text-slate-400'}`} />
                    <span className="flex-1">{opt.label}</span>
                    {isActive && <Check className="w-4 h-4 text-slate-900 stroke-[2.5]" />}
                  </button>
                );
              })}

              {/* SEPARATOR */}
              <div className="my-1.5 border-t border-slate-100" />

              {/* SECCIÓN 2: INTERCAMBIADOR DE VISTA */}
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2.5 py-1.5 block">
                Visualización
              </span>

              <button
                type="button"
                onClick={() => { setViewMode('grid'); setOptionsOpen(false); }}
                className={`w-full text-left px-2.5 py-2 hover:bg-slate-50 text-[12px] font-semibold rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer ${
                  viewMode === 'grid' ? 'text-slate-950 bg-slate-50' : 'text-slate-600'
                }`}
              >
                <Grid className={`w-4 h-4 ${viewMode === 'grid' ? 'text-slate-900' : 'text-slate-400'}`} />
                <span className="flex-1">Vista cuadrícula</span>
                {viewMode === 'grid' && <Check className="w-4 h-4 text-slate-900 stroke-[2.5]" />}
              </button>

              <button
                type="button"
                onClick={() => { setViewMode('list'); setOptionsOpen(false); }}
                className={`w-full text-left px-2.5 py-2 hover:bg-slate-50 text-[12px] font-semibold rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer ${
                  viewMode === 'list' ? 'text-slate-950 bg-slate-50' : 'text-slate-600'
                }`}
              >
                <List className={`w-4 h-4 ${viewMode === 'list' ? 'text-slate-900' : 'text-slate-400'}`} />
                <span className="flex-1">Vista lista</span>
                {viewMode === 'list' && <Check className="w-4 h-4 text-slate-900 stroke-[2.5]" />}
              </button>

            </div>
          </>
        )}
      </div>

    </div>
  );
}
