// ARCHIVO: frontend/src/components/DeckCard.jsx
import { Pencil, Trash2, Star } from 'lucide-react';

const isDark = (hex) => {
  if (!hex || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 140;
};

export default function DeckCard({ deck, onOpen, onEdit, onDelete, onToggleStar, isList = false }) {
  const dark = deck.coverImage ? true : isDark(deck.coverColor);
  
  // 📐 Estilos de fondo (Imagen o Color Sólido)
  const bgStyle = deck.coverImage
    ? { backgroundImage: `url(${deck.coverImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { backgroundColor: deck.coverColor || '#ffffff' };

  // 📝 Modificamos h-44 por h-32 para forzar la geometría rectangular geométrica limpia
  const containerClasses = isList
    ? "group relative w-full text-left flex items-center justify-between p-4 min-h-[72px] rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 shadow-3xs hover:shadow-2xs transition-all overflow-hidden cursor-pointer"
    : "group relative w-full text-left h-32 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden cursor-pointer flex flex-col justify-end";

  const currentBgStyle = isList ? {} : bgStyle;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(deck)}
      style={currentBgStyle}
      className={containerClasses}
    >
      {/* 🎨 Capa de gradiente sutil para legibilidad de fuentes (Solo Modo Grid) */}
      {!isList && (
        <span className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/60 via-black/20 to-transparent pointer-events-none" />
      )}

      {/* --- MODO LISTA --- */}
      {isList ? (
        <>
          <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-4">
            <div 
              style={bgStyle} 
              className="w-11 h-11 rounded-xl shrink-0 border border-slate-200/40 relative flex items-center justify-center overflow-hidden shadow-3xs"
            />
            <div className="min-w-0">
              <p className="font-bold text-slate-800 text-sm truncate" title={deck.title}>
                {deck.title}
              </p>
              <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                {deck.cardCount ?? 0} {deck.cardCount === 1 ? 'tarjeta' : 'tarjetas'}
              </p>
            </div>
          </div>

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
        /* --- MODO CUADRÍCULA (REDISEÑADO Y LIMPIO) --- */
        <>
          {/* ⭐ Botón de Estrella */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleStar(deck); }}
            className={`absolute top-2.5 left-2.5 p-1.5 rounded-lg transition-all z-10 cursor-pointer ${
              deck.isStarred 
                ? 'bg-white/90 text-amber-500 shadow-sm scale-100' 
                : 'bg-white/70 text-slate-400 opacity-100 sm:opacity-0 group-hover:opacity-100 hover:bg-white hover:text-slate-600'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${deck.isStarred ? 'fill-amber-500' : ''}`} />
          </button>

          {/* Menú de Acciones Flotantes (Lápiz y Basura limpios sin interferencia) */}
          <div 
            className="absolute top-2.5 right-2.5 flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity z-10"
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

          {/* Información del Mazo (Ajustada para h-32) */}
          <div className="p-3 w-full z-0 min-w-0">
            <p 
              className={`font-bold drop-shadow-xs truncate text-sm ${
                dark 
                  ? 'text-white' 
                  : 'text-slate-900 bg-white/60 backdrop-blur-md px-2 py-0.5 rounded-lg inline-block max-w-full shadow-3xs'
              }`}
              title={deck.title}
            >
              {deck.title}
            </p>
            <p className={`text-[10px] sm:text-[11px] mt-0.5 font-semibold ${dark ? 'text-white/85' : 'text-slate-500'}`}>
              {deck.cardCount ?? 0} {deck.cardCount === 1 ? 'tarjeta' : 'tarjetas'}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
