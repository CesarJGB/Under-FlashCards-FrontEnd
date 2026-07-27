// FILE: frontend/src/components/library/calendar/modals/ClassDetailModal.jsx
import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { WEEKDAYS } from '../useScheduleCalendar';
import ActionSheet from '../../../common/ActionSheet';

const ATTENDANCE_ITEMS = [
  { key: 'attendances', label: 'Asistencias' },
  { key: 'absences', label: 'Ausencias' },
  { key: 'partialAttendances', label: 'Asistencias parciales' },
  { key: 'canceledClasses', label: 'Clase anulada' },
];

export default function ClassDetailModal({
  selectedClass,
  onClose,
  onDelete,
  onUpdateAttendance,
  onEdit
}) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  if (!selectedClass) return null;

  const handleDeleteClick = () => {
    setShowConfirmDelete(true);
  };

  const confirmDelete = () => {
    onDelete(selectedClass.id);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-[fadeIn_0.15s_ease]">
        <div className="w-full max-w-lg bg-white text-slate-900 rounded-3xl overflow-x-hidden overflow-y-auto shadow-2xl flex flex-col max-h-[85vh]">

          {/* Top subtle drag indicator */}
          <div className="pt-3 pb-1 flex justify-center shrink-0">
            <div className="w-12 h-1 bg-slate-200 rounded-full" />
          </div>

          <div className="px-6 pt-4 pb-5 relative text-center shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="absolute top-3 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>

            <div>
              <span className="text-xl font-bold text-slate-900">
                {WEEKDAYS[selectedClass.dayIndex]}
              </span>
              <div className="mt-1 inline-block bg-slate-100 px-3 py-1 rounded-full text-sm font-medium text-slate-600">
                {selectedClass.startTime} - {selectedClass.endTime}
              </div>
            </div>

            <div className="space-y-2 mt-5">
              <p className="text-3xl font-black tracking-tight text-slate-900">
                {selectedClass.subject}
              </p>
              <p className="text-lg font-medium text-slate-700">
                Profesor: {selectedClass.teacher}
              </p>
              <p className="text-lg font-medium text-slate-700">
                Aula: {selectedClass.room}
              </p>
            </div>
          </div>

          {/* Attendance section — sized to content, no forced stretch */}
          <div className="bg-white text-slate-900 px-6 pt-5 pb-6 space-y-5">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
              Registro de asistencia
            </h4>

            {/* 3 grids apilados: círculos / labels / botones.
                Cada fila reparte su propia altura entre columnas,
                así un label de 2 líneas no descentra a los demás. */}
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-2">
                {ATTENDANCE_ITEMS.map((item) => (
                  <div key={item.key} className="flex justify-center">
                    <div className="w-14 h-14 rounded-full border border-slate-200 flex items-center justify-center text-lg font-bold text-slate-800 bg-slate-50">
                      {selectedClass[item.key] || 0}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-4 gap-2">
                {ATTENDANCE_ITEMS.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-center text-center px-1"
                  >
                    <span className="text-[10px] font-medium text-slate-500 leading-tight">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-4 gap-2">
                {ATTENDANCE_ITEMS.map((item) => (
                  <div key={item.key} className="flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => onUpdateAttendance(selectedClass.id, item.key, -1)}
                      className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 text-base font-bold cursor-pointer transition-transform active:scale-90"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateAttendance(selectedClass.id, item.key, 1)}
                      className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 text-base font-bold cursor-pointer transition-transform active:scale-90"
                    >
                      +
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer actions */}
            <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
              <button
                type="button"
                onClick={handleDeleteClick}
                className="h-9 px-3 flex items-center gap-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar
              </button>

              <button
                type="button"
                onClick={() => onEdit(selectedClass)}
                className="h-9 px-4 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl cursor-pointer transition-colors"
              >
                Editar
              </button>
            </div>
          </div>

        </div>
      </div>

      <ActionSheet
        open={showConfirmDelete}
        title={`Eliminar ${selectedClass.subject}`}
        options={[
          {
            id: 'confirm',
            label: `Eliminar ${selectedClass.subject}`,
            description: 'Esta acción no se puede deshacer.',
            icon: Trash2,
            danger: true,
            onSelect: confirmDelete,
          },
          {
            id: 'cancel',
            label: 'Cancelar',
          },
        ]}
        onClose={() => setShowConfirmDelete(false)}
      />
    </>
  );
}
