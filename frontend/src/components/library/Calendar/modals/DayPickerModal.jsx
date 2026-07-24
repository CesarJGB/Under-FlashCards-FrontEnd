// FILE: frontend/src/components/library/calendar/modals/DayPickerModal.jsx
import { WEEKDAYS } from '../useScheduleCalendar';

export default function DayPickerModal({ daysCount, onSelectDay, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 animate-[fadeIn_0.15s_ease]">
      <div className="w-full max-w-sm bg-slate-100/95 rounded-3xl p-5 shadow-2xl space-y-2 border border-white/40">
        <h3 className="text-center text-base font-extrabold text-slate-900 py-1">
          ¿Qué día?
        </h3>
        <div className="space-y-2">
          {WEEKDAYS.slice(0, daysCount).map((dayName, idx) => (
            <button
              key={dayName}
              type="button"
              onClick={() => onSelectDay(idx)}
              className="w-full py-3.5 bg-slate-200/80 hover:bg-slate-300/80 active:scale-[0.99] rounded-2xl text-sm font-extrabold text-slate-900 transition-all cursor-pointer"
            >
              {dayName}
            </button>
          ))}
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3.5 bg-white hover:bg-slate-50 rounded-2xl text-sm font-extrabold text-slate-800 transition-all cursor-pointer mt-2"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
