import React, { useState, useMemo, useEffect } from 'react';
import { Loader2, Bookmark, ChevronUp, MoreHorizontal, Pencil, ArrowRight } from 'lucide-react';
import DeckCard from '../DeckCard';
import ActionSheet from '../common/ActionSheet';
import { getMateriaColor, getMateriaInitial, lightenColor, darkenColor, hexToRgba } from '../../lib/materiaColors';

// Tono neutro para la celda "+N Ver todas" (no pertenece a ninguna materia)
const OVERFLOW_ACCENT = '#64748B';

// =========================================================================
// 🗂️ CARCASA DE "CARPETA" — silueta real (pestaña + cuerpo fusionados en una
// sola forma, mismo color), con una capa trasera más clara asomando detrás.
// Solo se usa en modo grid — el modo lista no lleva este tratamiento.
// =========================================================================
function FolderCardShell({ accent, onClick, cornerBadge, children }) {
  // Tres capas de color
  const backColor = lightenColor(accent, 0.25);      // Capa trasera (más clara)
  const middleColor = lightenColor(accent, 0.12);    // Capa del medio (ligeramente clara)
  const frontColor = accent;                          // Capa frontal (color base)
  
  const bodyGradient = `linear-gradient(155deg, ${middleColor} 0%, ${frontColor} 55%, ${darkenColor(accent, 0.08)} 100%)`;
  const glow = `0 12px 26px -8px ${hexToRgba(accent, 0.45)}, 0 2px 6px -2px rgba(0,0,0,0.12)`;

  return (
    <div className="relative h-36">
      {/* CAPA 1: Trasera - más clara, asoma por detrás */}
      <div
        className="absolute inset-0 rounded-2xl"
        style={{ 
          backgroundColor: backColor,
          transform: 'translateY(4px) translateX(4px)',
          boxShadow: glow
        }}
      />

      {/* CAPA 2: Intermedia - ligeramente más clara */}
      <div
        className="absolute left-1 right-3.5 top-3.5 bottom-1 rounded-2xl"
        style={{ 
          backgroundColor: middleColor,
        }}
      />

      {/* CAPA 3: Frontal - carpeta completa (pestaña + cuerpo) */}
      <button
        type="button"
        onClick={onClick}
        className="absolute left-2 right-4 top-4 bottom-2 cursor-pointer active:scale-[0.98] transition-all duration-150 rounded-2xl overflow-hidden"
        style={{ background: bodyGradient }}
      >
        {/* Pestaña de carpeta - forma mejorada */}
        <div
          className="absolute top-0 left-0 rounded-t-xl"
          style={{ 
            width: '52%', 
            height: 28,
            background: `linear-gradient(180deg, ${lightenColor(accent, 0.2)} 0%, ${accent} 100%)`,
            borderBottomRightRadius: 12
          }}
        />
        
        {/* Contenido de la carpeta */}
        <div className="absolute inset-0 pt-7 flex flex-col justify-end p-3.5">
          {cornerBadge}
          {children}
        </div>
      </button>
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

    // MODO GRID — carpeta apilada (tab + cuerpo con degradado + glow)
    return (
      <div key={m._id} className="relative group">
        <FolderCardShell
          accent={accent}
          onClick={() => setCurrentPath({ ...currentPath, materiaId: m._id })}
          cornerBadge={
            <>
              {/* Badge blanco con la inicial, coloreada con el acento */}
              <div className="absolute top-3 left-3 z-10">
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
                  <span className="font-black text-xs" style={{ color: accent }}>{initial}</span>
                </div>
              </div>

              {/* Botón menú */}
              <div className="absolute top-2.5 right-2.5 z-30" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setActiveMenuId(isMenuOpen ? null : m._id)}
                  className={`p-1.5 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                    isMenuOpen
                      ? 'bg-white text-zinc-900 shadow-sm'
                      : 'bg-white/25 backdrop-blur-sm text-white hover:bg-white/40'
                  }`}
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          }
        >
          <div className="p-3.5 pt-8 w-full z-10 min-w-0 relative">
            <p className="font-bold text-sm leading-snug line-clamp-2 text-white drop-shadow-sm">
              {m.name}
            </p>
          </div>
        </FolderCardShell>
      </div>
    );
  };

  // Celda overflow "+N" — misma carcasa de carpeta, tono neutro
  const renderOverflowCell = () => (
    <div className="relative group">
      <FolderCardShell
        accent={OVERFLOW_ACCENT}
        onClick={() => setShowAll(true)}
        cornerBadge={
          <div className="absolute top-3 left-3 z-10">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
              <ArrowRight className="w-4 h-4" style={{ color: OVERFLOW_ACCENT }} />
            </div>
          </div>
        }
      >
        <div className="p-3.5 pt-8 w-full z-10 min-w-0 relative">
          <p className="font-black text-lg leading-none text-white">+{overflowCount}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/80 mt-1.5">
            Ver todas
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
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
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
