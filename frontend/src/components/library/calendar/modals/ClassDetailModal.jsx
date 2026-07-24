// FILE: frontend/src/components/library/calendar/modals/ClassDetailModal.jsx
import { X, Trash2 } from 'lucide-react';
import { WEEKDAYS } from '../useScheduleCalendar';

export default function ClassDetailModal({ selectedClass, onClose, onDelete, onUpdateAttendance }) {
  if (!selectedClass) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end justify-center animate-[fadeIn_0.15s_ease]">
      <div className="w-full max-w-lg bg-slate-900 text-white rounded-t-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header Oscuro */}
        <div className="p-6 pb-8 space-y-6 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 left-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="text-center pt-2">
            <span className="text-sm font-bold text-slate-300">
              {WEEKDAYS[selectedClass.dayIndex]} ▼
            </span>
            <div className="mt-1 inline-block bg-slate-800/80 px-3 py-1 rounded-full text-xs font-extrabold tracking-wider">
              {selectedClass.startTime} - {selectedClass.endTime}
            </div>
          </div>

          <div className="space-y-4 px-2">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Asignatura
              </p>
              <p className="text-3xl font-black tracking-tight mt-0.5">
                {selectedClass.subject}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Profesor
              </p>
              <p className="text-xl font-bold text-slate-200 mt-0.5">
                {selectedClass.teacher}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Aula
              </p>
              <p className="text-xl font-bold text-slate-200 mt-0.5">
                {selectedClass.room}
              </p>
            </div>
          </div>
        </div>

        {/* Hoja Inferior Blanca con Registro de Asistencias */}
        <div className="bg-white text-slate-900 rounded-t-3xl p-6 flex-1 space-y-6">
          <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto" />

          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
            Registro de asistencia
          </h4>

          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { key: 'attendances', label: 'Asistencias' },
              { key: 'absences', label: 'Ausencias' },
              { key: 'partialAttendances', label: 'Asistencias parciales' },
              { key: 'canceledClasses', label: 'Clase anulada' },
            ].map((item) => (
              <div key={item.key} className="flex flex-col items-center gap-1.5">
                <div className="w-14 h-14 rounded-full border border-slate-200 flex items-center justify-center text-lg font-bold text-slate-800 bg-slate-50">
                  {selectedClass[item.key] || 0}
                </div>
                <span className="text-[10px] font-medium text-slate-500 leading-tight">
                  {item.label}
                </span>
                <div className="flex gap-1 mt-1">
                  <button
                    type="button"
                    onClick={() => onUpdateAttendance(selectedClass.id, item.key, -1)}
                    className="w-5 h-5 rounded-md bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 text-xs font-bold cursor-pointer"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateAttendance(selectedClass.id, item.key, 1)}
                    className="w-5 h-5 rounded-md bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 text-xs font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
            <button
              type="button"
              onClick={() => onDelete(selectedClass.id)}
              className="px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl cursor-pointer"
            >
              Listo
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
