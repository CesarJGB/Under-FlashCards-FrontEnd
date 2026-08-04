import { useState } from 'react';
import { Clock3, MapPin, Pencil, Trash2, User, X } from 'lucide-react';
import ActionSheet from '../../../common/ActionSheet';
import { WEEKDAYS } from '../useScheduleCalendar';
import { resolveScheduleClassColor } from '../scheduleUtils';
import { mixWithWhite } from '../../../../lib/materiaColors';
import { useBodyScrollLock } from '../../../../lib/scrollLock';
import useModalAccessibility from '../../../../hooks/useModalAccessibility';

const ATTENDANCE_ITEMS = [
  { key: 'attendances', label: 'Asistencias' },
  { key: 'absences', label: 'Ausencias' },
  { key: 'tardies', label: 'Retardos' },
  { key: 'participations', label: 'Participaciones' },
];

export default function ClassDetailModal({
  selectedClass,
  subjectColors = [],
  error = '',
  onClose,
  onDelete,
  onUpdateAttendance,
  onEdit,
  updatingAttendance = false,
}) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  useBodyScrollLock(Boolean(selectedClass), 'schedule-class-detail');
  const dialogRef = useModalAccessibility({ open: !showConfirmDelete, onClose });
  if (!selectedClass) return null;

  const accent = resolveScheduleClassColor(selectedClass, subjectColors);

  return (
    <>
      <div ref={dialogRef} tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 outline-none backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Detalles de ${selectedClass.subject}`}>
        <div className="max-h-[min(760px,calc(100dvh-2rem))] w-full max-w-lg overflow-y-auto rounded-3xl bg-white text-slate-900 shadow-2xl dark:bg-slate-900 dark:text-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] dark:border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{WEEKDAYS[selectedClass.dayIndex] || 'Día'}</span>
            <button type="button" onClick={onClose} className="min-h-11 min-w-11 rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Cerrar detalles"><X className="mx-auto h-5 w-5" /></button>
          </div>

          <div className="px-5 pb-5 pt-4">
            <div className="flex items-start gap-3">
              <span className="mt-1 h-12 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: accent }} aria-hidden="true" />
              <div className="min-w-0">
                <h2 className="break-words text-2xl font-black tracking-tight">{selectedClass.subject}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1"><Clock3 className="h-4 w-4" />{selectedClass.startTime} – {selectedClass.endTime}</span>
                  {selectedClass.teacher && selectedClass.teacher !== 'Sin profesor' && <span className="inline-flex items-center gap-1"><User className="h-4 w-4" />{selectedClass.teacher}</span>}
                  {selectedClass.room && selectedClass.room !== 'Por definir' && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{selectedClass.room}</span>}
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border bg-slate-50 p-3 dark:bg-slate-950/40" style={{ borderColor: mixWithWhite(accent, 0.35) }} aria-busy={updatingAttendance}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Asistencia</h3>
                {updatingAttendance && <span className="text-[11px] font-semibold text-slate-500">Guardando…</span>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {ATTENDANCE_ITEMS.map((item) => (
                  <div key={item.key} className="rounded-xl bg-white/70 p-2.5 dark:bg-slate-950/30">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{item.label}</span>
                      <span className="text-xl font-black text-slate-900 dark:text-white">{selectedClass[item.key] || 0}</span>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button type="button" disabled={updatingAttendance} onClick={() => onUpdateAttendance(selectedClass.id, item.key, -1)} className="min-h-11 min-w-11 flex-1 rounded-xl bg-slate-100 text-lg font-bold text-slate-700 hover:bg-slate-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700" aria-label={`Restar ${item.label}`}>
                        −
                      </button>
                      <button type="button" disabled={updatingAttendance} onClick={() => onUpdateAttendance(selectedClass.id, item.key, 1)} className="min-h-11 min-w-11 flex-1 rounded-xl bg-slate-100 text-lg font-bold text-slate-700 hover:bg-slate-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700" aria-label={`Sumar ${item.label}`}>
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {error && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300" role="alert">{error}</p>}

            <div className="mt-5 flex justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button type="button" onClick={() => setShowConfirmDelete(true)} className="min-h-11 rounded-xl px-3 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"><Trash2 className="mr-1.5 inline h-4 w-4" />Eliminar</button>
              <button type="button" onClick={() => onEdit(selectedClass)} className="min-h-11 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"><Pencil className="mr-1.5 inline h-4 w-4" />Editar</button>
            </div>
          </div>
        </div>
      </div>

      <ActionSheet
        open={showConfirmDelete}
        title={`Eliminar ${selectedClass.subject}`}
        options={[
          { id: 'confirm', label: 'Eliminar clase', description: 'Esta acción no se puede deshacer.', icon: Trash2, danger: true, onSelect: () => onDelete(selectedClass.id) },
          { id: 'cancel', label: 'Cancelar' },
        ]}
        onClose={() => setShowConfirmDelete(false)}
      />
    </>
  );
}
