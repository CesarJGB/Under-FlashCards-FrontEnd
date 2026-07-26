// FILE: frontend/src/components/library/calendar/ScheduleListScreen.jsx
import { useState, useEffect, useCallback } from 'react';
import { CalendarDays, Plus, Trash2, ChevronRight } from 'lucide-react';
import ScheduleCalendar from '../ScheduleCalendar';
import ActionSheet from '../../../common/ActionSheet'; // NUEVO IMPORT

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export default function ScheduleListScreen({ userId, onBack, dashboardShell }) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedScheduleId, setSelectedScheduleId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState(null); // NUEVO ESTADO

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/schedules/${userId}`, {
        headers: { 'X-User-Id': userId },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSchedules(data);
    } catch {
      setError('No se pudieron cargar tus horarios.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) loadSchedules();
  }, [userId, loadSchedules]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({
          userId,
          name: `Horario ${schedules.length + 1}`,
        }),
      });
      if (!res.ok) throw new Error();
      const newSchedule = await res.json();
      setSchedules((prev) => [...prev, newSchedule]);
      setSelectedScheduleId(newSchedule.id);
    } catch {
      setError('No se pudo crear el horario.');
    } finally {
      setCreating(false);
    }
  };

  // NUEVA FUNCIÓN: Se llama cuando se confirma en el ActionSheet
  const confirmDelete = async () => {
    if (!scheduleToDelete) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/schedules/${scheduleToDelete}`, {
        method: 'DELETE',
        headers: { 'X-User-Id': userId },
      });
      if (!res.ok) throw new Error();
      setSchedules((prev) => prev.filter((s) => s.id !== scheduleToDelete));
    } catch {
      setError('No se pudo eliminar el horario.');
    } finally {
      setScheduleToDelete(null);
    }
  };

  if (selectedScheduleId) {
    return (
      <ScheduleCalendar
        userId={userId}
        scheduleId={selectedScheduleId}
        onBack={() => {
          setSelectedScheduleId(null);
          loadSchedules();
        }}
        dashboardShell={dashboardShell}
      />
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto pb-20 animate-[fadeIn_0.15s_ease]">
      {/* ... Header y Error sin cambios ... */}
      
      {loading ? (
        <p className="text-center text-sm text-slate-400 py-12">Cargando...</p>
      ) : schedules.length === 0 ? (
        /* ... Empty state sin cambios ... */
      ) : (
        <div className="space-y-3 px-2">
          {schedules.map((s) => (
            <div
              key={s.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedScheduleId(s.id)}
              onKeyDown={(e) => { if (e.key === 'Enter') setSelectedScheduleId(s.id); }}
              className="w-full text-left bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer flex items-center justify-between"
            >
              <div>
                <h3 className="text-base font-extrabold text-slate-900">{s.name}</h3>
                <p className="text-xs font-medium text-slate-500 mt-0.5">
                  {s.classes.length} clase{s.classes.length !== 1 ? 's' : ''} · {s.daysCount} días
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setScheduleToDelete(s.id); // ABRE EL ACTIONSHEET
                  }}
                  className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                  title="Eliminar horario"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <ChevronRight className="w-5 h-5 text-slate-300" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* NUEVO: ActionSheet para confirmación de borrado */}
      <ActionSheet
        open={Boolean(scheduleToDelete)}
        title="Eliminar horario"
        options={[
          {
            id: 'confirm',
            label: 'Eliminar horario',
            description: 'Se eliminarán todas las clases asociadas. Esta acción no se puede deshacer.',
            icon: Trash2,
            danger: true,
            onSelect: confirmDelete
          },
          {
            id: 'cancel',
            label: 'Cancelar'
          }
        ]}
        onClose={() => setScheduleToDelete(null)}
      />
    </div>
  );
}
