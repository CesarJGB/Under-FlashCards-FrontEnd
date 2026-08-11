// ARCHIVO: frontend/src/components/DeckCard.jsx
import { useState } from 'react';
import { Pencil, Trash2, Star, MoreHorizontal, Globe, Eye, Check } from 'lucide-react';
import ActionSheet from './common/ActionSheet';
import { getReadableTextColor } from '../lib/materiaColors';

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
  const isOwner = deck.userId === currentUserId;
  const canModify = isOwner || deck.isDefault === true;

  const coverColor = deck.coverColor || '#ffffff';
  const hasCoverImage = Boolean(deck.coverImage);
  const cardTextColor = hasCoverImage ? '#ffffff' : getReadableTextColor(coverColor);
  const bgStyle = hasCoverImage
    ? {
        backgroundColor: coverColor,
        backgroundImage: `url(${deck.coverImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : { backgroundColor: coverColor };

  const gridSurfaceClasses = hasCoverImage
    ? 'border-white/20 shadow-[0_8px_22px_-12px_rgba(15,23,42,0.55)] hover:shadow-[0_12px_28px_-12px_rgba(15,23,42,0.65)]'
    : 'border-black/[0.07] shadow-none hover:border-black/[0.12]';

  const containerClasses = isList
    ? `group relative w-full text-left flex items-center justify-between p-4 min-h-[72px] rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 shadow-3xs transition-all cursor-pointer overflow-hidden ${selectionMode && isSelected ? 'border-indigo-500 ring-2 ring-indigo-500' : ''}`
    : `group relative aspect-[4/3] w-full text-left rounded-[22px] border ${gridSurfaceClasses} transition-all cursor-pointer flex flex-col justify-end overflow-hidden active:scale-[0.99] ${selectionMode && isSelected ? 'border-indigo-500 ring-2 ring-indigo-500' : ''}`;

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
      onAfterClose: () => onEdit(deck),
    },
    isOwner && onDelete && {
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
      {!isList && hasCoverImage && (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-2/3 rounded-b-[22px] bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
      )}

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
            <button type="button" onClick={(e) => handleAction(e, () => onToggleStar(deck))} className={`absolute top-2.5 ${selectionMode ? 'left-10' : 'left-2.5'} z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-amber-500 shadow-3xs transition-all hover:bg-white active:scale-95 cursor-pointer`}>
              <Star className="w-3.5 h-3.5 fill-amber-500" />
            </button>
          )}

          {!readOnly && (
            <div className="absolute top-2.5 right-2.5 z-30 flex flex-col items-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            
            <button
              type="button"
              onClick={() => setShowMenu(true)}
              className={`flex h-10 w-10 items-center justify-center rounded-full border shadow-3xs transition-all active:scale-95 cursor-pointer ${
                showMenu
                  ? 'border-slate-900 bg-slate-900 text-white ring-2 ring-white/70'
                  : 'border-white/70 bg-white/90 text-slate-700 hover:bg-white'
              }`}
              aria-label={`Abrir acciones de ${deck.title}`}
              aria-expanded={showMenu}
            >
              <MoreHorizontal className="h-4 w-4" />
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
          <div className="relative z-10 w-full min-w-0 p-3.5 pr-4" style={{ color: cardTextColor }}>
            <p className={`truncate text-[15px] font-extrabold leading-tight tracking-[-0.015em] ${hasCoverImage ? 'drop-shadow-[0_1px_2px_rgba(0,0,0,0.48)]' : ''}`}>
              {deck.title}
            </p>
            <p className={`mt-1 truncate text-[11px] font-semibold ${hasCoverImage ? 'text-white/85 drop-shadow-[0_1px_1px_rgba(0,0,0,0.38)]' : 'opacity-75'}`}>
              {deck.cardCount ?? 0} {countLabel}
            </p>
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
            <button
              type="button"
              onClick={() => setShowMenu(true)}
              className={`flex h-10 w-10 items-center justify-center rounded-full transition-all active:scale-95 ${
                showMenu
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100/80 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
              }`}
              aria-label={`Abrir acciones de ${deck.title}`}
              aria-expanded={showMenu}
            >
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
