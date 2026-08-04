import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock3 } from 'lucide-react';
import {
  formatDuration,
  getClassTemporalState,
  getCurrentDayIndex,
  getDurationMinutes,
  getMinutesUntilNextClass,
  sortClassesByStart,
} from './scheduleUtils';
import { formatFreeTime, getScheduleGaps } from './scheduleTimeline';

export default function ScheduleDaySummary({ classes = [], activeDayIndex, now: providedNow }) {
  const [clock, setClock] = useState(() => new Date());
  const now = providedNow || clock;

  useEffect(() => {
    if (providedNow) return undefined;
    const timer = window.setInterval(() => setClock(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, [providedNow]);

  const sorted = sortClassesByStart(classes);
  if (sorted.length === 0) return null;

  const isToday = getCurrentDayIndex(now) === activeDayIndex;
  const current = isToday
    ? sorted.find((item) => getClassTemporalState(item, activeDayIndex, now) === 'current')
    : null;
  const next = isToday
    ? sorted.find((item) => getClassTemporalState(item, activeDayIndex, now) === 'upcoming')
    : sorted[0];
  const nextIndex = next ? sorted.findIndex((item) => item.id === next.id) : -1;
  const following = nextIndex >= 0 ? sorted[nextIndex + 1] : null;
  const gaps = getScheduleGaps(sorted, { dayIndex: activeDayIndex });
  const secondaryEvent = current && next ? next : (isToday ? (following || null) : sorted[0]);
  const gapFrom = current && next ? current : (isToday && next && following ? next : null);
  const gapTo = current && next ? next : (isToday && next && following ? following : null);
  const secondaryGap = gapFrom && gapTo
    ? gaps.find((gap) => gap.previousEvent?.id === gapFrom.id && gap.nextEvent?.id === gapTo.id)
    : null;
  const totalMinutes = sorted.reduce((total, item) => total + getDurationMinutes(item), 0);

  let primaryLabel = 'Resumen del día';
  let primaryTitle = `${sorted.length} ${sorted.length === 1 ? 'clase' : 'clases'}`;
  let primaryDetail = formatDuration(totalMinutes);
  let PrimaryIcon = Clock3;

  if (current) {
    primaryLabel = 'Ahora';
    primaryTitle = current.subject;
    primaryDetail = `Hasta ${current.endTime}`;
  } else if (isToday && next) {
    primaryLabel = 'Siguiente';
    primaryTitle = next.subject;
    const minutes = getMinutesUntilNextClass(next, now);
    primaryDetail = minutes > 0 ? `${formatDuration(minutes)} para empezar` : next.startTime;
    PrimaryIcon = ArrowRight;
  } else if (isToday && !next) {
    primaryLabel = 'Hoy';
    primaryTitle = 'Día completado';
    primaryDetail = `${sorted.length} ${sorted.length === 1 ? 'clase finalizada' : 'clases finalizadas'}`;
    PrimaryIcon = CheckCircle2;
  }

  return (
    <section className="mb-4 grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-2" aria-label="Resumen del día">
      <div className="min-w-0 rounded-2xl border border-indigo-100 bg-indigo-50/80 p-3 dark:border-indigo-500/20 dark:bg-indigo-500/10">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-300"><PrimaryIcon className="h-3.5 w-3.5" />{primaryLabel}</div>
        <p className="mt-1 truncate text-sm font-black text-slate-900 dark:text-white">{primaryTitle}</p>
        <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">{primaryDetail}</p>
      </div>
      <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{current && next ? 'Después' : (isToday && following ? 'Luego' : (isToday ? 'Carga del día' : 'Primera clase'))}</p>
        <p className="mt-1 truncate text-sm font-black text-slate-900 dark:text-white">{isToday && !secondaryEvent ? `${sorted.length} ${sorted.length === 1 ? 'clase' : 'clases'}` : secondaryEvent?.subject}</p>
        <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
          {secondaryGap?.status === 'positive' ? formatFreeTime(secondaryGap.durationMinutes) : (secondaryEvent?.startTime || formatDuration(totalMinutes))}
        </p>
      </div>
    </section>
  );
}
