// ARCHIVO: frontend/src/components/DeckCard.jsx
import { useState } from 'react';
import { Pencil, Trash2, Star, MoreHorizontal } from 'lucide-react';

const isDark = (hex) => {
  if (!hex || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 140;
};

export default function DeckCard({ deck, onOpen, onEdit, onDelete, onToggleStar, isList = false }) {
  const [showMenu, setShowMenu] = useState(false);
  const dark = deck.coverImage ? true : isDark(deck.coverColor);
  
  const bgStyle = deck.coverImage
    ? { backgroundImage: `url(${deck.coverImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { backgroundColor: deck.coverColor || '#ffffff' };

  const containerClasses = isList
    ? `group relative w-full text-left flex items-center justify-between p-4 min-h-[72px] rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 shadow-3xs hover:shadow-2xs transition-all cursor-pointer ${showMenu ? 'z-40' : 'overflow-hidden'}`
    : `group relative w-full text-left h-32 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-end ${showMenu ? 'z-40' : 'overflow-hidden'}`;

  const currentBgStyle = isList ? {} : bgStyle;

  const handleAction = (e, callback) => {
    e.stopPropagation();
    setShowMenu(false);
    callback();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(deck)}
      style={currentBgStyle}
      className={containerClasses}
    >
      {/* Capa de gradiente sutil con redondeado inferior (Solo Modo Grid) */}
      {!isList && (
        <span className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/60 via-black/20 to-transparent pointer-events-none rounded-b-2xl" />
      )}

      {/* INTERCEPTOR GLOBAL PARA CERRAR EL MENU DROPDOWN */}
      {showMenu && (
        <div 
          className="fixed inset-0 z-20 bg-transparent" 
          onClick={(e) => handleAction(e, () => {})} 
        />
      )}

      {/* --- MODO LISTA --- */}
      {isList ? (
        <>
          <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-4">
            <div style={bgStyle} className="w-11 h-11 rounded-xl shrink-0 border border-slate-200/40 relative overflow-hidden shadow-3xs" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-bold text-slate-800 text-sm truncate" title={deck.title}>{deck.title}</p>
                {deck.isStarred && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />}
              </div>
              <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                {deck.cardCount ?? 0} {deck.cardCount === 1 ? 'tarjeta' : 'tarjetas'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 z-30" onClick={(e) => e.stopPropagation()}>
            {/* ✨ CORREGIDO: Cambiado de statement "if" a expresión lógica de JSX con operador "&&" */}
            {deck.isStarred && (
              <button
                type="button"
                onClick={(e) => handleAction(e, () => onToggleStar(deck))}
                className="p-2 rounded-xl text-amber-500 bg-amber-50 hover:bg-amber-100/70 transition-colors cursor-pointer"
                title="Quitar de favoritos"
              >
                <Star className="w-4 h-4 fill-amber-500" />
              </button>
            )}
            
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMenu(!showMenu)}
                className={`p-2 rounded-xl transition-colors ${showMenu ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              {showMenu && (
                <div className="absolute right-0 mt-1 w-40 bg-white border border-slate-200 rounded-xl shadow-lg p-1 z-50 flex flex-col gap-0.5 animate-[fadeIn_0.08s_ease]">
                  <button
                    onClick={(e) => handleAction(e, () => onToggleStar(deck))}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Star className={`w-3.5 h-3.5 ${deck.isStarred ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`} />
                    {deck.isStarred ? 'Quitar favorito' : 'Favorito'}
                  </button>
                  <button
                    onClick={(e) => handleAction(e, () => onEdit(deck))}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5 text-slate-400" /> Editar
                  </button>
                  <button
                    onClick={(e) => handleAction(e, () => onDelete(deck))}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-red-50 text-red-600 text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Eliminar
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* --- MODO CUADRÍCULA --- */
        <>
          {/* ⭐ Botón de Estrella Indicador */}
          {deck.isStarred && (
            <button
              type="button"
              onClick={(e) => handleAction(e, () => onToggleStar(deck))}
              className="absolute top-2.5 left-2.5 p-1.5 rounded-lg bg-white/90 text-amber-500 shadow-3xs scale-100 cursor-pointer z-10 transition-transform active:scale-95"
              title="Quitar de favoritos"
            >
              <Star className="w-3.5 h-3.5 fill-amber-500" />
            </button>
          )}

          {/* ⚙️ BOTÓN DE TRES PUNTOS HORIZONTALES */}
          <div className="absolute top-2.5 right-2.5 z-30" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 rounded-lg bg-white/90 text-slate-700 hover:bg-white cursor-pointer shadow-3xs flex items-center justify-center"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>

            {/* Menú Desplegable */}
            {showMenu && (
              <div className="absolute right-0 mt-1 w-36 bg-white border border-slate-200 rounded-xl shadow-xl p-1 flex flex-col gap-0.5 animate-[fadeIn_0.08s_ease] z-50">
                <button
                  type="button"
                  onClick={(e) => handleAction(e, () => onToggleStar(deck))}
                  className="w-full text-left px-2 py-1.5 hover:bg-slate-50 text-slate-700 text-[11px] font-bold rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Star className={`w-3.5 h-3.5 ${deck.isStarred ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`} />
                  {deck.isStarred ? 'Quitar estrella' : 'Destacar mazo'}
                </button>
                <button
                  type="button"
                  onClick={(e) => handleAction(e, () => onEdit(deck))}
                  className="w-full text-left px-2 py-1.5 hover:bg-slate-50 text-slate-700 text-[11px] font-bold rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5 text-slate-400" /> Editar
                </button>
                <button
                  type="button"
                  onClick={(e) => handleAction(e, () => onDelete(deck))}
                  className="w-full text-left px-2 py-1.5 hover:bg-red-50 text-red-600 text-[11px] font-bold rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Eliminar
                </button>
              </div>
            )}
          </div>

          {/* Información del Mazo */}
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
