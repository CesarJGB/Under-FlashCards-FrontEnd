// ARCHIVO: frontend/src/components/FlashcardCollection.jsx
import { useState, useMemo } from 'react';
import { Search, ArrowUpDown } from 'lucide-react';
import FlashcardGrid from './FlashcardGrid';

export default function FlashcardCollection({ cards, onEdit, onDelete }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent'); // 'recent' | 'oldest' | 'images-first'

  // 🧠 MOTOR DE FILTRADO Y ORDENAMIENTO COMPUTADO
  const processedCards = useMemo(() => {
    // 1. Filtrado por Barra de Búsqueda (Insensible a mayúsculas/minúsculas)
    let result = cards.filter((card) => 
      card.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.answer.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // 2. Aplicación de Criterios de Ordenamiento Estrictos
    if (sortBy === 'recent') {
      result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sortBy === 'oldest') {
      result.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else if (sortBy === 'images-first') {
      result.sort((a, b) => (b.contentImage ? 1 : 0) - (a.contentImage ? 1 : 0));
    }

    return result;
  }, [cards, searchQuery, sortBy]);

  return (
    <div className="space-y-4 animate-[fadeIn_0.15s_ease]">
      {/* 🔍 PANEL DE CONTROLES: BUSCADOR + SORT */}
      <div className="mt-4 flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-50 border border-slate-200/60 p-3 rounded-2xl shadow-2xs">
        
        {/* Input de Búsqueda */}
        <div className="relative w-full sm:flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por pregunta o respuesta..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 placeholder:text-slate-400 shadow-3xs transition-all"
          />
        </div>

        {/* Dropdown de Ordenamiento */}
        <div className="relative w-full sm:w-auto shrink-0 flex items-center gap-2">
          <label htmlFor="sort-select" className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden md:inline">
            Ordenar por:
          </label>
          <div className="relative w-full sm:w-auto">
            <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            <select
              id="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full sm:w-48 pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none appearance-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 cursor-pointer shadow-3xs transition-all"
            >
              {/* ✨ CORREGIDO: Emojis removidos para una interfaz plana y limpia */}
              <option value="recent">Más recientes</option>
              <option value="oldest">Más antiguas</option>
              <option value="images-first">Con imagen primero</option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">
              ▼
            </div>
          </div>
        </div>

      </div>

      {/* 🎴 GRID DE TARJETAS PROCESADAS */}
      {processedCards.length === 0 ? (
        <div className="text-center border border-dashed border-slate-200 rounded-2xl py-12 bg-white text-slate-400 text-xs font-medium animate-[fadeIn_0.1s_ease]">
          No se encontraron tarjetas que coincidan con los filtros aplicados.
        </div>
      ) : (
        <FlashcardGrid cards={processedCards} onEdit={onEdit} onDelete={onDelete} />
      )}
    </div>
  );
}
