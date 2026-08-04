import { useMemo } from 'react';
import { getCurrentDayIndex, resolveScheduleClassColor } from './scheduleUtils';
import {
  formatFreeTime,
  getRoundedScheduleTimeRange,
  getScheduleGaps,
  minutesToTime,
  sortScheduleEvents,
  timeToMinutes,
} from './scheduleTimeline';
import { SHORT_WEEKDAYS, WEEKDAYS } from './useScheduleCalendar';

const DAY_WIDTH = 152;
const LABEL_WIDTH = 50;

export default function ScheduleWeekView({
  classes = [],
  daysCount = 5,
  activeDayIndex = 0,
  subjectColors = [],
  onSelectDay,
  onSelectClass,
}) {
  const todayIndex = useMemo(() => getCurrentDayIndex(), []);
  const visibleClasses = useMemo(() => sortScheduleEvents(classes).filter((item) => (
    Number(item.dayIndex) >= 0 && Number(item.dayIndex) < daysCount
  )), [classes, daysCount]);
  const range = useMemo(() => getRoundedScheduleTimeRange(visibleClasses), [visibleClasses]);
  const duration = Math.max(30, range.end - range.start);
  const scale = Math.max(0.72, Math.min(0.9, 600 / duration));
  const timelineHeight = Math.round(duration * scale);
  const marks = [];
  for (let minute = range.start; minute <= range.end; minute += 30) marks.push(minute);
  const days = Array.from({ length: daysCount }, (_, dayIndex) => ({
    dayIndex,
    classes: visibleClasses.filter((item) => Number(item.dayIndex) === dayIndex),
  }));
  const gridWidth = LABEL_WIDTH + (DAY_WIDTH * daysCount);

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900" aria-label="Vista semanal del horario">
      <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Semana completa</p>
        <p className="mt-0.5 text-[11px] text-slate-400">Desliza horizontalmente y toca un día para abrir su detalle.</p>
      </div>
      <div className="overflow-x-auto overscroll-x-contain [scrollbar-width:thin]">
        <div style={{ minWidth: `${gridWidth}px` }}>
          <div className="sticky top-0 z-20 grid border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95" style={{ gridTemplateColumns: `${LABEL_WIDTH}px repeat(${daysCount}, ${DAY_WIDTH}px)` }}>
            <div className="flex min-h-14 items-center justify-center text-[9px] font-bold uppercase tracking-wide text-slate-400">Hora</div>
            {days.map((day) => {
              const active = day.dayIndex === activeDayIndex;
              const today = day.dayIndex === todayIndex;
              return (
                <button key={day.dayIndex} type="button" onClick={() => onSelectDay(day.dayIndex)} className={`min-h-14 border-l border-slate-100 px-2 py-2 text-left transition-colors dark:border-slate-800 ${active ? 'bg-indigo-50 dark:bg-indigo-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}>
                  <span className={`block text-[10px] font-bold uppercase tracking-wide ${today ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-400'}`}>{SHORT_WEEKDAYS[day.dayIndex]}{today ? ' · Hoy' : ''}</span>
                  <span className="mt-0.5 block truncate text-xs font-black text-slate-800 dark:text-slate-100">{day.classes.length || 'Libre'} {day.classes.length ? (day.classes.length === 1 ? 'clase' : 'clases') : ''}</span>
                </button>
              );
            })}
          </div>

          <div className="relative" style={{ height: `${timelineHeight}px` }}>
            {marks.map((minute) => {
              const top = (minute - range.start) * scale;
              const hour = minute % 60 === 0;
              return (
                <div key={minute} className="absolute inset-x-0" style={{ top: `${top}px` }} aria-hidden="true">
                  <span className={`absolute left-1 w-11 -translate-y-1/2 text-right text-[9px] font-semibold ${hour ? 'text-slate-500 dark:text-slate-400' : 'text-slate-300 dark:text-slate-700'}`}>{hour ? minutesToTime(minute) : ''}</span>
                  <span className={`absolute h-px ${hour ? 'bg-slate-200 dark:bg-slate-700' : 'bg-slate-100 dark:bg-slate-800/70'}`} style={{ left: `${LABEL_WIDTH}px`, right: 0 }} />
                </div>
              );
            })}

            {days.map((day, dayPosition) => {
              const left = LABEL_WIDTH + (dayPosition * DAY_WIDTH);
              const gaps = getScheduleGaps(day.classes, { dayIndex: day.dayIndex }).filter((gap) => gap.status === 'positive');
              return (
                <div key={day.dayIndex} className={`absolute inset-y-0 border-l border-slate-100 dark:border-slate-800 ${day.dayIndex === activeDayIndex ? 'bg-indigo-50/25 dark:bg-indigo-500/[0.035]' : ''}`} style={{ left: `${left}px`, width: `${DAY_WIDTH}px` }}>
                  {gaps.map((gap) => {
                    const top = (gap.startMinutes - range.start) * scale;
                    const height = Math.max(1, gap.durationMinutes * scale);
                    return (
                      <div key={gap.id} className="absolute inset-x-1.5 overflow-hidden border-y border-dashed border-slate-200 bg-slate-50/60 text-center dark:border-slate-700 dark:bg-slate-950/20" style={{ top: `${top}px`, height: `${height}px` }} role="note" aria-label={formatFreeTime(gap.durationMinutes)} title={formatFreeTime(gap.durationMinutes)}>
                        {height >= 18 && <span className="text-[8px] font-semibold text-slate-400">{formatFreeTime(gap.durationMinutes)}</span>}
                      </div>
                    );
                  })}
                  {day.classes.map((item) => {
                    const start = timeToMinutes(item.startTime);
                    const end = timeToMinutes(item.endTime);
                    if (start === null || end === null || end <= start) return null;
                    const top = (start - range.start) * scale;
                    const height = Math.max(20, ((end - start) * scale) - 2);
                    const accent = resolveScheduleClassColor(item, subjectColors);
                    return (
                      <button
                        key={item.id || `${day.dayIndex}-${item.startTime}-${item.subject}`}
                        type="button"
                        onClick={() => onSelectClass(item)}
                        className="absolute inset-x-1.5 overflow-hidden rounded-lg border bg-white px-2 py-1 text-left shadow-sm transition-transform active:scale-[0.98] dark:bg-slate-900"
                        style={{ top: `${top + 1}px`, height: `${height}px`, borderColor: accent, boxShadow: `inset 3px 0 0 ${accent}` }}
                        aria-label={`${item.subject}, ${WEEKDAYS[day.dayIndex]}, ${item.startTime} a ${item.endTime}`}
                      >
                        <span className="block truncate text-[9px] font-bold" style={{ color: accent }}>{item.startTime}</span>
                        <span className="block truncate text-[10px] font-black leading-tight text-slate-900 dark:text-white">{item.subject}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
