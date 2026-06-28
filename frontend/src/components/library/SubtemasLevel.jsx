import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import DeckCard from '../DeckCard';

export default function SubtemasLevel({
  subtemas, processedDecks, userId, isAdmin, viewMode, currentPath, setCurrentPath,
  setAcademicModal, handleDeleteAcademicFolder, handleDeleteDeck, handleDeckMutation, setInitialMode, setCurrentDeck
}) {
  return (
    <div className="space-y-6 mt-4">
      <div className="bg-slate-100/60 border border-slate-200 p-4 rounded-2xl">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Subtemas Especializados</h4>
          <button onClick={() => setAcademicModal({ type: 'subtema' })} className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer">
            <Plus className="w-3 h-3" /> Añadir Subtema
          </button>
        </div>
        {subtemas.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => setCurrentPath({ ...currentPath, subtemaId: null })} 
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${currentPath.subtemaId === null ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-600'}`}
            >
              Ver Todo
            </button>
            {subtemas.map((sub) => (
              <div key={sub._id} className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${currentPath.subtemaId === sub._id ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-600'}`}>
                <span onClick={() => setCurrentPath({ ...currentPath, subtemaId: sub._id })} className="cursor-pointer truncate max-w-[150px]">
                  {sub.name}
                </span>
                <button onClick={(e) => handleDeleteAcademicFolder('subtema', sub._id, e)} className="p-0.5 ml-1 text-slate-300 hover:text-red-500 cursor-pointer">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-slate-400 italic">No hay subtemas de desglose.</p>
        )}
      </div>

      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Mazos Disponibles</h3>
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
    </div>
  );
}
