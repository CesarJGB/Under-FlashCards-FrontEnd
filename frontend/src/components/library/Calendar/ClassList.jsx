// FILE: frontend/src/components/library/calendar/ClassList.jsx
import { Clock, User, MapPin, ChevronRight, BookOpen } from 'lucide-react';

export default function ClassList({ currentDayClasses, onSelectClass }) {
  if (currentDayClasses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-200 rounded-3xl text-center min-h-[250px]">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
          <BookOpen className="w-6 h-6 text-slate-400" />
        </div>
        <p className="text-sm font-bold text-slate-700">Sin clases agregadas</p>
        <p className="text-xs text-slate-400 mt-1 max-w-xs">
          Presiona el botón "+" abajo a la derecha para añadir una asignatura a tu horario.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 min-h-[250px]">
      {currentDayClasses.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelectClass(item)}
          className="w-full text-left bg-white border border-slate-200/90 rounded-2xl p-4 shadow-3xs hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer flex items-center justify-between"
        >
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-100 text-[11px] font-bold text-slate-700">
              <Clock className="w-3 h-3 text-slate-400" />
              {item.startTime} - {item.endTime}
            </div>
            <h3 className="text-base font-extrabold text-slate-900">{item.subject}</h3>
            <div className="flex items-center gap-3 text-xs font-medium text-slate-500">
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                {item.teacher}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {item.room}
              </span>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300" />
        </button>
      ))}
    </div>
  );
}
