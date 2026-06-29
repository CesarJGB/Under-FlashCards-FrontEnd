import React from 'react';
import { ChevronRight, Loader2, Trash2 } from 'lucide-react';
import DeckCard from '../DeckCard';

export default function TemasLevel({
  temas, decks = [], processedDecks, academicLoading, userId, isAdmin, viewMode, currentPath, setCurrentPath,
  setAcademicModal, handleDeleteAcademicFolder, handleDeleteDeck, handleDeckMutation, setInitialMode, setCurrentDeck, setModal
}) {
  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center">
        <h3 className="text-sm font-black text-slate-800">Temas del Parcial {currentPath.parcialNumber}</h3>
      </div>

      {academicLoading ? (
        <div className="text-slate-400 text-xs">
          <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> Descargando temario…
        </div>
      ) : temas.length === 0 ? (
        <div className="text-center border border-dashed border-slate-200 rounded-2xl py-12 text-slate-400 text-xs">
          No hay temas registrados.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {temas.map((t) => {
            const deckCount = decks.filter(d => d.temaId === t._id).length;
            const subtemaCount = t.subtemaCount || 0;

            return (
              <div
                key={t._id}
                onClick={() => setCurrentPath({ ...currentPath, temaId: t._id })}
                className="bg-white border border-slate-200 p-5 rounded-2xl hover:border-indigo-200 hover:shadow-xs transition-all duration-200 cursor-pointer flex flex-col justify-between h-32 active:scale-[0.98] group"
              >
                <div className="flex items-start justify-between">
                  <h4 className="text-base font-bold text-slate-950 tracking-tight group-hover:text-indigo-600 transition-colors truncate pr-2">
                    {t.name}
                  </h4>
                  <button
                    onClick={(e) => handleDeleteAcademicFolder('tema', t._id, e)}
                    className="p-1.5 text-slate-300 hover:text-red-600 rounded-lg opacity-0 group-hover:opacity-100 transition-all cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                  <div className="flex items-center gap-3">
                    <span>{deckCount} mazo{deckCount !== 1 ? 's' : ''}</span>
                    {subtemaCount > 0 && (
                      <span>{subtemaCount} subtema{subtemaCount !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all duration-200" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {processedDecks.length > 0 && (
        <div className="pt-4 border-t border-slate-200 mt-6">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Mazos generales del parcial</h4>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {processedDecks.map((d) => (
              <DeckCard
                key={d.id}
                deck={d}
                currentUserId={userId}
                isAdmin={isAdmin}
                isList={viewMode === 'list'}
                onOpen={(dk) => { setInitialMode('edit'); setCurrentDeck(dk); }}
                onEdit={(dk) => setModal({ editing: dk })}
                onDelete={handleDeleteDeck}
                onToggleStar={(dk) => handleDeckMutation(dk.id, 'star', { isStarred: !dk.isStarred }, { isStarred: !dk.isStarred })}
                onToggleDefault={(dk) => handleDeckMutation(dk.id, 'default', { isDefault: !dk.isDefault }, { isDefault: !dk.isDefault, isPublicReadOnly: false })}
                onTogglePublicReadOnly={(dk) => handleDeckMutation(dk.id, 'public-readonly', { isPublicReadOnly: !dk.isPublicReadOnly }, { isPublicReadOnly: !dk.isPublicReadOnly, isDefault: false })}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
