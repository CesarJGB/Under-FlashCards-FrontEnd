// FILE: frontend/src/components/library/calendar/ScheduleListScreen.jsx
import { useState, useEffect, useCallback } from 'react';
import { CalendarDays, Plus, Trash2, ChevronRight } from 'lucide-react';
import ScheduleCalendar from '../ScheduleCalendar';
import ActionSheet from '../../common/ActionSheet';
import { getJSON, setJSON } from '../../../lib/safeLocalStorage';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export default function ScheduleListScreen({ userId, onBack, dashboardShell }) {
  const listCacheKey = userId ? `schedules_list_${userId}` : null;

  // Carga instantánea desde cache local (0ms)
  const [schedules, setSchedules] = useState(() => (listCacheKey ? getJSON(listCacheKey) || [] : []));
  const [loading, setLoading] = useState(() => (listCacheKey ? !getJSON(listCacheKey) : true));
  const [error, setError] = useState('');
  const [selectedScheduleId, setSelectedScheduleId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState(null);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [showCreateConfirm, setShowCreateConfirm] = useState(false); // Estado para el modal de creación

  const loadSchedules = useCallback(async () => {
    if (!userId) return;

    if (!getJSON(listCacheKey)) setLoading(true);
    setError('');

    try {
      const res = await fetch(`${BACKEND_URL}/api/schedules/${userId}`, {
        headers: { 'X-User-Id': userId },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSchedules(data);
      if (listCacheKey) setJSON(listCacheKey, data);
    } catch {
      setError('No se pudieron cargar tus horarios.');
    } finally {
      setLoading(false);
    }
  }, [userId, listCacheKey]);

  useEffect(() => {
    if (userId) loadSchedules();
  }, [userId, loadSchedules]);

  const handleCreate = async () => {
    setCreating(true);
    setShowCreateConfirm(false); // Cierra el modal de confirmación de creación
    setShowSwitcher(false);      // Cierra el menú selector si estaba abierto
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

      setSchedules((prev) => {
        const next = [...prev, newSchedule];
        if (listCacheKey) setJSON(listCacheKey, next);
        return next;
      });

      setSelectedScheduleId(newSchedule.id);
    } catch {
      setError('No se pudo crear el horario.');
    } finally {
      setCreating(false);
    }
  };

  const confirmDelete = async () => {
    if (!scheduleToDelete) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/schedules/${scheduleToDelete}`, {
        method: 'DELETE',
        headers: { 'X-User-Id': userId },
      });
      if (!res.ok) throw new Error();

      setSchedules((prev) => {
        const next = prev.filter((s) => s.id !== scheduleToDelete);
        if (listCacheKey) setJSON(listCacheKey, next);
        return next;
      });
    } catch {
      setError('No se pudo eliminar el horario.');
    } finally {
      setScheduleToDelete(null);
    }
  };

  const switcherOptions = [
    {
      id: 'create-new',
      label: 'Crear nuevo horario',
      description: 'Empieza un horario desde cero',
      icon: Plus,
      onSelect: () => setShowCreateConfirm(true),
    },
    ...schedules.map((s) => ({
      id: s.id,
      label: s.name,
      description: `${s.classes?.length || 0} clase(s) · ${s.daysCount} días`,
      onSelect: () => {
        setSelectedScheduleId(s.id);
      },
    })),
  ];

  if (selectedScheduleId) {
    return (
      <>
        <ScheduleCalendar
          userId={userId}
          scheduleId={selectedScheduleId}
          onBack={() => {
            setSelectedScheduleId(null);
            loadSchedules();
          }}
          dashboardShell={dashboardShell}
          onOpenSwitcher={() => setShowSwitcher(true)}
        />

        <ActionSheet
          open={showSwitcher}
          title="Cambiar horario"
          options={switcherOptions}
          onClose={() => setShowSwitcher(false)}
        />

        <ActionSheet
          open={showCreateConfirm}
          title="Crear horario"
          options={[
            {
              id: 'confirm',
              label: 'Crear nuevo horario',
              description: 'Se añadirá un horario vacío a tu lista para que lo configures.',
              icon: Plus,
              onSelect: handleCreate,
            },
            {
              id: 'cancel',
              label: 'Cancelar',
            },
          ]}
          onClose={() => setShowCreateConfirm(false)}
        />
      </>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto pb-20 animate-[fadeIn_0.15s_ease]">
      <div className="flex items-center justify-between py-3 border-b border-slate-200/80 mb-4 px-2">
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          ← Biblioteca
        </button>
        <h2 className="text-base font-extrabold text-slate-900">Horarios</h2>
        <button
          type="button"
          onClick={() => setShowCreateConfirm(true)}
          disabled={creating}
          className="p-2 -mr-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-40"
          title="Nuevo horario"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {error && (
        <div className="mx-2 mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-xs font-medium text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-center text-sm text-slate-400 py-12">Cargando...</p>
      ) : schedules.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-200 rounded-3xl text-center min-h-[250px] mx-2">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
            <CalendarDays className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-sm font-bold text-slate-700">Sin horarios todavía</p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            Presiona el botón "+" arriba a la derecha para crear tu primer horario.
          </p>
        </div>
      ) : (
        <div className="space-y-3 px-2">
          {schedules.map((s) => (
            <div
              key={s.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedScheduleId(s.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setSelectedScheduleId(s.id);
              }}
              className="w-full text-left bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm hover:border-slate-300 hover:shadow-md transition-all cursor-pointer flex items-center justify-between"
            >
              <div>
                <h3 className="text-base font-extrabold text-slate-900">{s.name}</h3>
                <p className="text-xs font-medium text-slate-500 mt-0.5">
                  {s.classes?.length || 0} clase{(s.classes?.length || 0) !== 1 ? 's' : ''} · {s.daysCount} días
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setScheduleToDelete(s.id);
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

      {/* ActionSheet de confirmación para eliminar */}
      <ActionSheet
        open={Boolean(scheduleToDelete)}
        title="Eliminar horario"
        options={[
          {
            id: 'confirm',
            label: 'Eliminar horario',
            description:
              'Se eliminarán todas las clases asociadas. Esta acción no se puede deshacer.',
            icon: Trash2,
            danger: true,
            onSelect: confirmDelete,
          },
          {
            id: 'cancel',
            label: 'Cancelar',
          },
        ]}
        onClose={() => setScheduleToDelete(null)}
      />

      {/* ActionSheet para cambiar entre horarios de la lista */}
      <ActionSheet
        open={showSwitcher}
        title="Cambiar horario"
        options={switcherOptions}
        onClose={() => setShowSwitcher(false)}
      />

      {/* ActionSheet de confirmación para crear */}
      <ActionSheet
        open={showCreateConfirm}
        title="Crear horario"
        options={[
          {
            id: 'confirm',
            label: 'Crear nuevo horario',
            description: 'Se añadirá un horario vacío a tu lista para que lo configures.',
            icon: Plus,
            onSelect: handleCreate,
          },
          {
            id: 'cancel',
            label: 'Cancelar',
          },
        ]}
        onClose={() => setShowCreateConfirm(false)}
      />
    </div>
  );
}
