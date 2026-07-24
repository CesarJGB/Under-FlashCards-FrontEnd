// FILE: frontend/src/components/library/ScheduleCalendar.jsx
import { CalendarDays, ArrowLeft } from 'lucide-react';

export default function ScheduleCalendar({ onBack }) {
  return (
    <div className="w-full max-w-4xl mx-auto p-4 animate-[fadeIn_0.15s_ease]">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a General
        </button>
      )}

      <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
        <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shadow-xs">
          <CalendarDays className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Horario de Clases</h1>
          <p className="text-xs font-medium text-slate-500">Organiza tu semana académica</p>
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center">
        <p className="text-sm font-semibold text-slate-600">Sección en blanco</p>
        <p className="text-xs text-slate-400 mt-1">Aquí irá la grilla interactiva de tu horario semanal.</p>
      </div>
    </div>
  );
}
