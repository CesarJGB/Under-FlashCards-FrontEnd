// FILE: frontend/src/components/home/widgets/QuickViewSubjectsWidget.jsx 
import { useMemo } from 'react';
import { Layers } from 'lucide-react';
import useWidgetPager from './useWidgetPager';
import { buildQuickViewNavigationTarget } from '../quickViewNavigation';

const GRID_COLUMNS = 4;
const GRID_ROWS = 2;
const PAGE_SIZE = GRID_COLUMNS * GRID_ROWS;

function PagerDots({ currentPage, totalPages, onSelectPage }) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-1.5">
      {Array.from({ length: totalPages }, (_, index) => {
        const isActive = currentPage === index;

        return (
          <button
            key={index}
            type="button"
            onClick={() => onSelectPage(index)}
            className={`rounded-full transition-all ${
              isActive ? 'w-4 h-1.5 bg-indigo-500' : 'w-1.5 h-1.5 bg-zinc-200 dark:bg-zinc-700'
            }`}
            aria-label={`Ir a la página ${index + 1}`}
          />
        );
      })}
    </div>
  );
}

export default function QuickViewSubjectsWidget({
  quickView,
  getKnowledgeAccent,
  getParcialesBadge,
  onNavigateToLibrary
}) {
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

  const handleCardClick = (materia) => {
    if (shouldSuppressClick()) return;

    const target = buildQuickViewNavigationTarget(materia);
    if (target) onNavigateToLibrary?.(target);
  };

  const renderMateriaCard = (materia) => {
    const accent = getKnowledgeAccent(materia.masteryPercentage);
    const circumference = 2 * Math.PI * 18;
    const strokeDashoffset = circumference - (materia.masteryPercentage / 100) * circumference;
    const parcialesBadge = getParcialesBadge(materia.activeParciales);

    return (
      <button
        key={materia.id}
        type="button"
        onClick={() => handleCardClick(materia)}
        className="group bg-white dark:bg-zinc-900 p-2 rounded-xl border border-zinc-200/70 dark:border-zinc-800 flex flex-col items-center text-center hover:shadow-sm hover:border-indigo-200 dark:hover:border-indigo-900 transition-all active:scale-[0.97] min-w-0 h-28 justify-start"
      >
        <div className="relative w-10 h-10 mb-1 shrink-0">
          <svg className="w-full h-full transform -rotate-90">
            <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="4" fill="none" className="text-zinc-100 dark:text-zinc-800" />
            <circle
              cx="20"
              cy="20"
              r="18"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className={`${accent.circle} transition-all duration-500`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[9px] font-black text-zinc-800 dark:text-zinc-200 leading-none">
              {materia.masteryPercentage}%
            </span>
          </div>
        </div>

        <p className="text-[9px] font-bold text-zinc-800 dark:text-zinc-100 leading-tight line-clamp-2 min-h-[22px] w-full px-0.5 mb-1">
          {materia.title}
        </p>

        <div className="mt-auto min-h-[14px] flex items-center justify-center w-full shrink-0">
          {parcialesBadge ? (
            <span
              title={parcialesBadge}
              className="block max-w-full truncate text-[7px] font-bold px-1 py-0.5 rounded text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40"
            >
              {parcialesBadge}
            </span>
          ) : null}
        </div>
      </button>
    );
  };

  return (
    <div className="h-full flex flex-col px-3 py-3 bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center gap-2 mb-2 px-1">
        <div className="w-7 h-7 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
          <Layers className="w-3.5 h-3.5" />
        </div>
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">Vista rápida</h3>
      </div>

      <div className="flex-1 min-h-0">
        {quickView.isInitialLoad && quickView.selectedMaterias.length === 0 ? (
          <div className="h-full min-h-[230px] rounded-[24px] border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 flex flex-col items-center justify-center gap-3 text-center px-6">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Cargando tus materias rápidas...</p>
          </div>
        ) : quickView.visibleMaterias.length === 0 ? (
          <div className="h-full min-h-[230px] rounded-[24px] border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 flex flex-col items-center justify-center gap-2 text-center px-6">
            <Layers className="w-7 h-7 text-zinc-400" />
            <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">No hay materias todavía.</p>
            <p className="text-[11px] text-zinc-400 max-w-[26ch]">
              Configura tu Quick View clásico y aparecerán aquí.
            </p>
          </div>
        ) : (
          <div
            {...swipeHandlers}
            className="grid grid-cols-4 gap-2"
            style={{ touchAction: totalPages > 1 ? 'pan-y' : 'auto' }}
          >
            {gridItems.map((materia) => {
              if (materia.empty) {
                return (
                  <div
                    key={materia.id}
                    className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/20 h-28"
                  />
                );
              }

              return renderMateriaCard(materia);
            })}
          </div>
        )}
      </div>

      <div className="mt-3 min-h-[12px] px-1">
        <PagerDots currentPage={currentPage} totalPages={totalPages} onSelectPage={goToPage} />
      </div>
    </div>
  );
}
