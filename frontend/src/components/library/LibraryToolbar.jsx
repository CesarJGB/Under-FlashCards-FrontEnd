// ARCHIVO: frontend/src/components/library/LibraryToolbar.jsx
import { useState } from 'react';
import {
  Search,
  SlidersHorizontal,
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
    <div className="mt-1.5 flex gap-2 items-center w-full relative">

      {/* Input de Búsqueda de Mazos */}
      <div className="relative flex-1">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar materias, temas o mazos..."
          className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 focus:bg-white placeholder:text-slate-400 shadow-3xs transition-all"
        />
      </div>

      {/* Botón de Opciones (Ordenar + Vista) */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOptionsOpen(!optionsOpen)}
          className={`relative w-11 h-11 border text-slate-500 rounded-2xl shadow-3xs transition-all active:scale-[0.97] flex items-center justify-center cursor-pointer ${
            optionsOpen
              ? 'bg-slate-900 border-slate-900 text-white'
              : 'bg-slate-50 border-slate-200/80 hover:text-slate-900 hover:bg-slate-100'
          }`}
          title="Opciones de biblioteca"
        >
          <SlidersHorizontal className="w-4 h-4" />
          {hasActiveFilter && !optionsOpen && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-slate-900 ring-2 ring-white" />
          )}
        </button>

        {/* Desplegable Contextual Unificado (Sort + Grid View) */}
        {optionsOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-transparent"
              onClick={() => setOptionsOpen(false)}
            />
            <div className="absolute right-0 mt-2 w-64 origin-top-right bg-white/95 backdrop-blur border border-slate-200/80 rounded-2xl shadow-xl shadow-slate-900/10 z-50 p-1.5 animate-[slideUp_0.15s_ease-out] flex flex-col gap-0.5">

              {/* SECCIÓN 1: ORDENAMIENTO */}
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2.5 py-1 block">
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
                    className={`w-full text-left px-2.5 py-1.5 hover:bg-slate-50 text-[11px] font-bold rounded-xl flex items-center gap-2 transition-colors cursor-pointer ${
                      isActive ? 'text-slate-950 bg-slate-50' : 'text-slate-600'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-slate-900' : 'text-slate-400'}`} />
                    <span className="flex-1">{opt.label}</span>
                    {isActive && <Check className="w-3.5 h-3.5 text-slate-900 stroke-[2.5]" />}
                  </button>
                );
              })}

              {/* SEPARATOR */}
              <div className="my-1 border-t border-slate-100" />

              {/* SECCIÓN 2: INTERCAMBIADOR DE VISTA */}
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2.5 py-1 block">
                Visualización
              </span>

              <button
                type="button"
                onClick={() => { setViewMode('grid'); setOptionsOpen(false); }}
                className={`w-full text-left px-2.5 py-1.5 hover:bg-slate-50 text-[11px] font-bold rounded-xl flex items-center gap-2 transition-colors cursor-pointer ${
                  viewMode === 'grid' ? 'text-slate-950 bg-slate-50' : 'text-slate-600'
                }`}
              >
                <Grid className={`w-3.5 h-3.5 ${viewMode === 'grid' ? 'text-slate-900' : 'text-slate-400'}`} />
                <span className="flex-1">Vista cuadrícula</span>
                {viewMode === 'grid' && <Check className="w-3.5 h-3.5 text-slate-900 stroke-[2.5]" />}
              </button>

              <button
                type="button"
                onClick={() => { setViewMode('list'); setOptionsOpen(false); }}
                className={`w-full text-left px-2.5 py-1.5 hover:bg-slate-50 text-[11px] font-bold rounded-xl flex items-center gap-2 transition-colors cursor-pointer ${
                  viewMode === 'list' ? 'text-slate-950 bg-slate-50' : 'text-slate-600'
                }`}
              >
                <List className={`w-3.5 h-3.5 ${viewMode === 'list' ? 'text-slate-900' : 'text-slate-400'}`} />
                <span className="flex-1">Vista lista</span>
                {viewMode === 'list' && <Check className="w-3.5 h-3.5 text-slate-900 stroke-[2.5]" />}
              </button>

            </div>
          </>
        )}
      </div>

    </div>
  );
}
