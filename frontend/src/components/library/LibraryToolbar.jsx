// ARCHIVO: frontend/src/components/library/LibraryToolbar.jsx
import { useState } from 'react';
import {
  Search,
  Filter,
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
    <div className="mt-4 flex gap-2.5 items-center w-full relative">

      {/* Input de Búsqueda - Estilo Premium White / Glassmorphism */}
      <div className="relative flex-1">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar..."
          // Claves del premium: bg-white, sombra súper suave, borde casi invisible, transición de 200ms
          className="w-full h-12 pl-11 pr-4 bg-white border border-slate-200/60 rounded-[16px] text-sm font-medium text-slate-800 outline-none transition-all duration-200 placeholder:text-slate-400 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] focus:border-slate-300 focus:shadow-[0_4px_12px_rgba(0,0,0,0.06)]"
        />
      </div>

      {/* Botón de Opciones - Estilo Premium con profundidad */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOptionsOpen(!optionsOpen)}
          // Claves del premium: sombra suave constante, escala al presionar, transición de colores suave
          className={`relative w-12 h-12 rounded-[16px] flex items-center justify-center cursor-pointer transition-all duration-200 active:scale-95 border shadow-[0_1px_3px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] ${
            optionsOpen
              ? 'bg-slate-900 text-white border-slate-800 shadow-[0_4px_12px_rgba(0,0,0,0.15)]'
              : 'bg-white text-slate-500 border-slate-200/60 hover:text-slate-900 hover:border-slate-300 hover:shadow-[0_2px_4px_rgba(0,0,0,0.04)]'
          }`}
          title="Opciones de biblioteca"
        >
          <Filter className="w-[18px] h-[18px]" />
          {hasActiveFilter && !optionsOpen && (
            // Punto de notificación más estilizado
            <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-indigo-500 ring-2 ring-white" />
          )}
        </button>

        {/* Desplegable Contextual - Súper limpio y flotante */}
        {optionsOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-transparent"
              onClick={() => setOptionsOpen(false)}
            />
            <div className="absolute right-0 mt-3 w-64 origin-top-right bg-white/90 backdrop-blur-xl border border-slate-100 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] z-50 p-2 animate-[slideUp_0.15s_ease-out] flex flex-col gap-0.5">

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
                    // Hover más suave, border radius perfecto
                    className={`w-full text-left px-2.5 py-2 hover:bg-slate-50 text-[12px] font-semibold rounded-xl flex items-center gap-2.5 transition-colors duration-150 cursor-pointer ${
                      isActive ? 'text-slate-950 bg-slate-50' : 'text-slate-600'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-slate-900' : 'text-slate-400'}`} />
                    <span className="flex-1">{opt.label}</span>
                    {isActive && <Check className="w-4 h-4 text-slate-900 stroke-[2.5]" />}
                  </button>
                );
              })}

              {/* SEPARATOR */}
              <div className="my-1.5 border-t border-slate-100/80" />

              {/* SECCIÓN 2: INTERCAMBIADOR DE VISTA */}
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2.5 py-1.5 block">
                Visualización
              </span>

              <button
                type="button"
                onClick={() => { setViewMode('grid'); setOptionsOpen(false); }}
                className={`w-full text-left px-2.5 py-2 hover:bg-slate-50 text-[12px] font-semibold rounded-xl flex items-center gap-2.5 transition-colors duration-150 cursor-pointer ${
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
                className={`w-full text-left px-2.5 py-2 hover:bg-slate-50 text-[12px] font-semibold rounded-xl flex items-center gap-2.5 transition-colors duration-150 cursor-pointer ${
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
