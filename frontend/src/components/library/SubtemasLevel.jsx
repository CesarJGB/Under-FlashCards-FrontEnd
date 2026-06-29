import React from 'react';
import { ChevronRight, Trash2 } from 'lucide-react';
import DeckCard from '../DeckCard';

export default function SubtemasLevel({
  subtemas, decks = [], processedDecks, userId, isAdmin, viewMode, currentPath, setCurrentPath,
  setAcademicModal, handleDeleteAcademicFolder, handleDeleteDeck, handleDeckMutation, setInitialMode, setCurrentDeck, setModal
}) {
  return (
    <div className="space-y-4 mt-4">
      {currentPath.subtemaId === null && (
        <>
          {subtemas.length > 0 && (
            <div>
              <h3 className="text-sm font-black text-slate-800 mb-4">Subtemas</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {subtemas.map((sub) => {
                  const deckCount = decks.filter(d => d.subtemaId === sub._id).length;

                  return (
                    <div
                      key={sub._id}
                      onClick={() => setCurrentPath({ ...currentPath, subtemaId: sub._id })}
                      className="bg-white border border-slate-200 p-5 rounded-2xl hover:border-indigo-200 hover:shadow-xs transition-all duration-200 cursor-pointer flex flex-col justify-between h-32 active:scale-[0.98] group"
                    >
                      <div className="flex items-start justify-between">
                        <h4 className="text-base font-bold text-slate-950 tracking-tight group-hover:text-indigo-600 transition-colors truncate pr-2">
                          {sub.name}
                        </h4>
                        <button
                          onClick={(e) => handleDeleteAcademicFolder('subtema', sub._id, e)}
                          className="p-1.5 text-slate-300 hover:text-red-600 rounded-lg opacity-0 group-hover:opacity-100 transition-all cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                        <span>{deckCount} mazo{deckCount !== 1 ? 's' : ''}</span>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all duration-200" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {processedDecks.length > 0 && (
            <div className={subtemas.length > 0 ? "pt-4 border-t border-slate-200 mt-6" : ""}>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Todos los mazos de este tema</h4>
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 pb-12">
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

          {subtemas.length === 0 && processedDecks.length === 0 && (
            <div className="text-center border border-dashed border-slate-200 rounded-2xl py-12 text-slate-400 text-xs">
              No hay subtemas ni mazos. Usa el botón (+) para crear.
            </div>
          )}
        </>
      )}

      {currentPath.subtemaId !== null && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Mazos del subtema</h3>
          {processedDecks.length === 0 ? (
            <div className="text-center border border-dashed border-slate-300 rounded-2xl py-12 text-slate-400 text-xs bg-white">
              No hay mazos aquí. Usa el botón (+) para crear uno.
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 pb-12">
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
          )}
        </div>
      )}
    </div>
  );
}
