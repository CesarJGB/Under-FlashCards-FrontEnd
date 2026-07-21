import { useState } from 'react';
import {
  Search,
  Filter,
  Clock,
  History,
  ArrowDownAZ,
  ArrowDownWideNarrow,
  ArrowUpWideNarrow
} from 'lucide-react';
import ActionSheet from '../common/ActionSheet';

const SORT_OPTIONS = [
  { id: 'recent', label: 'Más recientes', icon: Clock },
  { id: 'oldest', label: 'Más antiguos', icon: History },
  { id: 'alpha', label: 'Orden alfabético', icon: ArrowDownAZ },
  { id: 'cards-desc', label: 'Mayor número de tarjetas', icon: ArrowDownWideNarrow },
  { id: 'cards-asc', label: 'Menor número de tarjetas', icon: ArrowUpWideNarrow }
];

const DEFAULT_SORT = 'recent';

export default function LibraryToolbar({
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy
}) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const hasActiveFilter = sortBy !== DEFAULT_SORT;

  const sortSheetOptions = SORT_OPTIONS.map((opt) => ({
    id: opt.id,
    label: opt.label,
    icon: opt.icon,
    onSelect: () => setSortBy(opt.id)
  }));

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
          className="w-full h-12 pl-11 pr-4 bg-white border border-slate-200/60 rounded-[16px] text-sm font-medium text-slate-800 outline-none transition-all duration-200 placeholder:text-slate-400 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] focus:border-slate-300 focus:shadow-[0_4px_12px_rgba(0,0,0,0.06)]"
        />
      </div>

      {/* Botón de Opciones (Solo Ordenamiento) */}
      <button
        type="button"
        onClick={() => setOptionsOpen(true)}
        className={`relative w-12 h-12 rounded-[16px] flex items-center justify-center cursor-pointer transition-all duration-200 active:scale-95 border shadow-[0_1px_3px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] ${
          optionsOpen
            ? 'bg-slate-900 text-white border-slate-800 shadow-[0_4px_12px_rgba(0,0,0,0.15)]'
            : 'bg-white text-slate-500 border-slate-200/60 hover:text-slate-900 hover:border-slate-300 hover:shadow-[0_2px_4px_rgba(0,0,0,0.04)]'
        }`}
        title="Opciones de ordenamiento"
      >
        <Filter className="w-[18px] h-[18px]" />
        {hasActiveFilter && !optionsOpen && (
          <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-indigo-500 ring-2 ring-white" />
        )}
      </button>

      <ActionSheet
        open={optionsOpen}
        title="Ordenar por"
        options={sortSheetOptions}
        selectedId={sortBy}
        onClose={() => setOptionsOpen(false)}
      />

    </div>
  );
}
