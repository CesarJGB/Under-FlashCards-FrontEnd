// ARCHIVO: frontend/src/components/library/LibraryToolbar.jsx
import { useState } from 'react';
import { Search, MoreHorizontal, Grid, List, Check } from 'lucide-react';

export default function LibraryToolbar({
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  viewMode,
  setViewMode
}) {
  const [optionsOpen, setOptionsOpen] = useState(false);

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
          className="w-full h-10 pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 placeholder:text-slate-400 shadow-3xs transition-all"
        />
      </div>

      {/* Botón de Tres Puntos Horizontales (Filtros) */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOptionsOpen(!optionsOpen)}
          className={`w-10 h-10 border text-slate-500 rounded-xl shadow-3xs transition-all active:scale-[0.97] flex items-center justify-center cursor-pointer ${
            optionsOpen 
              ? 'bg-slate-100 border-slate-300 text-slate-900' 
              : 'bg-white border-slate-200 hover:text-slate-900 hover:bg-slate-50'
          }`}
          title="Opciones de biblioteca"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>

        {/* Desplegable Contextual Unificado (Sort + Grid View) */}
        {optionsOpen && (
          <>
            <div 
              className="fixed inset-0 z-40 bg-transparent" 
              onClick={() => setOptionsOpen(false)} 
            />
            <div className="absolute right-0 mt-2 w-60 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-1.5 animate-[slideUp_0.12s_ease-out] flex flex-col gap-0.5">
              
              {/* SECCIÓN 1: ORDENAMIENTO */}
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2.5 py-1 block">
                Ordenar por
              </span>
              
              {[
                { label: 'Más recientes', value: 'recent' },
                { label: 'Más antiguos', value: 'oldest' },
                { label: 'Orden alfabético', value: 'alpha' },
                { label: 'Mayor número de tarjetas', value: 'cards-desc' },
                { label: 'Menor número de tarjetas', value: 'cards-asc' }
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setSortBy(opt.value); setOptionsOpen(false); }}
                  className={`w-full text-left px-2.5 py-1.5 hover:bg-slate-50 text-[11px] font-bold rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                    sortBy === opt.value ? 'text-slate-950 bg-slate-50/60' : 'text-slate-600'
                  }`}
                >
                  <span>{opt.label}</span>
                  {sortBy === opt.value && <Check className="w-3.5 h-3.5 text-slate-900 stroke-[2.5]" />}
                </button>
              ))}

              {/* SEPARATOR */}
              <div className="my-1 border-t border-slate-100" />

              {/* SECCIÓN 2: INTERCAMBIADOR DE VISTA */}
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2.5 py-1 block">
                Visualización
              </span>

              <button
                type="button"
                onClick={() => { setViewMode('grid'); setOptionsOpen(false); }}
                className={`w-full text-left px-2.5 py-1.5 hover:bg-slate-50 text-[11px] font-bold rounded-lg flex items-center gap-2 transition-colors cursor-pointer ${
                  viewMode === 'grid' ? 'text-slate-950 bg-slate-50/60' : 'text-slate-600'
                }`}
              >
                <Grid className="w-3.5 h-3.5 text-slate-400" />
                <span className="flex-1">Vista cuadrícula</span>
                {viewMode === 'grid' && <Check className="w-3.5 h-3.5 text-slate-900 stroke-[2.5]" />}
              </button>

              <button
                type="button"
                onClick={() => { setViewMode('list'); setOptionsOpen(false); }}
                className={`w-full text-left px-2.5 py-1.5 hover:bg-slate-50 text-[11px] font-bold rounded-lg flex items-center gap-2 transition-colors cursor-pointer ${
                  viewMode === 'list' ? 'text-slate-950 bg-slate-50/60' : 'text-slate-600'
                }`}
              >
                <List className="w-3.5 h-3.5 text-slate-400" />
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
