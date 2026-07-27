// FILE: frontend/src/components/library/calendar/ScheduleHeader.jsx
import { ArrowLeft, Settings, ChevronDown } from 'lucide-react';

export default function ScheduleHeader({ onBack, scheduleName, onOpenSettings, onOpenSwitcher }) {
  return (
    <header className="grid grid-cols-3 items-center py-3 border-b border-slate-200/80 dark:border-slate-700/50 mb-4 px-2">
      {/* Columna Izquierda: Botón de retroceso cuadrado */}
      <button
        type="button"
        onClick={onBack}
        className="justify-self-start h-9 w-9 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-95 transition-all cursor-pointer shadow-3xs"
        title="Volver"
      >
        <ArrowLeft className="w-4 h-4" />
      </button>

      {/* Columna Central: Selector de horario (limitado a su propio espacio) */}
      <button
        type="button"
        onClick={onOpenSwitcher}
        className="justify-self-center flex items-center justify-center gap-1.5 text-base font-extrabold text-slate-900 dark:text-white truncate px-2 cursor-pointer hover:opacity-80 transition-opacity max-w-full"
      >
        <span className="truncate">{scheduleName}</span>
        <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
      </button>

      {/* Columna Derecha: Botón de ajustes cuadrado (simétrico al izquierdo) */}
      <button
        type="button"
        onClick={onOpenSettings}
        className="justify-self-end h-9 w-9 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-95 transition-all cursor-pointer shadow-3xs"
        title="Ajustes de horario"
      >
        <Settings className="w-4 h-4" />
      </button>
    </header>
  );
}
