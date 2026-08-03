import { useMemo } from 'react';
import { getCurrentDayIndex } from './scheduleUtils';
import { SHORT_WEEKDAYS } from './useScheduleCalendar';

export default function DayTabs({ daysCount, activeDayIndex, setActiveDayIndex, classes = [] }) {
  const todayIndex = useMemo(() => getCurrentDayIndex(), []);
  return (
    <nav className="sticky top-0 z-20 -mx-1 mb-5 border-b border-slate-200/80 bg-slate-50/95 px-1 pb-2 pt-1 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/95" aria-label="Días del horario">
      <div className="flex snap-x snap-mandatory gap-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SHORT_WEEKDAYS.slice(0, daysCount).map((dayName, index) => {
          const active = activeDayIndex === index;
          const hasClasses = classes.some((item) => item.dayIndex === index);
          const isToday = todayIndex === index;
          const firstClassColor = classes.find((item) => item.dayIndex === index)?.resolvedColor;
          return (
            <button key={dayName} type="button" onClick={() => setActiveDayIndex(index)} aria-current={active ? 'page' : undefined} className={`relative min-h-12 min-w-[58px] snap-start rounded-xl px-2 py-2 text-xs font-bold transition-colors ${active ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-500 hover:bg-white/70 hover:text-slate-800 dark:hover:bg-slate-900 dark:hover:text-slate-200'}`}>
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
