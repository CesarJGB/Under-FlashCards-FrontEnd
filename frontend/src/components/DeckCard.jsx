// ARCHIVO: frontend/src/components/DeckCard.jsx
import { Pencil, Trash2, Layers, Star } from 'lucide-react';

const isDark = (hex) => {
  if (!hex || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 140;
};

export default function DeckCard({ deck, onOpen, onEdit, onDelete, onToggleStar, isList = false }) {
  const dark = deck.coverImage ? true : isDark(deck.coverColor);
  
  // 📐 ESTILOS HÍBRIDOS DINÁMICOS
  const bgStyle = deck.coverImage
    ? { backgroundImage: `url(${deck.coverImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { backgroundColor: deck.coverColor || '#ffffff' };

  // 📝 CLASES DINÁMICAS POR MODO (GRID VS LISTA)
  const containerClasses = isList
    ? "group relative w-full text-left flex items-center justify-between p-4 min-h-[72px] rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 shadow-3xs hover:shadow-2xs transition-all overflow-hidden cursor-pointer"
    : "group relative w-full text-left h-44 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden cursor-pointer flex flex-col justify-end";

  // Si está en modo lista, cancelamos la imagen/color de fondo de la tarjeta entera para un look tipo fila limpio
  const currentBgStyle = isList ? {} : bgStyle;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(deck)}
      style={currentBgStyle}
      className={containerClasses}
    >
      {/* 🎨 DECORACIÓN DE CAPA DE DISEÑO (SOLO MODO GRID) */}
      {!isList && (
        <>
          <span className="absolute top-3 left-1/2 -translate-y-1/2 w-8 h-2 rounded-full bg-black/15" />
          <span className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/55 to-transparent" />
        </>
      )}

      {/* --- MODO LISTA: MAQUETACIÓN LINEAL HORIZONTAL --- */}
      {isList ? (
        <>
          <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-4">
            {/* Miniatura del color/imagen del mazo a la izquierda */}
            <div 
              style={bgStyle} 
              className="w-11 h-11 rounded-xl shrink-0 border border-slate-200/40 relative flex items-center justify-center overflow-hidden shadow-3xs"
            >
              {!deck.coverImage && (
                <Layers className={`w-4 h-4 ${dark ? 'text-white/40' : 'text-slate-400'}`} />
              )}
            </div>

            {/* Metadatos del Mazo en la fila */}
            <div className="min-w-0">
              <p className="font-bold text-slate-800 text-sm truncate" title={deck.title}>
                {deck.title}
              </p>
              <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                {deck.cardCount ?? 0} {deck.cardCount === 1 ? 'tarjeta' : 'tarjetas'}
              </p>
            </div>
          </div>

          {/* Acciones de la fila (Siempre visibles en móvil para listas fáciles) */}
          <div className="flex items-center gap-1.5 shrink-0 z-10" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => onToggleStar(deck)}
              className={`p-2 rounded-xl transition-colors ${
                deck.isStarred ? 'text-amber-500 bg-amber-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Star className={`w-4 h-4 ${deck.isStarred ? 'fill-amber-500' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => onEdit(deck)}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(deck)}
              className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </>
      ) : (
        /* --- MODO CUADRÍCULA ORIGINAL (OPTIMIZADO PARA DOS COLUMNAS EN MÓVIL) --- */
        <>
          {/* ⭐ BOTÓN DE ESTRELLA (FAVORITO) */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleStar(deck); }}
            className={`absolute top-2 left-2 p-1.5 rounded-lg transition-all z-10 cursor-pointer ${
              deck.isStarred 
                ? 'bg-white/90 text-amber-500 shadow-sm scale-100' 
                : 'bg-white/70 text-slate-400 opacity-100 sm:opacity-0 group-hover:opacity-100 hover:bg-white hover:text-slate-600'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${deck.isStarred ? 'fill-amber-500' : ''}`} />
          </button>

          {/* MENÚ DE ACCIONES FLOTANTES (Visibles por defecto en móvil para evitar conflictos de hover) */}
          <div 
            className="absolute top-2 right-2 flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => onEdit(deck)}
              className="p-1.5 rounded-lg bg-white/90 text-slate-700 hover:bg-white cursor-pointer shadow-3xs"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(deck)}
              className="p-1.5 rounded-lg bg-white/90 text-red-600 hover:bg-white cursor-pointer shadow-3xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Información del mazo en la parte inferior */}
          <div className="p-3 sm:p-4 w-full z-0 min-w-0">
            <p 
              className={`font-bold drop-shadow-xs truncate ${dark ? 'text-white' : 'text-slate-900 bg-white/40 backdrop-blur-3xs px-1.5 py-0.5 rounded-lg inline-block max-w-full'}`}
              title={deck.title}
            >
              {deck.title}
            </p>
            <p className={`text-[11px] sm:text-xs mt-0.5 ${dark ? 'text-white/80' : 'text-slate-500 font-semibold'}`}>
              {deck.cardCount ?? 0} {deck.cardCount === 1 ? 'tarjeta' : 'tarjetas'}
            </p>
          </div>

          {!deck.coverImage && !dark && (
            <span className="absolute top-4 right-4 text-slate-900/10 pointer-events-none">
              <Layers className="w-12 h-12 stroke-[1.2]" />
            </span>
          )}
        </>
      )}
    </div>
  );
}
