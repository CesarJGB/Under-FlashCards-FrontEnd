// FILE: frontend/src/components/home/widgets/QuickViewSubjectsWidget.jsx 
import { useMemo } from 'react';
import { Layers } from 'lucide-react';
import useWidgetPager from './useWidgetPager';
import { buildQuickViewNavigationTarget } from '../quickViewNavigation';

const GRID_COLUMNS = 3;
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
    // 1. Ampliamos el radio a 24 para que el anillo tenga mayor presencia visual
    const circumference = 2 * Math.PI * 24;
    const strokeDashoffset = circumference - (materia.masteryPercentage / 100) * circumference;
    const parcialesBadge = getParcialesBadge(materia.activeParciales);

    return (
      <button
        key={materia.id}
        type="button"
        onClick={() => handleCardClick(materia)}
        // 2. Aumentamos la altura fija a h-36 y mejoramos el padding a p-2.5
        className="group bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-zinc-200/70 dark:border-zinc-800 flex flex-col items-center text-center hover:shadow-sm hover:border-indigo-200 dark:hover:border-indigo-900 transition-all active:scale-[0.97] min-w-0 h-36 justify-start"
      >
        {/* 3. El contenedor del círculo ahora pasa a w-14 h-14 (56px) */}
        <div className="relative w-14 h-14 mb-2 shrink-0">
          <svg className="w-full h-full transform -rotate-90">
            <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="5" fill="none" className="text-zinc-100 dark:text-zinc-800" />
            <circle
              cx="28"
              cy="28"
              r="24"
              stroke="currentColor"
              strokeWidth="5"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className={`${accent.circle} transition-all duration-500`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Escalamos el texto del porcentaje a text-[11px] */}
            <span className="text-[11px] font-black text-zinc-800 dark:text-zinc-200 leading-none">
              {materia.masteryPercentage}%
            </span>
          </div>
        </div>

        {/* Ajustamos ligeramente el tamaño y altura mínima del título */}
        <p className="text-[10px] font-bold text-zinc-800 dark:text-zinc-100 leading-tight line-clamp-2 min-h-[26px] w-full px-0.5 mb-1">
          {materia.title}
        </p>

        <div className="mt-auto min-h-[14px] flex items-center justify-center w-full shrink-0">
          {parcialesBadge ? (
            <span
              title={parcialesBadge}
              className="block max-w-full truncate text-[7px] font-bold px-1.5 py-0.5 rounded text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40"
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
          <div className="h-full min-h-[280px] rounded-[24px] border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 flex flex-col items-center justify-center gap-3 text-center px-6">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Cargando tus materias rápidas...</p>
          </div>
        ) : quickView.visibleMaterias.length === 0 ? (
          <div className="h-full min-h-[280px] rounded-[24px] border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 flex flex-col items-center justify-center gap-2 text-center px-6">
            <Layers className="w-7 h-7 text-zinc-400" />
            <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">No hay materias todavía.</p>
            <p className="text-[11px] text-zinc-400 max-w-[26ch]">
              Configura tu Quick View clásico y aparecerán aquí.
            </p>
          </div>
        ) : (
          <div
            {...swipeHandlers}
            className="grid grid-cols-3 gap-2"
            style={{ touchAction: totalPages > 1 ? 'pan-y' : 'auto' }}
          >
            {gridItems.map((materia) => {
              if (materia.empty) {
                return (
                  <div
                    key={materia.id}
                    // 4. Mantenemos sincronizada la altura h-36 aquí también
                    className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/20 h-36"
                  />
                );
              }

              return renderMateriaCard(materia);
            })}
          </div>
        )}
      </div>

      {/* 5. Aumentamos el margen superior a mt-5 para separar físicamente los puntos del grid */}
      <div className="mt-5 min-h-[12px] px-1">
        <PagerDots currentPage={currentPage} totalPages={totalPages} onSelectPage={goToPage} />
      </div>
    </div>
  );
}
