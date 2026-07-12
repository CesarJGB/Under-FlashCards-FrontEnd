import { useMemo, useState } from 'react';
import { Layers, Settings } from 'lucide-react';
import MateriaSelectorModal from '../MateriaSelectorModal';
import HomeWidgetShell from './HomeWidgetShell';
import useWidgetPager from './useWidgetPager';
import { buildQuickViewNavigationTarget } from '../quickViewNavigation';

const GRID_COLUMNS = 5;
const GRID_ROWS = 2;
const PAGE_SIZE = GRID_COLUMNS * GRID_ROWS;

export default function QuickViewSubjectsWidget({
  quickView,
  enrichedMaterias,
  getKnowledgeAccent,
  getParcialesBadge,
  onNavigateToLibrary
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { currentPage, totalPages, pageItems, goToPage, shouldSuppressClick, swipeHandlers } = useWidgetPager(
    quickView.visibleMaterias,
    PAGE_SIZE
  );

  const gridItems = useMemo(() => {
    const placeholders = Array.from({ length: Math.max(0, PAGE_SIZE - pageItems.length) }, (_, index) => ({
      id: `placeholder-${index}`,
      empty: true
    }));

    return [...pageItems, ...placeholders];
  }, [pageItems]);

  const footerNote = totalPages > 1
    ? `Página ${currentPage + 1} de ${totalPages}. Desliza izquierda o derecha.`
    : `${quickView.visibleMaterias.length} materias en esta carta.`;

  const handleCardClick = (materia) => {
    if (shouldSuppressClick()) return;

    const target = buildQuickViewNavigationTarget(materia);
    if (target) onNavigateToLibrary?.(target);
  };

  return (
    <>
      <HomeWidgetShell
        title="Vista rápida de materias"
        description="La misma selección de Quick View, ahora dentro del carrusel."
        icon={Layers}
        headerAction={(
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            onPointerDown={(event) => event.stopPropagation()}
            className="w-10 h-10 rounded-2xl border border-zinc-200 text-zinc-500 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-colors flex items-center justify-center"
            aria-label="Configurar materias de vista rápida"
          >
            <Settings className="w-4 h-4" />
          </button>
        )}
        currentPage={currentPage}
        totalPages={totalPages}
        onSelectPage={goToPage}
        footerNote={footerNote}
      >
        {quickView.isInitialLoad && quickView.selectedMaterias.length === 0 ? (
          <div className="h-full rounded-[28px] border border-dashed border-zinc-200 bg-zinc-50/70 flex flex-col items-center justify-center gap-3 text-center px-6">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold text-zinc-700">Cargando tus materias rápidas...</p>
          </div>
        ) : quickView.visibleMaterias.length === 0 ? (
          <div className="h-full rounded-[28px] border border-dashed border-zinc-200 bg-zinc-50/70 flex flex-col items-center justify-center gap-2 text-center px-6">
            <Layers className="w-7 h-7 text-zinc-400" />
            <p className="text-sm font-bold text-zinc-700">Esta carta todavía no tiene materias.</p>
            <p className="text-[11px] text-zinc-400 max-w-[26ch]">
              Usa la rueda para elegir qué materias aparecen aquí y en tu Quick View clásico.
            </p>
          </div>
        ) : (
          <div
            {...swipeHandlers}
            className="h-full grid grid-cols-5 grid-rows-2 gap-2.5"
            style={{ touchAction: totalPages > 1 ? 'pan-y' : 'auto' }}
          >
            {gridItems.map((materia) => {
              if (materia.empty) {
                return (
                  <div
                    key={materia.id}
                    className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/60"
                  />
                );
              }

              const accent = getKnowledgeAccent(materia.masteryPercentage);
              const parcialesBadge = getParcialesBadge(materia.activeParciales);

              return (
                <button
                  key={materia.id}
                  type="button"
                  onClick={() => handleCardClick(materia)}
                  className="rounded-2xl border border-zinc-200 bg-white hover:border-indigo-200 hover:shadow-sm transition-all text-left p-2.5 flex flex-col justify-between active:scale-[0.98]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-[10px] font-black px-1.5 py-1 rounded-lg ${accent.badge}`}>
                      {materia.masteryPercentage}%
                    </span>
                    <span className="text-[10px] text-zinc-400 shrink-0">{materia.decksCount}</span>
                  </div>

                  <div>
                    <div className="w-full h-1.5 rounded-full bg-zinc-100 overflow-hidden mb-2">
                      <div
                        className={`h-full rounded-full ${accent.bar}`}
                        style={{ width: `${materia.masteryPercentage}%` }}
                      />
                    </div>

                    <p className="text-[11px] font-bold text-zinc-800 leading-tight line-clamp-2 min-h-[28px]">
                      {materia.title}
                    </p>

                    <div className="mt-1.5 min-h-[16px]">
                      {parcialesBadge ? (
                        <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md">
                          {parcialesBadge}
                        </span>
                      ) : (
                        <span className="text-[10px] text-zinc-400">{materia.totalCards} tarjetas</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </HomeWidgetShell>

      {isModalOpen && (
        <MateriaSelectorModal
          materias={enrichedMaterias}
          selectedMaterias={quickView.selectedMaterias}
          onToggle={quickView.toggleMateria}
          onSelectAll={quickView.selectAll}
          onClearAll={quickView.clearAll}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}
