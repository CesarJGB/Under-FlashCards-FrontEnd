// FILE: frontend/src/components/library/calendar/modals/ClassDetailModal.jsx
import { useState } from 'react';
import { X, Trash2 } from 'lucide-react'; // Remove ChevronDown
import { WEEKDAYS } from '../useScheduleCalendar';
import ActionSheet from '../../../common/ActionSheet';

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
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center animate-[fadeIn_0.15s_ease]">
        <div className="w-full max-w-lg bg-white text-slate-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
          
          {/* Top subtle drag indicator (keeping a visual cue) */}
          <div className="pt-3 pb-2 flex justify-center">
            <div className="w-12 h-1 bg-slate-200 rounded-full" />
          </div>

          <div className="p-6 relative text-center">
            {/* Close button moved to top-right */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Centered header content */}
            <div className="pt-2">
              <span className="text-xl font-bold text-slate-900">
                {WEEKDAYS[selectedClass.dayIndex]}
              </span>
              {/* Refined time pill */}
              <div className="mt-1 inline-block bg-slate-100 px-3 py-1 rounded-full text-sm font-medium text-slate-600">
                {selectedClass.startTime} - {selectedClass.endTime}
              </div>
            </div>

            {/* Main centered details, removing uppercase labels */}
            <div className="space-y-3 mt-6">
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

          {/* Integrated attendance section on light background */}
          <div className="bg-white text-slate-900 p-6 flex-1 space-y-6">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
              Registro de asistencia
            </h4>

            {/* 4-column centered grid for attendance */}
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
                  <div className="flex gap-2 mt-2">
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
                </div>
              ))}
            </div>

            {/* Footer actions on light background */}
            <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
              <button
                type="button"
                onClick={handleDeleteClick}
                className="px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar
              </button>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onEdit(selectedClass)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl cursor-pointer transition-colors"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-lg shadow-violet-500/30"
                >
                  Listo
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ActionSheet de confirmación de eliminación */}
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
