// FILE: frontend/src/components/library/GeneralSection.jsx
import { CalendarDays, NotebookPen, Sparkles } from 'lucide-react';

export default function GeneralSection({ onOpenCalendar }) {
  const upcomingTools = [
    {
      id: 'calendar',
      icon: CalendarDays,
      title: 'Horario de clases',
      description: 'Arma tu horario semanal y recibe recordatorios antes de cada clase.',
      active: true,
      onClick: onOpenCalendar
    },
    {
      id: 'notes',
      icon: NotebookPen,
      title: 'Notas rápidas',
      description: 'Guarda apuntes sueltos por materia sin salir de la app.',
      active: false
    }
  ];

  return (
    <div className="mt-8 flex flex-col items-center text-center px-4">
      <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center shadow-sm shadow-slate-900/10">
        <Sparkles className="w-6 h-6 text-white" />
      </div>

      <h2 className="mt-4 text-base font-bold text-slate-900">
        Próximamente en General
      </h2>
      <p className="mt-1.5 text-xs font-medium text-slate-500 max-w-xs">
        Aquí vivirán tus herramientas de vida académica, fuera de tus mazos y materias.
      </p>

      <div className="mt-6 w-full max-w-sm flex flex-col gap-2.5">
        {upcomingTools.map(({ id, icon: Icon, title, description, active, onClick }) => (
          <button
            key={id}
            type="button"
            onClick={onClick}
            disabled={!active}
            className={`flex items-start gap-3 p-3.5 bg-white border border-slate-200 rounded-2xl text-left shadow-3xs transition-all ${
              active 
                ? 'hover:border-slate-300 hover:shadow-xs cursor-pointer active:scale-[0.995]' 
                : 'opacity-70 cursor-not-allowed'
            }`}
          >
            <div className="w-9 h-9 shrink-0 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center">
              <Icon className="w-4 h-4 text-slate-500" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">{title}</p>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">{description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
