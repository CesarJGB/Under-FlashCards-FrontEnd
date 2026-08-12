// FILE: frontend/src/components/library/GeneralSection.jsx
import { useLayoutEffect, useState } from 'react';
import { staticIllustrations } from '../../lib/staticIllustrations';
import ScheduleListScreen from './calendar/ScheduleListScreen';

export default function GeneralSection({ userId, dashboardShell, onCalendarImmersiveChange }) {
  const [view, setView] = useState('tools');

  useLayoutEffect(() => {
    onCalendarImmersiveChange?.(view === 'calendar');

    return () => {
      onCalendarImmersiveChange?.(false);
    };
  }, [view, onCalendarImmersiveChange]);

  if (view === 'calendar') {
    return (
      <ScheduleListScreen
        userId={userId}
        dashboardShell={dashboardShell}
        onBack={() => setView('tools')}
      />
    );
  }

  const upcomingTools = [
    {
      id: 'calendar',
      title: 'Horario de clases',
      description: 'Organiza tu semana',
      illustration: staticIllustrations.schoolCalendar,
      visualClassName: 'bg-[#8EDAF2]',
      active: true,
      onClick: () => setView('calendar')
    },
    {
      id: 'notes',
      title: 'Notas rápidas',
      description: 'Próximamente',
      illustration: staticIllustrations.quickNotes,
      visualClassName: 'bg-[#FFE477]',
      active: false
    }
  ];

  return (
    <section className="mt-6" aria-labelledby="general-tools-title">
      <h2 id="general-tools-title" className="mb-3 text-lg font-black tracking-tight text-slate-900 dark:text-white">
        Herramientas
      </h2>

      <div className="grid grid-cols-2 gap-3.5">
        {upcomingTools.map((tool) => (
          <button
            key={tool.id}
            type="button"
            onClick={tool.active ? tool.onClick : undefined}
            disabled={!tool.active}
            className={`group min-h-[204px] overflow-hidden rounded-[22px] border border-slate-200/90 bg-white text-left shadow-[0_8px_22px_rgba(15,23,42,0.08)] transition-all duration-200 active:scale-[0.985] dark:border-slate-700 dark:bg-slate-900 ${
              tool.active 
                ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(15,23,42,0.11)] active:translate-y-0 dark:hover:border-slate-600'
                : 'cursor-not-allowed opacity-65 grayscale-[0.12]'
            }`}
          >
            <span className={`flex h-[132px] items-center justify-center overflow-hidden ${tool.visualClassName}`}>
              <img
                src={tool.illustration}
                alt=""
                aria-hidden="true"
                className={`h-[116px] w-[116px] object-contain transition-transform duration-200 ${tool.active ? 'group-hover:scale-[1.03]' : ''}`}
              />
            </span>

            <span className="flex min-h-[72px] flex-col items-center justify-center px-2.5 py-2 text-center">
              <span className="block text-[13px] font-black leading-tight tracking-tight text-slate-950 dark:text-white sm:text-sm">
                {tool.title}
              </span>
              <span className="mt-1 block text-[11px] font-medium leading-tight text-slate-500 dark:text-slate-400">
                {tool.description}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
