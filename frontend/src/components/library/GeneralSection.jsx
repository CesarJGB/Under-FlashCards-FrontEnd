// FILE: frontend/src/components/library/GeneralSection.jsx
import { CalendarDays, NotebookPen } from 'lucide-react';

export default function GeneralSection({ onOpenCalendar }) {
  const upcomingTools = [
    {
      id: 'calendar',
      icon: CalendarDays,
      title: 'Horario de clases',
      active: true,
      onClick: onOpenCalendar
    },
    {
      id: 'notes',
      icon: NotebookPen,
      title: 'Notas rápidas',
      active: false
    }
  ];

  return (
    <div className="mt-8 flex flex-col items-center px-4">
      <div className="w-full max-w-sm flex flex-col gap-2.5">
        {upcomingTools.map(({ id, icon: Icon, title, active, onClick }) => (
          <button
            key={id}
            type="button"
            onClick={onClick}
            disabled={!active}
            className={`flex items-center gap-3 p-3.5 bg-white border border-slate-200 rounded-2xl text-left shadow-3xs transition-all ${
              active 
                ? 'hover:border-slate-300 hover:shadow-xs cursor-pointer active:scale-[0.995]' 
                : 'opacity-70 cursor-not-allowed'
            }`}
          >
            <div className="w-9 h-9 shrink-0 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center">
              <Icon className="w-4 h-4 text-slate-500" />
            </div>
            <p className="text-xs font-bold text-slate-800">{title}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
