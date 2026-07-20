import React, { useState, useMemo, useEffect } from 'react';
import { Loader2, Bookmark, ChevronUp, MoreHorizontal, Pencil, ArrowRight } from 'lucide-react';
import DeckCard from '../DeckCard';
import ActionSheet from '../common/ActionSheet';
import { getMateriaColor, getMateriaInitial, lightenColor, darkenColor, hexToRgba } from '../../lib/materiaColors';

// Tono neutro para la celda "+N Ver todas"
const OVERFLOW_ACCENT = '#64748B';

// =========================================================================
// 🗂️ CARCASA DE "CARPETA" PREMIUM (Unificada y Brillo Blanco Mejorado)
// =========================================================================
function FolderCardShell({ accent, onClick, cornerBadge, children }) {
  // Colores calculados para una transición matemáticamente perfecta
  const topGloss = lightenColor(accent, 0.35); // Color más blanco para la cima
  const seamColor = lightenColor(accent, 0.15); // Color exacto de la junta (empareja pestaña con frente)
  const bottomColor = darkenColor(accent, 0.1); // Sombra suave inferior
  
  // Brillo blanco superpuesto para efecto gel/cristal (como tu referencia)
  const glossOverlay = 'linear-gradient(to bottom, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 50%)';
  
  const tabGradient = `${glossOverlay}, linear-gradient(to bottom, ${topGloss} 0%, ${seamColor} 100%)`;
  const folderGradient = `${glossOverlay}, linear-gradient(to bottom, ${seamColor} 0%, ${accent} 55%, ${bottomColor} 100%)`;
  
  const glow = `0 16px 28px -8px ${hexToRgba(accent, 0.45)}, 0 4px 10px -4px ${hexToRgba(accent, 0.2)}`;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{ boxShadow: glow }}
      className="relative w-full h-36 rounded-2xl text-left transition-all duration-200 active:scale-[0.97] hover:scale-[1.02] group cursor-pointer select-none border border-transparent bg-transparent overflow-visible"
    >
      {/* CAPA 1: TRASERA */}
      <div
        className="absolute inset-0 rounded-2xl"
        style={{ backgroundColor: darkenColor(accent, 0.25) }}
      />

      {/* CAPA 2: HOJA INTERIOR */}
      <div
        className="absolute top-[16px] left-2.5 right-2.5 bottom-2.5 rounded-xl bg-white dark:bg-zinc-800 shadow-xs transform translate-y-0 transition-transform duration-300 group-hover:-translate-y-1.5"
      />

      {/* CAPA 3: SOLAPA DELANTERA */}
      <div
        className="absolute bottom-0 inset-x-0 top-[38px] rounded-b-2xl rounded-tr-xl z-10"
        // Brillo superior sutil, sin sombras oscuras que separen la pieza
        style={{ background: folderGradient, boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.3)' }}
      >
        {/* Pestaña Izquierda Superior */}
        <div
          className="absolute left-0 w-[55%] h-[22px] rounded-t-xl"
          style={{ 
            background: tabGradient, 
            top: '-21px',
            boxShadow: 'inset 0 1.5px 1px rgba(255, 255, 255, 0.4)' 
          }}
        />

        {/* Contenedor del Texto */}
        <div className="relative h-full w-full p-4 flex flex-col justify-end z-10">
          {children}
        </div>
      </div>

      {/* CAPA 4: ELEMENTOS INTERACTIVOS CONTROLES */}
      <div className="absolute inset-0 z-20 pointer-events-none">
        <div className="relative w-full h-full pointer-events-auto">
          {cornerBadge}
        </div>
      </div>
    </button>
  );
}

export default function MateriasLevel({
  materias, processedDecks, loading, userId, isAdmin, viewMode, currentPath, setCurrentPath,
  setAcademicModal, handleDeleteAcademicFolder, handleDeleteDeck, handleDeckMutation,
  setInitialMode, setCurrentDeck, setModal
}) {
  const [showAll, setShowAll] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState(null);

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

  const handleEditMateriaName = (materia) => {
    setActiveMenuId(null);
    setAcademicModal({ type: 'materia', editing: materia });
  };
  const activeMateria = materias.find((materia) => materia._id === activeMenuId);

  // =======================================================================
  // 🎴 RENDERIZADO DE TARJETA DE MATERIA
  // =======================================================================
  const renderMateriaCard = (m) => {
    const isMenuOpen = activeMenuId === m._id;
    const accent = getMateriaColor(m);
    const initial = getMateriaInitial(m);

    if (isList) {
      return (
        <div key={m._id} className="relative group">
          <button
            type="button"
            onClick={() => setCurrentPath({ ...currentPath, materiaId: m._id })}
            className="w-full text-left flex items-center justify-between p-4 min-h-[64px] rounded-2xl border border-zinc-200 bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800 shadow-xs transition-all duration-150 active:scale-[0.985] cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-2">
              <div
                className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center shadow-xs"
                style={{ backgroundColor: accent }}
              >
                <span className="text-white font-black text-sm">{initial}</span>
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
        </div>
      );
    }

    // MODO GRID
    return (
      <div key={m._id} className="relative">
        <FolderCardShell
          accent={accent}
          onClick={() => setCurrentPath({ ...currentPath, materiaId: m._id })}
          cornerBadge={
            <>
              {/* Icono/Inicial */}
              <div className="absolute top-[20px] left-4">
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm border border-black/5">
                  <span className="font-black text-sm" style={{ color: accent }}>{initial}</span>
                </div>
              </div>

              {/* Botón de opciones */}
              <div className="absolute top-[48px] right-3.5" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setActiveMenuId(isMenuOpen ? null : m._id)}
                  className={`p-1.5 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                    isMenuOpen
                      ? 'bg-white text-zinc-950 shadow-md'
                      : 'bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm'
                  }`}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            </>
          }
        >
          {/* Contenido inferior */}
          <div className="min-w-0 text-left select-none pointer-events-none">
            <span className="text-[9px] font-bold tracking-widest text-white/70 uppercase block mb-1">
              Materia
            </span>
            <p className="font-black text-base leading-tight text-white line-clamp-2 drop-shadow-sm">
              {m.name}
            </p>
          </div>
        </FolderCardShell>
      </div>
    );
  };

  // Celda overflow "+N" balanceada al nuevo sistema
  const renderOverflowCell = () => (
    <div className="relative">
      <FolderCardShell
        accent={OVERFLOW_ACCENT}
        onClick={() => setShowAll(true)}
        cornerBadge={
          <div className="absolute top-[20px] left-4">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm border border-black/5">
              <ArrowRight className="w-4 h-4" style={{ color: OVERFLOW_ACCENT }} />
            </div>
          </div>
        }
      >
        <div className="min-w-0 text-left select-none pointer-events-none">
          <span className="text-[9px] font-bold tracking-widest text-white/70 uppercase block mb-1">
            Colección
          </span>
          <p className="font-black text-base leading-tight text-white uppercase tracking-wide drop-shadow-sm">
            +{overflowCount} Ver todas
          </p>
        </div>
      </FolderCardShell>
    </div>
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
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Tus Materias ({materias.length})
          </h3>
          {!loading && materias.length > maxVisible && !showAll && (
            <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
              Mostrando {maxVisible}
            </span>
          )}
        </div>
        <div className="h-px w-full bg-gradient-to-r from-zinc-200 via-zinc-100 to-transparent dark:from-zinc-700 dark:via-zinc-800/60 dark:to-transparent" />
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
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {visibleMaterias.map(renderMateriaCard)}
                {!showAll && overflowCount > 0 && renderOverflowCell()}
              </div>
              {showAll && materias.length > maxVisible && <CollapseButton />}
            </>
          )}
        </>
      )}

      <ActionSheet
        open={Boolean(activeMateria)}
        title={activeMateria ? `Acciones de ${activeMateria.name}` : 'Acciones de materia'}
        options={activeMateria ? [{
          id: 'edit',
          label: 'Editar materia',
          icon: Pencil,
          onSelect: () => handleEditMateriaName(activeMateria),
        }] : []}
        onClose={() => setActiveMenuId(null)}
      />

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
