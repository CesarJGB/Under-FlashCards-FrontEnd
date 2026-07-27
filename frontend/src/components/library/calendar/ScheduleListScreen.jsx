// FILE: frontend/src/components/library/calendar/ScheduleListScreen.jsx
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  const [showCreateConfirm, setShowCreateConfirm] = useState(false);

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
    setShowCreateConfirm(false);
    setShowSwitcher(false);
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

  // Elemento del FAB flotante
  const fabButton = (
    <button
      type="button"
      onClick={() => setShowCreateConfirm(true)}
      disabled={creating}
      aria-label="Crear nuevo horario"
      className="absolute right-6 w-14 h-14 rounded-[1.3rem] md:fixed flex items-center justify-center z-50 cursor-pointer disabled:opacity-40
      /* Liquid Glass Base */
      bg-white/10 dark:bg-white/5
      backdrop-blur-[3px] backdrop-saturate-100
      border border-white/50 dark:border-white/25
      ring-1 ring-inset ring-white/30 dark:ring-white/10
      shadow-[0_10px_30px_-6px_rgba(0,0,0,0.35),0_4px_10px_-2px_rgba(0,0,0,0.15),inset_0_1.5px_0.5px_0_rgba(255,255,255,0.9),inset_0_-1.5px_1px_-0.5px_rgba(0,0,0,0.18),inset_1px_0_1px_-0.5px_rgba(255,255,255,0.4),inset_-1px_0_1px_-0.5px_rgba(0,0,0,0.12)]
      hover:bg-white/15 dark:hover:bg-white/10 hover:scale-105 active:scale-95 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
      /* Destellos de bisel */
      before:absolute before:inset-0 before:rounded-[1.3rem] before:pointer-events-none before:bg-[radial-gradient(80%_60%_at_50%_-5%,rgba(255,255,255,0.45)_0%,rgba(255,255,255,0.08)_35%,transparent_70%)] before:opacity-90
      after:absolute after:inset-[1px] after:rounded-[1.2rem] after:pointer-events-none after:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)] after:mix-blend-overlay"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 6rem)' }}
    >
      <Plus className="relative w-7 h-7 stroke-[3] text-slate-800 dark:text-white drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)] dark:drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
    </button>
  );

  const fab = dashboardShell ? createPortal(fabButton, dashboardShell) : fabButton;

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

        {/* ActionSheet selector resalta el horario activo con selectedId */}
        <ActionSheet
          open={showSwitcher}
          title="Cambiar horario"
          options={switcherOptions}
          selectedId={selectedScheduleId}
          onClose={() => setShowSwitcher(false)}
        />

        {/* ActionSheet de confirmación para crear desde el visor */}
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
        <div className="w-16" /> {/* Espaciador óptico para mantener centrado el título */}
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
            Presiona el botón "+" para crear tu primer horario.
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

      {/* FAB Flotante */}
      {fab}

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
