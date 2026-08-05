import { createPortal } from 'react-dom';
import { ArrowLeft, ChevronDown, Plus, Settings2 } from 'lucide-react';

function FooterButton({ label, onClick, disabled = false, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-disabled={disabled}
      className={`flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white motion-reduce:transition-none ${className}`}
    >
      {children}
    </button>
  );
}

export default function ScheduleMobileFooter({
  scheduleName,
  viewMode = 'day',
  onBack,
  onOpenActions,
  onOpenScheduleActions,
  onAddClass,
  dashboardShell,
  disabled = false,
}) {
  const isWeekView = viewMode === 'week';

  const footer = (
    <footer
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      data-testid="schedule-mobile-footer"
    >
      <div
        className="mx-auto grid h-[4.5rem] w-full max-w-2xl grid-cols-[44px_44px_minmax(0,1fr)_52px] items-center gap-1 px-3"
        role="toolbar"
        aria-label="Controles del horario"
      >
        <FooterButton label="Volver a horarios" onClick={onBack} disabled={disabled}>
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </FooterButton>

        <FooterButton label="Ajustes y acciones del horario" onClick={onOpenActions} disabled={disabled}>
          <Settings2 className="h-5 w-5" aria-hidden="true" />
        </FooterButton>

        <button
          type="button"
          onClick={onOpenScheduleActions}
          disabled={disabled}
          aria-label={`Abrir opciones del horario. Horario actual: ${scheduleName || 'Horario'}`}
          aria-disabled={disabled}
          className="flex min-h-11 min-w-0 flex-col items-center justify-center rounded-xl px-2 text-center transition-colors hover:bg-slate-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 dark:hover:bg-slate-800 motion-reduce:transition-none"
        >
          <span className="flex w-full min-w-0 items-center justify-center gap-1">
            <span className="truncate text-xs font-extrabold leading-tight text-slate-900 dark:text-white">
              {scheduleName || 'Horario'}
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
          </span>
          <span
            className="mt-0.5 max-w-full truncate text-[10px] font-semibold leading-tight text-slate-500 dark:text-slate-400"
            data-view-mode={viewMode}
          >
            {isWeekView ? 'Semana' : 'Día'} · toca para más opciones
          </span>
        </button>

        <FooterButton
          label="Añadir clase"
          onClick={onAddClass}
          disabled={disabled}
          className="rounded-2xl bg-slate-900 text-white shadow-sm hover:bg-slate-800 hover:text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 dark:hover:text-slate-900"
        >
          <Plus className="h-6 w-6 stroke-[2.75]" aria-hidden="true" />
        </FooterButton>
      </div>
    </footer>
  );

  if (dashboardShell && typeof document !== 'undefined') {
    return createPortal(footer, dashboardShell);
  }

  return footer;
}
