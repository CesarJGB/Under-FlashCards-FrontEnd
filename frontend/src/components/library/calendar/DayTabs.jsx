import { useEffect, useMemo, useRef } from 'react';
import { getCurrentDayIndex } from './scheduleUtils';
import { SHORT_WEEKDAYS } from './useScheduleCalendar';

function getScrollBehavior() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'smooth';
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

export default function DayTabs({ daysCount, activeDayIndex, setActiveDayIndex, classes = [] }) {
  const todayIndex = useMemo(() => getCurrentDayIndex(), []);
  const scrollRef = useRef(null);
  const visibleDays = SHORT_WEEKDAYS.slice(0, daysCount);
  const usesFullWidthGrid = visibleDays.length <= 5;

  useEffect(() => {
    const container = scrollRef.current;
    const activeTab = container?.querySelector(`[data-day-index="${activeDayIndex}"]`);
    if (!container || !activeTab) return undefined;

    const containerRect = container.getBoundingClientRect();
    const tabRect = activeTab.getBoundingClientRect();
    const isPartiallyHidden = tabRect.left < containerRect.left || tabRect.right > containerRect.right;
    if (isPartiallyHidden && typeof activeTab.scrollIntoView === 'function') {
      activeTab.scrollIntoView({ behavior: getScrollBehavior(), block: 'nearest', inline: 'center' });
    }

    return undefined;
  }, [activeDayIndex, daysCount]);

  return (
    <nav
      className="sticky top-0 z-20 -mx-1 mb-5 border-b border-slate-200/80 bg-slate-50/95 px-1 pb-2 pt-1 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/95"
      aria-label="Días del horario"
      data-testid="schedule-day-tabs"
    >
      <div
        ref={scrollRef}
        className={`snap-x snap-mandatory overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${usesFullWidthGrid ? 'grid grid-cols-5 gap-1' : 'flex gap-1 overflow-x-auto'}`}
      >
        {visibleDays.map((dayName, index) => {
          const active = activeDayIndex === index;
          const hasClasses = classes.some((item) => Number(item.dayIndex) === index);
          const isToday = todayIndex === index;
          const firstClassColor = classes.find((item) => Number(item.dayIndex) === index)?.resolvedColor;

          return (
            <button
              key={dayName}
              type="button"
              data-day-index={index}
              onClick={() => setActiveDayIndex(index)}
              aria-current={active ? 'page' : undefined}
              aria-label={`${dayName}${isToday ? ', hoy' : ''}${active ? ', seleccionado' : ''}`}
              className={`relative min-h-12 snap-start rounded-xl px-2 py-2 text-xs font-bold transition-colors motion-reduce:transition-none ${usesFullWidthGrid ? 'min-w-0 w-full' : 'min-w-[58px] shrink-0'} ${active ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-500 hover:bg-white/70 hover:text-slate-800 dark:hover:bg-slate-900 dark:hover:text-slate-200'}`}
            >
              <span className="block">{dayName}</span>
              <span className={`mt-1 flex items-center justify-center gap-1 text-[9px] font-semibold ${isToday ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-400'}`}>
                {isToday && 'Hoy'}
                {hasClasses && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: firstClassColor || (active ? '#6366F1' : '#94a3b8') }} aria-label="Tiene clases" />}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
