import { createPortal } from 'react-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, Settings2 } from 'lucide-react';

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
  onOpenSwitcher,
  onViewChange,
  onAddClass,
  dashboardShell,
  disabled = false,
}) {
  const isDayView = viewMode === 'day';
  const isWeekView = viewMode === 'week';

  const footer = (
    <footer
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      data-testid="schedule-mobile-footer"
    >
      <div
        className="mx-auto grid h-[4.5rem] w-full max-w-2xl grid-cols-[44px_44px_44px_minmax(0,1fr)_44px_48px] items-center gap-0.5 px-2"
        role="toolbar"
        aria-label="Controles del horario"
      >
        <FooterButton label="Volver a horarios" onClick={onBack} disabled={disabled}>
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </FooterButton>

        <FooterButton label="Ajustes y acciones del horario" onClick={onOpenActions} disabled={disabled}>
          <Settings2 className="h-5 w-5" aria-hidden="true" />
        </FooterButton>

        <FooterButton
          label="Mostrar vista anterior"
          onClick={() => onViewChange?.('day')}
          disabled={disabled || isDayView}
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </FooterButton>

        <button
          type="button"
          onClick={onOpenSwitcher}
          disabled={disabled}
          aria-label={`Cambiar horario. Horario actual: ${scheduleName || 'Horario'}`}
          aria-disabled={disabled}
          className="flex min-w-0 min-h-11 flex-col items-center justify-center rounded-xl px-1 text-center transition-colors hover:bg-slate-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 dark:hover:bg-slate-800 motion-reduce:transition-none"
        >
          <span className="w-full truncate text-xs font-extrabold leading-tight text-slate-900 dark:text-white">
            {scheduleName || 'Horario'}
          </span>
          <span
            className="mt-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-tight text-slate-500 dark:text-slate-400"
            data-view-mode={viewMode}
          >
            {isWeekView ? 'Semana' : 'Día'}
          </span>
        </button>

        <FooterButton
          label="Mostrar vista siguiente"
          onClick={() => onViewChange?.('week')}
          disabled={disabled || isWeekView}
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </FooterButton>

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
