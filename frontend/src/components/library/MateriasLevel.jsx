import React, { useState, useMemo, useEffect } from 'react';
import { Loader2, ChevronUp, MoreHorizontal, Pencil, ArrowRight } from 'lucide-react';
import DeckCard from '../DeckCard';
import ActionSheet from '../common/ActionSheet';
import {
  getMateriaColor,
  getMateriaPastelColor,
  lightenColor,
  darkenColor,
  hexToRgba,
} from '../../lib/materiaColors';
import { getMateriaIconComponent } from '../../lib/materiaIcons';
import { FOLDER_TITLE_LAYOUT, getFolderTitleSafeArea } from '../../lib/materiaTitleLayout';
import { useMateriaTitleLayout } from '../../hooks/useMateriaTitleLayout';

// Tono neutro para la celda "+N Ver todas"
const OVERFLOW_ACCENT = '#64748B';

function FolderIdentityBadge({ icon, accent }) {
  return (
    <div
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/5 bg-white shadow-md"
      style={{ color: accent }}
    >
      {icon}
    </div>
  );
}

// =========================================================================
// 🗂️ CARCASA DE "CARPETA" PREMIUM (Estilo Referencia - Hoja Expuesta)
// =========================================================================
function FolderCardShell({ accent, onClick, cornerBadge, children }) {
  const topGloss = lightenColor(accent, 0.25);
  const bottomColor = darkenColor(accent, 0.15);
  
  const tabGradient = `linear-gradient(to bottom, ${topGloss} 0%, ${accent} 75%, ${accent} 100%)`;
  const folderGradient = `linear-gradient(to bottom, ${accent} 0%, ${accent} 50%, ${bottomColor} 100%)`;
  
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
        className="absolute top-[14px] left-2.5 right-2.5 bottom-2.5 rounded-xl bg-white dark:bg-zinc-800 shadow-xs transform translate-y-0 transition-transform duration-300 group-hover:-translate-y-1.5"
      />

      {/* CAPA 3: SOLAPA DELANTERA */}
      <div
        className="absolute bottom-0 inset-x-0 top-[52px] rounded-b-2xl rounded-tr-xl z-10"
        style={{ background: folderGradient }}
      >
        {/* Pestaña Izquierda Superior */}
        <div
          className="absolute left-0 w-[55%] h-8 rounded-t-xl"
          style={{ 
            background: tabGradient, 
            top: '-24px',
            boxShadow: 'inset 0 1.5px 1px rgba(255, 255, 255, 0.4)' 
          }}
        />

        {/* Franja pastel integrada al borde inferior del mismo frontal. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-2 rounded-b-2xl opacity-90"
          style={{ backgroundColor: getMateriaPastelColor({ color: accent }) }}
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

function MateriaTitle({ name }) {
  const { regionRef, layout } = useMateriaTitleLayout(name);
  const safeArea = getFolderTitleSafeArea(0);

  return (
    <div
      ref={regionRef}
      data-title-state={layout.state}
      className="absolute min-w-0 flex flex-col justify-end text-left select-none pointer-events-none"
      style={{
        left: `${FOLDER_TITLE_LAYOUT.leftPaddingPx}px`,
        right: `${safeArea.rightReservedPx}px`,
        top: `${safeArea.topPx}px`,
        bottom: `${safeArea.bottomReservedPx}px`,
      }}
    >
      {layout.showLabel && (
        <span className="mb-1 block text-[9px] font-bold leading-none uppercase tracking-widest text-white/75">
          Materia
        </span>
      )}
      <p
        title={layout.truncated ? name : undefined}
        className="min-w-0 break-words font-black text-white drop-shadow-sm"
        style={{
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: layout.maxLines,
          overflow: 'hidden',
          fontSize: `${layout.fontSizePx}px`,
          lineHeight: layout.lineHeight,
        }}
      >
        {name}
      </p>
    </div>
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
  const unclassifiedDecks = useMemo(() => processedDecks.filter(d => !d.materiaId), [processedDecks]);

  const handleEditMateriaName = (materia) => {
    setAcademicModal({ type: 'materia', editing: materia });
  };
  const activeMateria = materias.find((materia) => materia._id === activeMenuId);

  // =======================================================================
  // 🎴 RENDERIZADO DE TARJETA DE MATERIA
  // =======================================================================
  const renderMateriaCard = (m) => {
    const isMenuOpen = activeMenuId === m._id;
    const accent = getMateriaColor(m);
    const MateriaIcon = getMateriaIconComponent(m);

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
                <MateriaIcon className="h-[18px] w-[18px] text-white/95" strokeWidth={2.2} aria-hidden="true" />
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
              <div className="absolute left-4 top-[46px]">
                <FolderIdentityBadge
                  accent={accent}
                  icon={<MateriaIcon className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />}
                />
              </div>

              {/* El botón conserva su posición fija en la carpeta. */}
              <div className="absolute top-[64px] right-2.5 z-30" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setActiveMenuId(isMenuOpen ? null : m._id)}
                  aria-label={`Opciones de ${m.name}`}
                  className={`p-1.5 rounded-lg flex items-center justify-center transition-all cursor-pointer backdrop-blur-sm border border-white/20 ${
                    isMenuOpen
                      ? 'bg-black/20 text-white shadow-inner dark:bg-black/40'
                      : 'bg-white/25 text-white hover:bg-white/35 shadow-sm dark:bg-white/10 dark:hover:bg-white/20'
                  }`}
                >
                  <MoreHorizontal className="w-4 h-4 drop-shadow-sm" />
                </button>
              </div>
            </>
          }
        >
          <MateriaTitle name={m.name} />
        </FolderCardShell>
      </div>
    );
  };

  // Celda overflow "+N" balanceada al sistema (usa el estilo de 1 línea)
  const renderOverflowCell = () => (
    <div className="relative">
      <FolderCardShell
        accent={OVERFLOW_ACCENT}
        onClick={() => setShowAll(true)}
        cornerBadge={
          <>
            {/* Icono estático bajo las reglas de 1 línea */}
            <div className="absolute top-[46px] left-4">
              <FolderIdentityBadge
                accent={OVERFLOW_ACCENT}
                icon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
              />
            </div>
          </>
        }
      >
        <div className="min-w-0 text-left select-none pointer-events-none mt-4">
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
      {/* HEADER NUEVO */}
      <div className="flex items-center gap-2.5">
        <h3 className="text-xl font-black uppercase tracking-tight text-zinc-800 dark:text-zinc-100">
          Tus Materias
        </h3>
        <span className="px-2.5 py-0.5 rounded-full bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-black">
          {materias.length}
        </span>
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
          onAfterClose: () => handleEditMateriaName(activeMateria),
        }] : []}
        onClose={() => setActiveMenuId(null)}
      />

      {/* MAZOS SIN CLASIFICAR */}
      <div className="pt-6 border-t border-zinc-200/60 dark:border-zinc-700/50">
        <div className="flex items-center gap-2.5 mb-4">
          <h3 className="text-xl font-black uppercase tracking-tight text-zinc-800 dark:text-zinc-100">
            Mazos sin clasificar
          </h3>
          <span className="px-2.5 py-0.5 rounded-full bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-black">
            {unclassifiedDecks.length}
          </span>
        </div>

        {unclassifiedDecks.length === 0 ? (
          <div className="text-xs text-zinc-400 dark:text-zinc-500 font-medium italic bg-zinc-50/40 dark:bg-zinc-900/30 border border-zinc-100 dark:border-zinc-800 rounded-xl p-4 text-center">
            Todos tus mazos están organizados ✓
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {unclassifiedDecks.map((d) => (
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
