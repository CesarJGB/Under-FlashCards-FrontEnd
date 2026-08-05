import { ArrowLeft, Download, Settings, ChevronDown } from 'lucide-react';

export default function ScheduleHeader({ onBack, scheduleName, onOpenSettings, onOpenScheduleActions, onExport, exporting = false }) {
  return (
    <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-slate-200/80 px-1 py-2.5 dark:border-slate-800">
      <button type="button" onClick={onBack} className="min-h-11 min-w-11 rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-transform active:scale-95 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Volver a horarios"><ArrowLeft className="mx-auto h-4 w-4" /></button>

      <button type="button" onClick={onOpenScheduleActions} className="mx-auto flex min-w-0 max-w-full items-center justify-center gap-1.5 rounded-xl px-2 text-base font-extrabold text-slate-900 hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800" aria-label="Abrir opciones del horario">
        <span className="truncate">{scheduleName || 'Horario'}</span><ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      <div className="flex items-center gap-1">
        <button type="button" onClick={onExport} disabled={exporting} className="min-h-11 min-w-11 rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-transform active:scale-95 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Descargar horario como PDF"><Download className="mx-auto h-4 w-4" /></button>
        <button type="button" onClick={onOpenSettings} className="min-h-11 min-w-11 rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-transform active:scale-95 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Ajustes del horario"><Settings className="mx-auto h-4 w-4" /></button>
      </div>
    </header>
  );
}
