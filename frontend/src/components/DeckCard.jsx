// ARCHIVO: frontend/src/components/DeckCard.jsx
import { useState } from 'react';
import { Pencil, Trash2, Star, MoreHorizontal, Globe, Eye, Check } from 'lucide-react';
import ActionSheet from './common/ActionSheet';

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
    ? `group relative w-full text-left flex items-center justify-between p-4 min-h-[72px] rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 shadow-3xs transition-all cursor-pointer overflow-hidden ${selectionMode && isSelected ? 'border-indigo-500 ring-2 ring-indigo-500' : ''}`
    : `group relative w-full text-left h-32 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-end overflow-hidden ${selectionMode && isSelected ? 'border-indigo-500 ring-2 ring-indigo-500' : ''}`;

  const handleAction = (e, callback) => {
    e.stopPropagation();
    callback();
  };

  const handleKeyDown = (e) => {
    if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    onOpen(deck);
  };

  const actionOptions = [
    isAdmin && onToggleDefault && {
      id: 'default',
      label: deck.isDefault ? 'Quitar editable global' : 'Compartir editable',
      icon: Globe,
      onSelect: () => onToggleDefault(deck),
    },
    isAdmin && onTogglePublicReadOnly && {
      id: 'public-readonly',
      label: deck.isPublicReadOnly ? 'Quitar lectura global' : 'Compartir lectura',
      icon: Eye,
      onSelect: () => onTogglePublicReadOnly(deck),
    },
    onToggleStar && {
      id: 'star',
      label: deck.isStarred ? 'Quitar estrella' : 'Destacar mazo',
      icon: Star,
      onSelect: () => onToggleStar(deck),
    },
    canModify && onEdit && {
      id: 'edit',
      label: 'Editar',
      icon: Pencil,
      onSelect: () => onEdit(deck),
    },
    canModify && onDelete && {
      id: 'delete',
      label: 'Eliminar',
      icon: Trash2,
      onSelect: () => onDelete(deck),
    },
  ].filter(Boolean);

  return (
    <>
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
            
            <button
              type="button"
              onClick={() => setShowMenu(true)}
              className="p-1.5 rounded-lg shadow-3xs flex items-center justify-center transition-all cursor-pointer bg-white/90 text-slate-700 hover:bg-white"
              aria-label={`Abrir acciones de ${deck.title}`}
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>

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
            <button type="button" onClick={() => setShowMenu(true)} className="p-2 rounded-xl transition-colors text-slate-400 hover:text-slate-600" aria-label={`Abrir acciones de ${deck.title}`}>
              <MoreHorizontal className="w-4 h-4" />
            </button>
            </div>
          )}
        </>
      )}
      </div>
      <ActionSheet
        open={!readOnly && showMenu}
        title={`Acciones de ${deck.title}`}
        options={actionOptions}
        onClose={() => setShowMenu(false)}
      />
    </>
  );
}
