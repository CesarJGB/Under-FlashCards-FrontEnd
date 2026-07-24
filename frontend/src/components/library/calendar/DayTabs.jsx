// FILE: frontend/src/components/library/calendar/DayTabs.jsx
import { SHORT_WEEKDAYS } from './useScheduleCalendar';

export default function DayTabs({ daysCount, activeDayIndex, setActiveDayIndex, classes }) {
  return (
    <div className="flex items-center justify-between bg-slate-100/80 p-1 rounded-2xl mb-6">
      {SHORT_WEEKDAYS.slice(0, daysCount).map((dayName, idx) => {
        const isActive = activeDayIndex === idx;
        const hasClasses = classes.some((c) => c.dayIndex === idx);

        return (
          <button
            key={dayName}
            type="button"
            onClick={() => setActiveDayIndex(idx)}
            className={`relative flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              isActive
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>{dayName}</span>
            {hasClasses && (
              <span
                className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${
                  isActive ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
