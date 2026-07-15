// ARCHIVO: frontend/src/components/DeckCard.jsx
import { useState } from 'react';
import { Pencil, Trash2, Star, MoreHorizontal, Globe, Eye, Check } from 'lucide-react';

export default function DeckCard({ 
  deck, 
  currentUserId, 
  isAdmin, 
  onOpen, 
  onEdit, 
  onDelete, 
  onToggleStar, 
  onToggleDefault, 
  onTogglePublicReadOnly, 
  isList = false,
  readOnly = false,
  countLabel = 'tarjetas',
  selectionMode = false,
  isSelected = false
}) {
  const [showMenu, setShowMenu] = useState(false);
  
  // REGLA DE MODIFICACIÓN: Editable si eres dueño o si es una plantilla editable global
  const canModify = deck.userId === currentUserId || deck.isDefault === true;

  const bgStyle = deck.coverImage
    ? { backgroundImage: `url(${deck.coverImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { backgroundColor: deck.coverColor || '#ffffff' };

  const containerClasses = isList
    ? `group relative w-full text-left flex items-center justify-between p-4 min-h-[72px] rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 shadow-3xs transition-all cursor-pointer ${selectionMode && isSelected ? 'border-indigo-500 ring-2 ring-indigo-500' : ''} ${showMenu ? 'z-40' : 'overflow-hidden'}`
    : `group relative w-full text-left h-32 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-end ${selectionMode && isSelected ? 'border-indigo-500 ring-2 ring-indigo-500' : ''} ${showMenu ? 'z-40' : 'overflow-hidden'}`;

  const handleAction = (e, callback) => {
    e.stopPropagation();
    setShowMenu(false);
    callback();
  };

  const handleKeyDown = (e) => {
    if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    onOpen(deck);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selectionMode ? Boolean(isSelected) : undefined}
      aria-label={selectionMode ? `${isSelected ? 'Deseleccionar' : 'Seleccionar'} ${deck.title}` : undefined}
      onClick={() => onOpen(deck)}
      onKeyDown={handleKeyDown}
      style={isList ? {} : bgStyle}
      className={containerClasses}
    >
      {!isList && <span className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/65 via-black/25 to-transparent pointer-events-none rounded-b-2xl z-0" />}

      {!readOnly && showMenu && <div className="fixed inset-0 z-20 bg-transparent" onClick={(e) => handleAction(e, () => {})} />}

      {/* ======================================================================= */}
      {/* 🎴 MODO CUADRÍCULA (GRID VIEW) */}
      {/* ======================================================================= */}
       {!isList && (
         <>
           {selectionMode && (
             <span
               aria-hidden="true"
               className={`absolute top-2.5 left-2.5 z-20 flex h-6 w-6 items-center justify-center rounded-lg border shadow-3xs transition-colors ${
                 isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 bg-white/90 text-transparent'
               }`}
             >
               <Check className={`h-3.5 w-3.5 stroke-[3] transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
             </span>
           )}

           {!readOnly && deck.isStarred && (
            <button type="button" onClick={(e) => handleAction(e, () => onToggleStar(deck))} className={`absolute top-2.5 ${selectionMode ? 'left-10' : 'left-2.5'} p-1.5 rounded-lg bg-white/90 text-amber-500 shadow-3xs z-10 flex items-center justify-center cursor-pointer`}>
              <Star className="w-3.5 h-3.5 fill-amber-500" />
            </button>
          )}

          {!readOnly && (
            <div className="absolute top-2.5 right-2.5 z-30 flex flex-col items-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            
            {/* Contenedor del Botón de Opciones */}
            <div className="relative">
              <button 
                type="button" 
                onClick={() => setShowMenu(!showMenu)} 
                className={`p-1.5 rounded-lg shadow-3xs flex items-center justify-center transition-all cursor-pointer ${
                  showMenu ? 'bg-white text-slate-900' : 'bg-white/90 text-slate-700 hover:bg-white'
                }`}
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>

              {showMenu && (
                <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-xl p-1 flex flex-col gap-0.5 z-50 animate-[slideUp_0.1s_ease-out]">
                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => handleAction(e, () => onToggleDefault(deck))}
                        className="w-full text-left px-2 py-1.5 hover:bg-emerald-50 text-emerald-600 text-[11px] font-bold rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Globe className="w-3.5 h-3.5 text-emerald-500" />
                        {deck.isDefault ? 'Quitar editable global' : 'Compartir Editable'}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleAction(e, () => onTogglePublicReadOnly(deck))}
                        className="w-full text-left px-2 py-1.5 hover:bg-blue-50 text-blue-600 text-[11px] font-bold rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-500" />
                        {deck.isPublicReadOnly ? 'Quitar lectura global' : 'Compartir Lectura'}
                      </button>
                      <div className="my-0.5 border-t border-slate-100" />
                    </>
                  )}

                  <button type="button" onClick={(e) => handleAction(e, () => onToggleStar(deck))} className="w-full text-left px-2 py-1.5 hover:bg-slate-50 text-slate-700 text-[11px] font-bold rounded-lg flex items-center gap-2 transition-colors cursor-pointer">
                    <Star className={`w-3.5 h-3.5 ${deck.isStarred ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`} />
                    {deck.isStarred ? 'Quitar estrella' : 'Destacar mazo'}
                  </button>

                  {canModify && (
                    <>
                      <button type="button" onClick={(e) => handleAction(e, () => onEdit(deck))} className="w-full text-left px-2 py-1.5 hover:bg-slate-50 text-slate-700 text-[11px] font-bold rounded-lg flex items-center gap-2 transition-colors cursor-pointer">
                        <Pencil className="w-3.5 h-3.5 text-slate-400" /> Editar
                      </button>
                      <button type="button" onClick={(e) => handleAction(e, () => onDelete(deck))} className="w-full text-left px-2 py-1.5 hover:bg-red-50 text-red-600 text-[11px] font-bold rounded-lg flex items-center gap-2 transition-colors cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5" /> Eliminar
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* 🌐 Indicadores Oficiales recolocados limpiamente debajo del gatillo */}
            {deck.isDefault && (
              <div className="bg-emerald-600/90 text-white text-[9px] font-black px-2 py-0.5 rounded-md backdrop-blur-xs flex items-center gap-1 shadow-2xs animate-[fadeIn_0.1s_ease]">
                <Globe className="w-2.5 h-2.5 shrink-0 stroke-[2.5]" /> Oficial
              </div>
            )}
            {deck.isPublicReadOnly && (
              <div className="bg-blue-600/90 text-white text-[9px] font-black px-2 py-0.5 rounded-md backdrop-blur-xs flex items-center gap-1 shadow-2xs animate-[fadeIn_0.1s_ease]">
                <Eye className="w-2.5 h-2.5 shrink-0 stroke-[2.5]" /> Oficial
              </div>
            )}
            </div>
          )}

          {/* Texto inferior (pr-4 optimizado para evitar cualquier colisión) */}
          <div className="p-3.5 w-full z-10 min-w-0 relative pr-4">
            <p className="font-bold text-white text-sm truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">{deck.title}</p>
            <p className="text-[11px] mt-0.5 font-semibold text-white/85 drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]">{deck.cardCount ?? 0} {countLabel}</p>
          </div>
        </>
      )}

      {/* ======================================================================= */}
      {/* 📜 MODO LISTA (LIST VIEW) */}
      {/* ======================================================================= */}
      {isList && (
        <>
           <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-4">
             {selectionMode && (
               <span
                 aria-hidden="true"
                 className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                   isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white text-transparent'
                 }`}
               >
                 <Check className={`h-3 w-3 stroke-[3] transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
               </span>
             )}
             <div style={bgStyle} className="w-11 h-11 rounded-xl shrink-0 border border-slate-200/40 relative overflow-hidden shadow-3xs" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-bold text-slate-800 text-sm truncate">{deck.title}</p>
                {deck.isStarred && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                {deck.isDefault && <Globe className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                {deck.isPublicReadOnly && <Eye className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
              </div>
              <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                {deck.cardCount ?? 0} {countLabel} {deck.isDefault && '• Editable'} {deck.isPublicReadOnly && '• Lectura'}
              </p>
            </div>
          </div>

          {!readOnly && (
            <div className="flex items-center gap-1 shrink-0 z-30" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setShowMenu(!showMenu)} className={`p-2 rounded-xl transition-colors ${showMenu ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}>
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg p-1 z-50 flex flex-col gap-0.5">
                {isAdmin && (
                  <>
                    <button onClick={(e) => handleAction(e, () => onToggleDefault(deck))} className="w-full text-left px-2.5 py-1.5 hover:bg-emerald-50 text-emerald-600 text-xs font-semibold rounded-lg flex items-center gap-2 cursor-pointer">
                      <Globe className="w-3.5 h-3.5 text-emerald-500" /> {deck.isDefault ? 'Quitar editable' : 'Compartir Editable'}
                    </button>
                    <button onClick={(e) => handleAction(e, () => onTogglePublicReadOnly(deck))} className="w-full text-left px-2.5 py-1.5 hover:bg-blue-50 text-blue-600 text-xs font-semibold rounded-lg flex items-center gap-2 cursor-pointer">
                      <Eye className="w-3.5 h-3.5 text-blue-500" /> {deck.isPublicReadOnly ? 'Quitar lectura' : 'Compartir Lectura'}
                    </button>
                    <div className="my-0.5 border-t border-slate-100" />
                  </>
                )}
                <button onClick={(e) => handleAction(e, () => onToggleStar(deck))} className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-2 cursor-pointer">
                  <Star className={`w-3.5 h-3.5 ${deck.isStarred ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`} /> Favorito
                </button>
                {canModify && (
                  <>
                    <button onClick={(e) => handleAction(e, () => onEdit(deck))} className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-2 cursor-pointer"><Pencil className="w-3.5 h-3.5 text-slate-400" /> Editar</button>
                    <button onClick={(e) => handleAction(e, () => onDelete(deck))} className="w-full text-left px-2.5 py-1.5 hover:bg-red-50 text-red-600 text-xs font-semibold rounded-lg flex items-center gap-2 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /> Eliminar</button>
                  </>
                )}
              </div>
            )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
