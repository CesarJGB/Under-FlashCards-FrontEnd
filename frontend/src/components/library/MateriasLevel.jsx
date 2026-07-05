import React, { useState, useMemo, useEffect } from 'react';
import { Loader2, Folder, Bookmark, ChevronDown, ChevronUp } from 'lucide-react';
import DeckCard from '../DeckCard';

export default function MateriasLevel({
  materias, processedDecks, loading, userId, isAdmin, viewMode, currentPath, setCurrentPath,
  setAcademicModal, handleDeleteAcademicFolder, handleDeleteDeck, handleDeckMutation, 
  setInitialMode, setCurrentDeck, setModal
}) {
  const [showAll, setShowAll] = useState(false);

  // Umbral responsive: 5 en móvil/tablet, 7 en laptop+
  // Usamos matchMedia para sincronizar JS con breakpoints Tailwind
  const [maxVisible, setMaxVisible] = useState(
    typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches ? 7 : 5
  );

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    const handler = (e) => setMaxVisible(e.matches ? 7 : 5);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Separar materias visibles vs overflow usando el máximo dinámico
  const { visibleMaterias, overflowCount } = useMemo(() => {
    if (showAll || materias.length <= maxVisible) {
      return { visibleMaterias: materias, overflowCount: 0 };
    }
    return {
      visibleMaterias: materias.slice(0, maxVisible),
      overflowCount: materias.length - maxVisible
    };
  }, [materias, showAll, maxVisible]);

  const isList = viewMode === 'list';

  // Renderizado de card individual (comprimida)
  const renderMateriaCard = (m) => (
    <button
      key={m._id}
      type="button"
      onClick={() => setCurrentPath({ ...currentPath, materiaId: m._id })}
      className="group bg-white border border-zinc-200 p-3 rounded-xl shadow-xs 
                 hover:border-indigo-200 hover:shadow-sm active:bg-zinc-50 
                 transition-all duration-200 flex flex-col items-start justify-center 
                 gap-2 min-h-[72px] cursor-pointer text-left w-full"
    >
      <div className="flex items-center gap-2.5 w-full min-w-0">
        <div className="w-9 h-9 bg-zinc-50 border border-zinc-100 rounded-lg 
                        flex items-center justify-center shrink-0 text-zinc-500 
                        group-hover:bg-indigo-50 group-hover:text-indigo-600 
                        group-hover:border-indigo-100/50 transition-colors duration-200">
          <Folder className="w-4 h-4 stroke-[2]" />
        </div>
        <span className="text-sm font-bold text-zinc-800 truncate tracking-tight leading-tight">
          {m.name}
        </span>
      </div>
    </button>
  );

  // Celda overflow "+N"
  const renderOverflowCell = () => (
    <button
      type="button"
      onClick={() => setShowAll(true)}
      className="bg-zinc-50 border border-dashed border-zinc-300 rounded-xl 
                 min-h-[72px] flex flex-col items-center justify-center gap-1 
                 cursor-pointer hover:bg-zinc-100 hover:border-zinc-400 
                 active:scale-[0.98] transition-all duration-200 w-full"
    >
      <span className="text-lg font-black text-zinc-700">+{overflowCount}</span>
      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
        Más
      </span>
    </button>
  );

  // Botón colapsar (solo cuando está expandido)
  const CollapseButton = () => (
    <button
      type="button"
      onClick={() => setShowAll(false)}
      className="mt-3 mx-auto flex items-center gap-1.5 px-4 py-2 rounded-full 
                 bg-zinc-100 text-zinc-600 text-xs font-bold hover:bg-zinc-200 
                 active:scale-95 transition-all duration-200"
    >
      <ChevronUp className="w-3.5 h-3.5" />
      Ver menos
    </button>
  );

  return (
    <div className="space-y-6 mt-6">
      {/* HEADER MATERIAS */}
      <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          Tus Materias ({materias.length})
        </h3>
        {!loading && materias.length > maxVisible && !showAll && (
          <span className="text-[10px] font-medium text-zinc-400">
            Mostrando {maxVisible}
          </span>
        )}
      </div>

      {/* GRID DE MATERIAS */}
      {loading && materias.length === 0 ? (
        <div className="flex items-center justify-center py-12 gap-2 text-zinc-400 text-xs font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
          Cargando asignaturas…
        </div>
      ) : materias.length === 0 ? (
        <div className="text-center border border-dashed border-zinc-200 rounded-2xl py-12 bg-white text-zinc-400 text-xs font-medium shadow-xs">
          No tienes materias configuradas.<br/>Usa el botón inferior para añadir una.
        </div>
      ) : isList ? (
        /* MODO LISTA */
        <div className="space-y-1.5">
          {materias.map(renderMateriaCard)}
        </div>
      ) : (
        /* MODO GRID RESPONSIVE + OVERFLOW */
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {visibleMaterias.map(renderMateriaCard)}
            
            {/* Celda overflow solo si no estamos mostrando todo */}
            {!showAll && overflowCount > 0 && renderOverflowCell()}
          </div>

          {/* Botón colapsar cuando está expandido */}
          {showAll && materias.length > maxVisible && <CollapseButton />}
        </>
      )}

      {/* SECCIÓN MAZOS SUELTOS */}
      <div className="pt-6 border-t border-zinc-200/60">
        <div className="flex items-center gap-1.5 mb-4">
          <Bookmark className="w-3.5 h-3.5 text-zinc-400" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Mazos sin clasificar
          </h4>
        </div>

        {processedDecks.length === 0 ? (
          <div className="text-xs text-zinc-400 font-medium italic bg-zinc-50/40 border border-zinc-100 rounded-xl p-4 text-center">
            Todos tus mazos están organizados ✓
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {processedDecks.map((d) => (
              <DeckCard
                key={d.id}
                deck={d}
                currentUserId={userId}
                isAdmin={isAdmin}
                isList={isList}
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
