import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Clock3, MapPin, User } from 'lucide-react';
import { mixWithWhite } from '../../../lib/materiaColors';
import {
  formatDuration,
  getClassTemporalState,
  getDurationMinutes,
  getMinutesUntilNextClass,
  getNextClassLabel,
  getTimelineRelations,
  sortClassesByStart,
  timeToMinutes,
} from './scheduleUtils';

export default function ClassList({ currentDayClasses = [], activeDayIndex, subjectColors = [], onSelectClass }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const classes = useMemo(() => sortClassesByStart(currentDayClasses), [currentDayClasses]);
  const relations = useMemo(() => getTimelineRelations(classes, activeDayIndex, now), [activeDayIndex, classes, now]);
  const nextClass = classes.find((item) => item.id === relations.nextId);
  const nextLabel = getNextClassLabel(nextClass ? getMinutesUntilNextClass(nextClass, now) : null);

  if (classes.length === 0) {
    return (
      <div className="flex min-h-[250px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 px-8 py-12 text-center dark:border-slate-700">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800"><BookOpen className="h-6 w-6 text-slate-400" /></div>
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Día libre</p>
        <p className="mt-1 max-w-xs text-xs text-slate-400">No hay clases programadas para este día.</p>
      </div>
    );
  }

  return (
    <section aria-label="Línea temporal de clases" className="relative pb-4">
      {nextClass && nextLabel && <div className="mb-3 flex items-center gap-2 rounded-2xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300"><ArrowRight className="h-4 w-4 shrink-0" />Siguiente: {nextClass.subject} · {nextLabel}</div>}
      <div className="relative space-y-2" role="list">
        <div className="absolute bottom-5 left-[15px] top-5 w-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
        {classes.map((item, index) => {
          const state = getClassTemporalState(item, activeDayIndex, now);
          const previous = classes[index - 1];
          const gap = previous ? Math.max(0, (timeToMinutes(item.startTime) || 0) - (timeToMinutes(previous.endTime) || 0)) : 0;
          const accent = item.resolvedColor || subjectColors.find((entry) => entry.key === item.subjectKey)?.color || '#6366F1';
          const duration = getDurationMinutes(item);
          const height = Math.max(88, Math.min(190, duration * 1.1));

          return (
            <div key={item.id} role="listitem" className="relative pl-9" style={gap > 15 ? { paddingTop: Math.min(22, gap * 0.18) } : undefined}>
              <span className={`absolute left-[9px] top-5 z-10 h-3 w-3 rounded-full border-2 border-white dark:border-slate-950 ${state === 'current' ? 'ring-4 ring-indigo-400/20' : ''}`} style={{ backgroundColor: accent }} aria-hidden="true" />
              {gap > 15 && <span className="absolute left-9 top-0 -translate-y-1/2 text-[10px] font-medium text-slate-400">{gap} min libres</span>}
              <button type="button" onClick={() => onSelectClass(item)} className={`group relative flex w-full items-stretch overflow-hidden rounded-2xl border text-left transition-all active:scale-[0.995] ${state === 'current' ? 'border-indigo-300 shadow-md shadow-indigo-500/10 dark:border-indigo-400/60' : 'border-slate-200 dark:border-slate-700'} bg-white dark:bg-slate-900`} style={{ minHeight: `${height}px` }}>
                <span className="w-1 shrink-0" style={{ backgroundColor: accent }} aria-hidden="true" />
                <span className="flex min-w-0 flex-1 flex-col justify-between gap-3 p-3.5">
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400"><Clock3 className="h-3.5 w-3.5" />{item.startTime} – {item.endTime}<span className="font-medium">· {formatDuration(duration)}</span></span>
                      <span className="mt-1 block break-words text-base font-black text-slate-900 dark:text-white">{item.subject}</span>
                    </span>
                    {state === 'current' && <span className="shrink-0 rounded-full bg-indigo-600 px-2 py-1 text-[10px] font-bold text-white">Ahora</span>}
                    {state === 'upcoming' && item.id === relations.nextId && <span className="shrink-0 rounded-full px-2 py-1 text-[10px] font-bold" style={{ backgroundColor: mixWithWhite(accent, 0.74), color: '#0f172a' }}>Siguiente</span>}
                    {state === 'completed' && <span className="shrink-0 text-[10px] font-semibold text-slate-400">Finalizada</span>}
                  </span>
                  <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                    {item.teacher && item.teacher !== 'Sin profesor' && <span className="inline-flex min-w-0 items-center gap-1"><User className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{item.teacher}</span></span>}
                    {item.room && item.room !== 'Por definir' && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 shrink-0" />{item.room}</span>}
                  </span>
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
