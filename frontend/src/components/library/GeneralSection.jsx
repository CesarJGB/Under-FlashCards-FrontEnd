// FILE: frontend/src/components/library/GeneralSection.jsx
import { CalendarDays, NotebookPen } from 'lucide-react';

export default function GeneralSection({ onOpenCalendar }) {
  const upcomingTools = [
    {
      id: 'calendar',
      title: 'Horario de clases',
      icon: CalendarDays,
      color: 'from-amber-500 to-orange-600',
      active: true,
      onClick: onOpenCalendar
    },
    {
      id: 'notes',
      title: 'Notas rápidas',
      icon: NotebookPen,
      color: 'from-yellow-400 to-amber-500',
      active: false
    }
  ];

  return (
    <div className="grid grid-cols-2 gap-3 mt-6">
      {upcomingTools.map((tool) => {
        const Icon = tool.icon;

        return (
          <button
            key={tool.id}
            type="button"
            onClick={tool.active ? tool.onClick : undefined}
            disabled={!tool.active}
            className={`aspect-square rounded-2xl border border-slate-200 bg-white p-4 shadow-3xs transition-all duration-200 active:scale-[0.99] dark:border-slate-700 dark:bg-slate-900 ${
              tool.active 
                ? 'cursor-pointer hover:border-slate-300 hover:shadow-xs dark:hover:border-slate-600'
                : 'opacity-70 cursor-not-allowed'
            }`}
          >
            <span className={`mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${tool.color} text-white shadow-xs`}>
              <Icon className="h-6 w-6" />
            </span>
            <span className="mt-3 block text-center text-sm font-bold tracking-tight text-slate-900 dark:text-white">
              {tool.title}
            </span>
          </button>
        );
      })}
    </div>
  );
}
