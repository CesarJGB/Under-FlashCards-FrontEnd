import React from 'react';
import { Loader2, Folder, Trash2, Bookmark } from 'lucide-react';
import DeckCard from '../DeckCard';

export default function MateriasLevel({
  materias, processedDecks, loading, userId, isAdmin, viewMode, currentPath, setCurrentPath,
  setAcademicModal, handleDeleteAcademicFolder, handleDeleteDeck, handleDeckMutation, setInitialMode, setCurrentDeck,
  setModal
}) {
  const isList = viewMode === 'list';

  return (
    <div className="space-y-6 mt-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Tus Materias</h3>
      </div>

      {loading && materias.length === 0 ? (
        <div className="flex items-center justify-center py-8 gap-2 text-slate-400 text-xs font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> Cargando asignaturas…
        </div>
      ) : materias.length === 0 ? (
        <div className="text-center border border-dashed border-slate-200 rounded-2xl py-12 bg-white text-slate-400 text-xs font-medium shadow-xs">
          No tienes materias configuradas. Usa el botón inferior para añadir una.
        </div>
      ) : isList ? (
        <div className="space-y-1.5">
          {materias.map((m) => (
            <div
              key={m._id}
              onClick={() => setCurrentPath({ ...currentPath, materiaId: m._id })}
              className="group bg-white border border-slate-200 px-4 py-3 rounded-xl shadow-xs hover:border-indigo-200 hover:shadow-sm transition-all duration-200 flex items-center justify-between cursor-pointer active:scale-[0.99]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center shrink-0 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:border-indigo-100/50 transition-all duration-200">
                  <Folder className="w-4 h-4 stroke-[2]" />
                </div>
                <span className="text-sm font-bold text-slate-800 truncate tracking-tight">{m.name}</span>
              </div>
              <button
                type="button"
                onClick={(e) => handleDeleteAcademicFolder('materia', m._id, e)}
                className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all duration-200 cursor-pointer shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
          {materias.map((m) => (
            <div
              key={m._id}
              onClick={() => setCurrentPath({ ...currentPath, materiaId: m._id })}
              className="group bg-white border border-slate-200 p-4 rounded-2xl shadow-xs hover:border-indigo-200 hover:shadow-sm transition-all duration-200 flex items-center justify-between cursor-pointer active:scale-[0.98]"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center shrink-0 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:border-indigo-100/50 transition-all duration-200">
                  <Folder className="w-4 h-4 stroke-[2]" />
                </div>
                <span className="text-sm font-bold text-slate-800 truncate tracking-tight">{m.name}</span>
              </div>
              <button
                type="button"
                onClick={(e) => handleDeleteAcademicFolder('materia', m._id, e)}
                className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all duration-200 cursor-pointer shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      
      <div className="pt-6 border-t border-slate-200/60">
        <div className="flex items-center gap-1.5 mb-4">
          <Bookmark className="w-3.5 h-3.5 text-slate-400" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Mazos sueltos</h4>
        </div>

        {processedDecks.length === 0 ? (
          <div className="text-xs text-slate-400 font-medium italic bg-slate-50/40 border border-slate-100 rounded-xl p-4 text-center">
            No hay mazos huérfanos.
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
            {processedDecks.map((d) => (
              <DeckCard 
                key={d.id} 
                deck={d} 
                currentUserId={userId} 
                isAdmin={isAdmin} 
                isList={viewMode === 'list'} 
                onOpen={(dk) => { setInitialMode('edit'); setCurrentDeck(dk); }} 
                onEdit={(dk) => setModal && setModal({ editing: dk })} 
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
