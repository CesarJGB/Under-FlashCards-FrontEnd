// FILE: frontend/src/components/library/calendar/ScheduleListScreen.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Plus, Trash2, MoreHorizontal, ArrowLeft } from 'lucide-react';
import ScheduleCalendar from '../ScheduleCalendar';
import ActionSheet from '../../common/ActionSheet';
import { getJSON, setJSON } from '../../../lib/safeLocalStorage';
import { normalizeScheduleListAttendance } from './attendanceUtils';
import { getScheduleErrorMessage, getScheduleListCacheKey, removeScheduleCaches, requestSchedule } from './scheduleApi';


// =======================================================================
// SUBCOMPONENTE: Tarjeta de Horario Individual (con su propio ActionSheet)
// =======================================================================
function ScheduleItemCard({ schedule, onSelect, onDelete, deleting = false }) {
  const [showMenu, setShowMenu] = useState(false);
  const classCount = schedule.classes?.length || 0;

  const handleSelect = () => onSelect(schedule.id);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelect();
    }
  };

  return (
    <>
      <article
        tabIndex={0}
        aria-label={`Abrir ${schedule.name}`}
        onClick={handleSelect}
        onKeyDown={handleKeyDown}
        className="group relative w-full text-left bg-white dark:bg-slate-800/50 dark:backdrop-blur-sm border border-slate-200/80 dark:border-white/10 rounded-3xl p-5 shadow-sm hover:shadow-xl hover:border-slate-300 dark:hover:border-white/20 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer flex items-center gap-4 overflow-hidden"
      >
        {/* Overlay sutil al hacer hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/40 to-transparent dark:from-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-3xl"></div>

        {/* Botón de 3 puntos (Arriba a la derecha) */}
        <div 
          className="absolute top-3 right-3 z-30"
          onClick={(e) => e.stopPropagation()} // Evitar que abra el horario al clickar el botón
        >
          <button
            type="button"
            onClick={() => setShowMenu(true)}
            disabled={deleting}
            className="min-h-11 min-w-11 rounded-xl p-2 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40 dark:text-slate-500 dark:hover:bg-slate-700/50 dark:hover:text-slate-200"
            aria-label="Más acciones"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>

        {/* Icono Decorativo */}
        <div className="relative w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-white/5 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-500/10 group-hover:border-indigo-100 dark:group-hover:border-indigo-500/20 transition-colors">
          <CalendarDays className="w-6 h-6 text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors" />
        </div>

        {/* Contenido Textual (pr-12 para no chocar con el botón de 3 puntos) */}
        <div className="relative flex-1 min-w-0 pr-12">
          <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">{schedule.name}</h3>
          <div className="flex items-center gap-2 mt-2">
            <span className="inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300">
              {classCount} {classCount !== 1 ? 'clases' : 'clase'}
            </span>
            <span className="inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300">
              {schedule.daysCount} días
            </span>
          </div>
        </div>
      </article>

      {/* ActionSheet local para esta tarjeta específica */}
      <ActionSheet
        open={showMenu}
        title={schedule.name}
        options={[
          {
            id: 'delete',
            label: 'Eliminar horario',
            description: 'Se eliminarán todas las clases asociadas. Esta acción no se puede deshacer.',
            icon: Trash2,
            danger: true,
            onSelect: () => {
              setShowMenu(false);
              onDelete(schedule.id);
            },
          },
          {
            id: 'cancel',
            label: 'Cancelar',
          },
        ]}
        onClose={() => setShowMenu(false)}
        compact
      />
    </>
  );
}

// =======================================================================
// COMPONENTE PRINCIPAL
// =======================================================================
export default function ScheduleListScreen({ userId, onBack, dashboardShell }) {
  const listCacheKey = getScheduleListCacheKey(userId);
  const initialListCache = listCacheKey ? normalizeScheduleListAttendance(getJSON(listCacheKey)) : null;

  const cachedSchedules = Array.isArray(initialListCache) ? initialListCache : [];
  const [schedules, setSchedules] = useState(() => cachedSchedules);
  const [loading, setLoading] = useState(() => Boolean(userId && !initialListCache));
  const [error, setError] = useState('');
  const [selectedScheduleId, setSelectedScheduleId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [showCreateConfirm, setShowCreateConfirm] = useState(false);
  const [deletingScheduleId, setDeletingScheduleId] = useState(null);
  const loadControllerRef = useRef(null);
  const mountedRef = useRef(true);

  const loadSchedules = useCallback(async () => {
    if (!userId || !listCacheKey) {
      setLoading(false);
      return null;
    }

    loadControllerRef.current?.abort();
    const controller = new AbortController();
    loadControllerRef.current = controller;
    if (!Array.isArray(getJSON(listCacheKey))) setLoading(true);
    setError('');

    try {
      const data = await requestSchedule(`/api/schedules/${userId}`, {
        headers: { 'X-User-Id': userId },
        signal: controller.signal,
      });
      if (!Array.isArray(data)) throw new Error('La respuesta de horarios no es válida.');
      if (!mountedRef.current) return data;
      setSchedules(data);
      if (listCacheKey) setJSON(listCacheKey, data);
      return data;
    } catch (loadError) {
      if (loadError?.name !== 'AbortError' && mountedRef.current) {
        const message = getScheduleErrorMessage(loadError, 'No se pudieron actualizar tus horarios.');
        setError(Array.isArray(getJSON(listCacheKey)) ? `${message} Se muestra la última copia guardada.` : message);
      }
      return null;
    } finally {
      if (mountedRef.current) setLoading(false);
      if (loadControllerRef.current === controller) loadControllerRef.current = null;
    }
  }, [listCacheKey, loadControllerRef, userId]);

  useEffect(() => {
    mountedRef.current = true;
    if (userId) loadSchedules();
    return () => {
      mountedRef.current = false;
      loadControllerRef.current?.abort();
    };
  }, [userId, loadSchedules]);

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    setShowCreateConfirm(false);
    setShowSwitcher(false);
    try {
      const newSchedule = await requestSchedule('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({
          userId,
          name: `Horario ${schedules.length + 1}`,
        }),
      });
      setSchedules((prev) => {
        const next = [...prev, newSchedule];
        if (listCacheKey) setJSON(listCacheKey, next);
        return next;
      });

      setSelectedScheduleId(newSchedule.id);
    } catch (createError) {
      setError(getScheduleErrorMessage(createError, 'No se pudo crear el horario.'));
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    if (deletingScheduleId) return;
    setDeletingScheduleId(scheduleId);
    try {
      await requestSchedule(`/api/schedules/${scheduleId}`, {
        method: 'DELETE',
        headers: { 'X-User-Id': userId },
      });
      removeScheduleCaches(userId, scheduleId);

      setSchedules((prev) => {
        const next = prev.filter((s) => s.id !== scheduleId);
        if (listCacheKey) setJSON(listCacheKey, next);
        return next;
      });
    } catch (deleteError) {
      setError(getScheduleErrorMessage(deleteError, 'No se pudo eliminar el horario.'));
    } finally {
      setDeletingScheduleId(null);
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

  // Elemento del FAB flotante (Se mantiene intacto)
  const fabButton = (
    <button
      type="button"
      onClick={() => setShowCreateConfirm(true)}
      disabled={creating}
      aria-label="Crear nuevo horario"
      className="absolute right-6 w-14 h-14 rounded-[1.3rem] md:fixed flex items-center justify-center z-50 cursor-pointer disabled:opacity-40
      bg-white/10 dark:bg-white/5
      backdrop-blur-[3px] backdrop-saturate-100
      border border-white/50 dark:border-white/25
      ring-1 ring-inset ring-white/30 dark:ring-white/10
      shadow-[0_10px_30px_-6px_rgba(0,0,0,0.35),0_4px_10px_-2px_rgba(0,0,0,0.15),inset_0_1.5px_0.5px_0_rgba(255,255,255,0.9),inset_0_-1.5px_1px_-0.5px_rgba(0,0,0,0.18),inset_1px_0_1px_-0.5px_rgba(255,255,255,0.4),inset_-1px_0_1px_-0.5px_rgba(0,0,0,0.12)]
      hover:bg-white/15 dark:hover:bg-white/10 hover:scale-105 active:scale-95 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
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
          key={selectedScheduleId}
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
          selectedId={selectedScheduleId}
          onClose={() => setShowSwitcher(false)}
          compact
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
          compact
        />
      </>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto pb-24 animate-[fadeIn_0.2s_ease]">
      {/* Header con Grid para centrado perfecto absoluto */}
      <header className="grid grid-cols-3 items-center mb-6 px-2 pt-4">
        {/* Columna Izquierda: Botón */}
        <div className="justify-self-start">
          <button
            type="button"
            onClick={onBack}
            className="h-9 w-9 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-95 transition-all cursor-pointer shadow-3xs"
            title="Volver"
            aria-label="Volver a General"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
        
        {/* Columna Central: Título centrado forzado */}
        <h2 className="justify-self-center text-xl font-black tracking-tight text-slate-900 dark:text-white">Horarios</h2>
        
        {/* Columna Derecha: Espaciador invisible para equilibrar */}
        <div className="justify-self-end w-9" /> {/* w-9 simula el peso del botón izquierdo */}
      </header>

      {/* Estado de Error Mejorado */}
      {error && (
        <div className="mx-2 mb-4 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400" role="alert">
          <span className="min-w-0 flex-1">{error}</span>
          <button type="button" onClick={() => void loadSchedules()} className="min-h-11 shrink-0 rounded-xl px-2 font-bold underline underline-offset-2 hover:bg-red-100 dark:hover:bg-red-500/20">Reintentar</button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-3 px-2 mt-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800/50 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : schedules.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700/50 rounded-[2rem] text-center min-h-[300px] mx-2 mt-4">
          <div className="w-20 h-20 rounded-3xl bg-white dark:bg-slate-800 flex items-center justify-center mb-5 shadow-sm border border-slate-100 dark:border-slate-700">
            <CalendarDays className="w-10 h-10 text-slate-300 dark:text-slate-600" strokeWidth={1.5} />
          </div>
          <p className="text-base font-bold text-slate-800 dark:text-white">Sin horarios todavía</p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1.5 max-w-xs leading-relaxed">
            Toca el botón <span className="font-bold text-indigo-500">+</span> para crear tu primer horario y organizar tus clases.
          </p>
        </div>
      ) : (
        /* Lista de Horarios */
        <div className="space-y-4 px-2">
          {schedules.map((s) => (
            <ScheduleItemCard 
              key={s.id} 
              schedule={s} 
              onSelect={setSelectedScheduleId} 
              onDelete={handleDeleteSchedule}
              deleting={deletingScheduleId === s.id}
            />
          ))}
        </div>
      )}

      {/* FAB Flotante */}
      {fab}

      {/* ActionSheet para cambiar entre horarios de la lista */}
      <ActionSheet
        open={showSwitcher}
        title="Cambiar horario"
        options={switcherOptions}
        onClose={() => setShowSwitcher(false)}
        compact
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
        compact
      />
    </div>
  );
}
