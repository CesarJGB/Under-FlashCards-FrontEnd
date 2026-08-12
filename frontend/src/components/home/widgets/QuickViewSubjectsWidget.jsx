// FILE: frontend/src/components/home/widgets/QuickViewSubjectsWidget.jsx 
import { useMemo } from 'react';
import { Layers } from 'lucide-react';
import useWidgetPager from './useWidgetPager';
import { buildQuickViewNavigationTarget } from '../quickViewNavigation';

const GRID_COLUMNS = 3;
const GRID_ROWS = 2;
const PAGE_SIZE = GRID_COLUMNS * GRID_ROWS;

const QUICK_VIEW_CARD_TONES = [
  {
    card: 'border-[#DDD2FA] bg-[#F3EEFF] hover:border-[#C9B9F3]',
    track: 'text-[#DDD4F7]'
  },
  {
    card: 'border-[#CFE0FA] bg-[#EEF5FF] hover:border-[#B9D2F5]',
    track: 'text-[#D3E2FB]'
  },
  {
    card: 'border-[#F4D6BF] bg-[#FFF4EC] hover:border-[#EDC5A7]',
    track: 'text-[#F8DDCA]'
  },
  {
    card: 'border-[#C6E7E2] bg-[#EDF9F7] hover:border-[#ACDAD3]',
    track: 'text-[#D0ECE8]'
  },
  {
    card: 'border-[#F4CCD5] bg-[#FFF0F3] hover:border-[#ECB6C2]',
    track: 'text-[#F5D1D8]'
  },
  {
    card: 'border-[#F1DFAD] bg-[#FFF9E8] hover:border-[#E8CF8D]',
    track: 'text-[#F4E5B8]'
  }
];

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

  const renderMateriaCard = (materia, position) => {
    const accent = getKnowledgeAccent(materia.masteryPercentage);
    const tone = QUICK_VIEW_CARD_TONES[position % QUICK_VIEW_CARD_TONES.length];
    const circumference = 2 * Math.PI * 24;
    const strokeDashoffset = circumference - (materia.masteryPercentage / 100) * circumference;
    const parcialesBadge = getParcialesBadge(materia.activeParciales);

    return (
      <button
        key={materia.id}
        type="button"
        onClick={() => handleCardClick(materia)}
        // 1. Reducimos el alto de la tarjeta a h-32 y cambiamos el padding a p-2 para compactarlo
        className={`group flex h-32 min-w-0 flex-col items-center justify-start rounded-xl border p-2 text-center transition-colors active:scale-[0.97] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-900 ${tone.card}`}
      >
        {/* Mantener anillo grande pero reducir el margen inferior a mb-1.5 */}
        <div className="relative w-14 h-14 mb-1.5 shrink-0">
          <svg className="w-full h-full transform -rotate-90">
            <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="5" fill="none" className={`${tone.track} dark:text-zinc-800`} />
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
            <span className="text-[11px] font-black text-zinc-800 dark:text-zinc-200 leading-none">
              {materia.masteryPercentage}%
            </span>
          </div>
        </div>

        {/* 2. Reducimos la altura mínima del título a min-h-[24px] y su margen a mb-0.5 */}
        <p className="text-[10px] font-bold text-zinc-800 dark:text-zinc-100 leading-tight line-clamp-2 min-h-[24px] w-full px-0.5 mb-0.5">
          {materia.title}
        </p>

        {/* Al ser h-32, el mt-auto juntará el badge al texto de forma orgánica */}
        <div className="mt-auto min-h-[14px] flex items-center justify-center w-full shrink-0">
          {parcialesBadge ? (
            <span
              title={parcialesBadge}
              className="block max-w-full truncate rounded bg-[#EEE8FC] px-1.5 py-0.5 text-[7px] font-bold text-[#6246D8] dark:bg-indigo-950/40 dark:text-indigo-400"
            >
              {parcialesBadge}
            </span>
          ) : null}
        </div>
      </button>
    );
  };

  return (
    <div className="flex h-full flex-col bg-transparent px-3 py-3 dark:bg-zinc-950">
      <div className="flex items-center gap-2 mb-2 px-1">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[14px] bg-[#F0EBFF] text-[#6246D8] dark:bg-indigo-950/40 dark:text-indigo-400">
          <Layers className="h-4 w-4" />
        </div>
        <h3 className="truncate text-base font-bold text-zinc-900 dark:text-zinc-100">Vista rápida</h3>
      </div>

      <div className="flex-1 min-h-0">
        {quickView.isInitialLoad && quickView.selectedMaterias.length === 0 ? (
          <div className="h-full min-h-[250px] rounded-[24px] border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 flex flex-col items-center justify-center gap-3 text-center px-6">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Cargando tus materias rápidas...</p>
          </div>
        ) : quickView.visibleMaterias.length === 0 ? (
          <div className="h-full min-h-[250px] rounded-[24px] border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 flex flex-col items-center justify-center gap-2 text-center px-6">
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
            {gridItems.map((materia, position) => {
              if (materia.empty) {
                return (
                  <div
                    key={materia.id}
                    // 3. Sincronizamos la altura h-32 para los slots vacíos
                    className="h-32 rounded-xl border border-dashed border-[#E7E0F7] bg-[#FAF8FF]/70 dark:border-zinc-800 dark:bg-zinc-900/20"
                  />
                );
              }

              return renderMateriaCard(materia, position);
            })}
          </div>
        )}
      </div>

      {/* 4. Dejamos una separación limpia mt-4. Con el nuevo tamaño de rejilla ya no habrá roces */}
      <div className="mt-4 min-h-[12px] px-1">
        <PagerDots currentPage={currentPage} totalPages={totalPages} onSelectPage={goToPage} />
      </div>
    </div>
  );
}
