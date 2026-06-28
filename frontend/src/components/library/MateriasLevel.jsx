import React from 'react';
import { Loader2, Plus, Folder, Trash2, Bookmark } from 'lucide-react';
import DeckCard from '../DeckCard';

export default function MateriasLevel({
  materias, processedDecks, loading, userId, isAdmin, viewMode, currentPath, setCurrentPath,
  setAcademicModal, handleDeleteAcademicFolder, handleDeleteDeck, handleDeckMutation, setInitialMode, setCurrentDeck
}) {
  return (
    <div className="space-y-6 mt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Tus Materias</h3>
        <button onClick={() => setAcademicModal({ type: 'materia' })} className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all cursor-pointer">
          <Plus className="w-3.5 h-3.5" /> Nueva Materia
        </button>
      </div>
      
      {loading && materias.length === 0 ? (
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando asignaturas…
        </div>
      ) : materias.length === 0 ? (
        <div className="text-center border border-dashed border-slate-200 rounded-2xl py-10 text-slate-400 text-xs font-medium">
          No tienes materias configuradas.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {materias.map((m) => (
            <div key={m._id} onClick={() => setCurrentPath({ ...currentPath, materiaId: m._id })} className="group bg-white border border-slate-200 p-4 rounded-xl shadow-3xs hover:border-slate-400 transition-all flex items-center justify-between cursor-pointer active:scale-[0.99]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center shrink-0 text-slate-600 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                  <Folder className="w-4 h-4" />
                </div>
                <span className="text-sm font-bold text-slate-800 truncate">{m.name}</span>
              </div>
              <button onClick={(e) => handleDeleteAcademicFolder('materia', m._id, e)} className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      
      <div className="pt-4 border-t border-slate-200">
        <div className="flex items-center gap-1.5 mb-3">
          <Bookmark className="w-3.5 h-3.5 text-slate-400" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Mazos sueltos</h4>
        </div>
        {processedDecks.length === 0 ? (
          <div className="text-xs text-slate-400 italic">No hay mazos huérfanos.</div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
