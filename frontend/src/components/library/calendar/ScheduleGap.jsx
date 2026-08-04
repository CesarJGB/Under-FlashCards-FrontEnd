import { Coffee } from 'lucide-react';
import { formatFreeTime } from './scheduleTimeline';

export default function ScheduleGap({ gap, compact = false }) {
  if (!gap || gap.status !== 'positive' || !gap.durationMinutes) return null;
  const label = formatFreeTime(gap.durationMinutes);

  return (
    <div className={`relative flex items-center gap-2 pl-9 text-slate-400 dark:text-slate-500 ${compact ? 'min-h-7 py-0.5' : 'min-h-9 py-1'}`} role="note" aria-label={label}>
      <span className="absolute left-[15px] top-0 h-full border-l border-dashed border-slate-300 dark:border-slate-700" aria-hidden="true" />
      <Coffee className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
      <span className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent dark:from-slate-700" aria-hidden="true" />
    </div>
  );
}
