import { CalendarDays, List } from 'lucide-react';

const OPTIONS = [
  { id: 'day', label: 'Día', icon: List },
  { id: 'week', label: 'Semana', icon: CalendarDays },
];

export default function ScheduleViewSwitcher({ value = 'day', onChange }) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-900" role="group" aria-label="Vista del horario">
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const selected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={selected}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold transition-all ${selected ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
