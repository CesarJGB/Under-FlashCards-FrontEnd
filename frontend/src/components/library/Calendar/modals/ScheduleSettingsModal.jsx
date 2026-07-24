// FILE: frontend/src/components/library/calendar/modals/ScheduleSettingsModal.jsx
import { Check, Minus, Plus } from 'lucide-react';

export default function ScheduleSettingsModal({ 
  scheduleName, setScheduleName, 
  daysCount, setDaysCount, 
  onClose 
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-[fadeIn_0.15s_ease]">
      <div className="w-full max-w-sm bg-slate-100 rounded-3xl p-5 shadow-2xl space-y-4">
        
        <div className="flex items-center justify-between pb-2">
          <h3 className="text-base font-extrabold text-slate-900">Ajustes</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center text-white cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[3]" />
          </button>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide px-1">
            Horario
          </p>
          
          <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden">
            <div className="p-3.5 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                Nombre del horario
              </span>
              <input
                type="text"
                value={scheduleName}
                onChange={(e) => setScheduleName(e.target.value)}
                className="text-xs font-medium text-slate-500 text-right bg-transparent focus:outline-none focus:text-slate-900 max-w-[130px]"
              />
            </div>

            <div className="p-3.5 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 block">Días</span>
                <span className="text-[11px] font-medium text-slate-400">{daysCount} días</span>
              </div>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  disabled={daysCount <= 5}
                  onClick={() => setDaysCount((prev) => Math.max(5, prev - 1))}
                  className="p-1 rounded-lg hover:bg-white disabled:opacity-30 cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5 text-slate-700" />
                </button>
                <button
                  type="button"
                  disabled={daysCount >= 7}
                  onClick={() => setDaysCount((prev) => Math.min(7, prev + 1))}
                  className="p-1 rounded-lg hover:bg-white disabled:opacity-30 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-slate-700" />
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
