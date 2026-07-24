// FILE: frontend/src/components/library/calendar/ScheduleHeader.jsx
import { ArrowLeft, Settings, ChevronRight } from 'lucide-react';

export default function ScheduleHeader({ onBack, scheduleName, onOpenSettings }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-200/80 mb-4 px-2">
      <button
        type="button"
        onClick={onBack}
        className="p-2 -ml-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
      >
        <ArrowLeft className="w-4 h-4" />
        General
      </button>

      <button
        type="button"
        onClick={onOpenSettings}
        className="flex items-center gap-1.5 text-base font-extrabold text-slate-900 hover:opacity-80 transition-opacity cursor-pointer"
      >
        <span>{scheduleName}</span>
        <ChevronRight className="w-4 h-4 text-slate-400 rotate-90" />
      </button>

      <button
        type="button"
        onClick={onOpenSettings}
        className="p-2 -mr-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
        title="Ajustes de horario"
      >
        <Settings className="w-5 h-5" />
      </button>
    </div>
  );
}
