import React, { useState, useMemo, useEffect } from 'react';
import { Loader2, Folder, Bookmark, ChevronUp, MoreHorizontal, Pencil } from 'lucide-react';
import DeckCard from '../DeckCard';

export default function MateriasLevel({
  materias, processedDecks, loading, userId, isAdmin, viewMode, currentPath, setCurrentPath,
  setAcademicModal, handleDeleteAcademicFolder, handleDeleteDeck, handleDeckMutation,
  setInitialMode, setCurrentDeck, setModal
}) {
  const [showAll, setShowAll] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState(null);

  // Umbral responsive: 5 en móvil/tablet, 7 en laptop+
  const [maxVisible, setMaxVisible] = useState(
    typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches ? 7 : 5
  );

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    const handler = (e) => setMaxVisible(e.matches ? 7 : 5);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

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

  // Handler para editar nombre (abre modal de carpeta académica en modo edición)
  const handleEditMateriaName = (materia, e) => {
    e.stopPropagation();
    setActiveMenuId(null);
    setAcademicModal({ type: 'materia', editing: materia });
  };

  // =======================================================================
  // 🎴 RENDERIZADO TIPO DECKCARD CON SOPORTE DARK/LIGHT + MENÚ
  // =======================================================================
  const renderMateriaCard = (m) => {
    const isMenuOpen = activeMenuId === m._id;

    if (isList) {
      return (
        <div key={m._id} className="relative group">
          <button
            type="button"
            onClick={() => setCurrentPath({ ...currentPath, materiaId: m._id })}
            className="w-full text-left flex items-center justify-between p-4 min-h-[64px] rounded-2xl border border-zinc-200 bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800 shadow-xs transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-2">
              <div className="w-10 h-10 rounded-xl shrink-0 bg-zinc-800 dark:bg-zinc-700 flex items-center justify-center shadow-xs">
                <Folder className="w-4.5 h-4.5 text-white/90 stroke-[2]" />
              </div>
              <p className="font-bold text-zinc-800 dark:text-zinc-100 text-sm truncate leading-snug">
                {m.name}
              </p>
            </div>

            <div className="shrink-0 z-30" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setActiveMenuId(isMenuOpen ? null : m._id)}
                className={`p-2 rounded-xl transition-colors cursor-pointer ${
                  isMenuOpen 
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100' 
                    : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                }`}
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          </button>

          {isMenuOpen && (
            <>
              <div className="fixed inset-0 z-20 bg-transparent" onClick={() => setActiveMenuId(null)} />
              <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl p-1 z-50 animate-[slideUp_0.1s_ease-out]">
                <button
                  type="button"
                  onClick={(e) => handleEditMateriaName(m, e)}
                  className="w-full text-left px-2.5 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold rounded-lg flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5 text-zinc-400" />
                  Editar nombre
                </button>
              </div>
            </>
          )}
        </div>
      );
    }

    // MODO GRID
    return (
      <div key={m._id} className="relative group">
        <button
          type="button"
          onClick={() => setCurrentPath({ ...currentPath, materiaId: m._id })}
          className="w-full text-left h-28 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-end overflow-hidden bg-white dark:bg-zinc-800 relative"
        >
          {/* Gradiente overlay SOLO modo oscuro */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent pointer-events-none z-0 dark:block hidden rounded-b-2xl" />

          {/* Icono decorativo superior izquierdo */}
          <div className="absolute top-3 left-3 z-10">
            <div className="w-8 h-8 rounded-lg bg-zinc-100/80 dark:bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <Folder className="w-4 h-4 text-zinc-600 dark:text-white/90 stroke-[2]" />
            </div>
          </div>

          {/* Botón menú grid */}
          <div className="absolute top-2.5 right-2.5 z-30" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setActiveMenuId(isMenuOpen ? null : m._id)}
              className={`p-1.5 rounded-lg shadow-xs flex items-center justify-center transition-all cursor-pointer ${
                isMenuOpen
                  ? 'bg-zinc-200 dark:bg-white text-zinc-900 dark:text-zinc-900'
                  : 'bg-zinc-100/80 dark:bg-white/90 text-zinc-600 dark:text-zinc-700 hover:bg-zinc-200 dark:hover:bg-white'
              }`}
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Nombre */}
          <div className="p-3.5 pt-10 w-full z-10 min-w-0 relative">
            <p className="font-bold text-sm leading-snug line-clamp-2 text-zinc-800 dark:text-white dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
              {m.name}
            </p>
          </div>
        </button>

        {/* Dropdown grid */}
        {isMenuOpen && (
          <>
            <div className="fixed inset-0 z-20 bg-transparent" onClick={() => setActiveMenuId(null)} />
            <div className="absolute right-2 top-10 w-44 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl p-1 z-50 animate-[slideUp_0.1s_ease-out]">
              <button
                type="button"
                onClick={(e) => handleEditMateriaName(m, e)}
                className="w-full text-left px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[11px] font-bold rounded-lg flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Pencil className="w-3.5 h-3.5 text-zinc-400" />
                Editar nombre
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  // Celda overflow "+N" - NUEVO DISEÑO INTEGRADO Y ADAPTATIVO
  const renderOverflowCell = () => (
    <button
      type="button"
      onClick={() => setShowAll(true)}
      className="h-28 rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 active:scale-[0.98] transition-all duration-200 w-full"
    >
      <span className="text-2xl font-black text-zinc-900 dark:text-white">+{overflowCount}</span>
      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-white/85">
        Ver todas
      </span>
    </button>
  );

  const CollapseButton = () => (
    <button
      type="button"
      onClick={() => setShowAll(false)}
      className="mt-4 mx-auto flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-95 transition-all duration-200"
    >
      <ChevronUp className="w-3.5 h-3.5" />
      Ver menos
    </button>
  );

  return (
    <div className="space-y-6 mt-6">
      {/* HEADER */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700/50 pb-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          Tus Materias ({materias.length})
        </h3>
        {!loading && materias.length > maxVisible && !showAll && (
          <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
            Mostrando {maxVisible}
          </span>
        )}
      </div>

      {/* GRID / LISTA */}
      {loading && materias.length === 0 ? (
        <div className="flex items-center justify-center py-12 gap-2 text-zinc-400 dark:text-zinc-500 text-xs font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
          Cargando asignaturas…
        </div>
      ) : materias.length === 0 ? (
        <div className="text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl py-12 bg-white dark:bg-zinc-900 text-zinc-400 dark:text-zinc-500 text-xs font-medium shadow-xs">
          No tienes materias configuradas.<br />Usa el botón inferior para añadir una.
        </div>
      ) : (
        <>
          {isList ? (
            <div className="space-y-1.5">{visibleMaterias.map(renderMateriaCard)}</div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {visibleMaterias.map(renderMateriaCard)}
                {!showAll && overflowCount > 0 && renderOverflowCell()}
              </div>
              {showAll && materias.length > maxVisible && <CollapseButton />}
            </>
          )}
        </>
      )}

      {/* MAZOS SIN CLASIFICAR */}
      <div className="pt-6 border-t border-zinc-200/60 dark:border-zinc-700/50">
        <div className="flex items-center gap-1.5 mb-4">
          <Bookmark className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Mazos sin clasificar
          </h4>
        </div>

        {processedDecks.filter(d => !d.materiaId).length === 0 ? (
          <div className="text-xs text-zinc-400 dark:text-zinc-500 font-medium italic bg-zinc-50/40 dark:bg-zinc-900/30 border border-zinc-100 dark:border-zinc-800 rounded-xl p-4 text-center">
            Todos tus mazos están organizados ✓
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {processedDecks.filter(d => !d.materiaId).map((d) => (
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
