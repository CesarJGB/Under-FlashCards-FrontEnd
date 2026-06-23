// ARCHIVO: frontend/src/components/DeckCard.jsx
import { useState } from 'react';
import { Pencil, Trash2, Star, MoreHorizontal, Globe, Eye } from 'lucide-react';

export default function DeckCard({ 
  deck, 
  currentUserId, 
  isAdmin, 
  onOpen, 
  onEdit, 
  onDelete, 
  onToggleStar, 
  onToggleDefault, 
  onTogglePublicReadOnly, // 👈 Nuevo prop recibido
  isList = false 
}) {
  const [showMenu, setShowMenu] = useState(false);
  
  // 🧠 REGLA DE MODIFICACIÓN: Se puede editar si eres el dueño O si el mazo es una plantilla editable global
  const canModify = deck.userId === currentUserId || deck.isDefault === true;

  const bgStyle = deck.coverImage
    ? { backgroundImage: `url(${deck.coverImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { backgroundColor: deck.coverColor || '#ffffff' };

  const containerClasses = isList
    ? `group relative w-full text-left flex items-center justify-between p-4 min-h-[72px] rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 shadow-3xs transition-all cursor-pointer ${showMenu ? 'z-40' : 'overflow-hidden'}`
    : `group relative w-full text-left h-32 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-end ${showMenu ? 'z-40' : 'overflow-hidden'}`;

  const handleAction = (e, callback) => {
    e.stopPropagation();
    setShowMenu(false);
    callback();
  };

  return (
    <div role="button" tabIndex={0} onClick={() => onOpen(deck)} style={isList ? {} : bgStyle} className={containerClasses}>
      {!isList && <span className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/65 via-black/25 to-transparent pointer-events-none rounded-b-2xl z-0" />}

      {showMenu && <div className="fixed inset-0 z-20 bg-transparent" onClick={(e) => handleAction(e, () => {})} />}

      {/* --- MODO CUADRÍCULA --- */}
      {!isList && (
        <>
          {deck.isStarred && (
            <button type="button" onClick={(e) => handleAction(e, () => onToggleStar(deck))} className="absolute top-2.5 left-2.5 p-1.5 rounded-lg bg-white/90 text-amber-500 shadow-3xs z-10">
              <Star className="w-3.5 h-3.5 fill-amber-500" />
            </button>
          )}

          {/* 🌐 INDICADORES VISUALES COMPACTOS */}
          {deck.isDefault && (
            <div className="absolute bottom-2.5 right-2.5 bg-emerald-600/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-xs flex items-center gap-1 z-10 shadow-3xs">
              <Globe className="w-2.5 h-2.5" /> Oficial (Editable)
            </div>
          )}
          {deck.isPublicReadOnly && (
            <div className="absolute bottom-2.5 right-2.5 bg-blue-600/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-xs flex items-center gap-1 z-10 shadow-3xs">
              <Eye className="w-2.5 h-2.5" /> Oficial (Lectura)
            </div>
          )}

          {/* MENÚ DE TRES PUNTOS */}
          <div className="absolute top-2.5 right-2.5 z-30" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setShowMenu(!showMenu)} className="p-1.5 rounded-lg bg-white/90 text-slate-700 hover:bg-white shadow-3xs flex items-center justify-center">
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-xl p-1 flex flex-col gap-0.5 z-50">
                {/* 👑 CONTROLES EXCLUSIVOS DE CÉSAR (ADMIN) */}
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

          <div className="p-3.5 w-full z-10 min-w-0 relative pr-16">
            <p className="font-bold text-white text-sm truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">{deck.title}</p>
            <p className="text-[11px] mt-0.5 font-semibold text-white/85 drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]">{deck.cardCount ?? 0} tarjetas</p>
          </div>
        </>
      )}

      {/* --- MODO LISTA --- */}
      {isList && (
        <>
          <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-4">
            <div style={bgStyle} className="w-11 h-11 rounded-xl shrink-0 border border-slate-200/40 relative overflow-hidden shadow-3xs" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-bold text-slate-800 text-sm truncate">{deck.title}</p>
                {deck.isStarred && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                {deck.isDefault && <Globe className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                {deck.isPublicReadOnly && <Eye className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
              </div>
              <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                {deck.cardCount ?? 0} tarjetas {deck.isDefault && '• Editable'} {deck.isPublicReadOnly && '• Lectura'}
              </p>
            </div>
          </div>

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
        </>
      )}
    </div>
  );
}
