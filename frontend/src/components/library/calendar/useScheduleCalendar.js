// FILE: frontend/src/components/library/calendar/useScheduleCalendar.js
import { useState, useEffect, useCallback } from 'react';
import { getJSON, setJSON, remove } from '../../../lib/safeLocalStorage';

export const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const SHORT_WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export function useScheduleCalendar(userId, scheduleId) {
  const cacheKey = scheduleId ? `schedule_${scheduleId}` : null;

  // Intentamos cargar del cache inmediatamente para sensación 0ms
  const [schedule, setSchedule] = useState(() => (cacheKey ? getJSON(cacheKey) : null));
  const [loading, setLoading] = useState(() => (cacheKey ? !getJSON(cacheKey) : true));
  const [error, setError] = useState('');

  const [activeDayIndex, setActiveDayIndex] = useState(0);

  // Modales
  const [showSettings, setShowSettings] = useState(false);
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [showClassForm, setShowClassForm] = useState(false);
  const [selectedDayForForm, setSelectedDayForForm] = useState(0);
  const [selectedClassDetail, setSelectedClassDetail] = useState(null);

  // Estado para modo edición
  const [editingClass, setEditingClass] = useState(null);

  const handleCloseClassForm = () => {
    setShowClassForm(false);
    setEditingClass(null); // Limpia edición al cerrar
  };

  const handleEditClassClick = (classItem) => {
    setSelectedClassDetail(null); // Cierra el modal de detalle
    setEditingClass(classItem);   // Guarda la clase que vamos a editar
    setSelectedDayForForm(classItem.dayIndex); // Asegura que estemos en el día correcto
    setShowClassForm(true);       // Abre el formulario
  };

  // Carga directa del horario por su ID específico con revalidación en segundo plano
  const loadSchedule = useCallback(async () => {
    if (!userId || !scheduleId) return;

    // Si no tenemos datos en cache, mostramos el loader
    if (!getJSON(cacheKey)) setLoading(true);
    setError('');

    try {
      const res = await fetch(`${BACKEND_URL}/api/schedules/by-id/${scheduleId}`, {
        headers: { 'X-User-Id': userId },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSchedule(data);
      if (cacheKey) setJSON(cacheKey, data); // Actualizamos el cache
    } catch {
      setError('No se pudo cargar el horario.');
    } finally {
      setLoading(false);
    }
  }, [userId, scheduleId, cacheKey]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  // Si la clase seleccionada desaparece (borrada desde otro lado), cerramos el detalle
  useEffect(() => {
    if (selectedClassDetail && schedule) {
      const stillExists = schedule.classes.some((c) => c.id === selectedClassDetail.id);
      if (!stillExists) setSelectedClassDetail(null);
    }
  }, [schedule, selectedClassDetail]);

  const handleSaveClass = async (formData, editingClassId = null) => {
    // 1. VALIDACIÓN DE CHOQUE DE HORARIOS
    const hasConflict = schedule?.classes.some((c) => {
      if (c.id === editingClassId) return false;
      if (c.dayIndex !== selectedDayForForm) return false;
      return formData.startTime < c.endTime && formData.endTime > c.startTime;
    });

    if (hasConflict) {
      setError('Error: Esta clase se superpone con otra ya existente en este día.');
      return;
    }

    setError('');

    // 2. PETICIÓN A LA API
    try {
      let res;
      if (editingClassId) {
        res = await fetch(`${BACKEND_URL}/api/schedules/${scheduleId}/classes/${editingClassId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
          body: JSON.stringify(formData),
        });
      } else {
        res = await fetch(`${BACKEND_URL}/api/schedules/${scheduleId}/classes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
          body: JSON.stringify({
            ...formData,
            dayIndex: selectedDayForForm,
          }),
        });
      }

      if (!res.ok) throw new Error();

      const updated = await res.json();
      setSchedule(updated);
      if (cacheKey) setJSON(cacheKey, updated); // Sincronizamos cache

      if (!editingClassId) {
        setActiveDayIndex(selectedDayForForm);
      }

      setShowClassForm(false);
      setEditingClass(null);
    } catch {
      setError('No se pudo guardar la clase.');
    }
  };

  const handleDeleteClass = async (classId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/schedules/${scheduleId}/classes/${classId}`, {
        method: 'DELETE',
        headers: { 'X-User-Id': userId },
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setSchedule(updated);
      if (cacheKey) setJSON(cacheKey, updated); // Sincronizamos cache
      setSelectedClassDetail(null);
    } catch {
      setError('No se pudo eliminar la clase.');
    }
  };

  const handleUpdateAttendance = async (classId, field, delta) => {
    let nextVal = 0;
    let prevScheduleSnapshot = schedule;
    let updatedScheduleSnapshot = null;

    // Actualización funcional para evitar race conditions
    setSchedule((prev) => {
      if (!prev) return prev;
      prevScheduleSnapshot = prev;
      const target = prev.classes.find((c) => c.id === classId);
      if (!target) return prev;

      nextVal = Math.max(0, (target[field] || 0) + delta);
      if (target[field] === nextVal) return prev;

      const optimisticClasses = prev.classes.map((c) =>
        c.id === classId ? { ...c, [field]: nextVal } : c
      );
      updatedScheduleSnapshot = { ...prev, classes: optimisticClasses };
      return updatedScheduleSnapshot;
    });

    if (updatedScheduleSnapshot && cacheKey) {
      setJSON(cacheKey, updatedScheduleSnapshot);
    }

    setSelectedClassDetail((prevDetail) => {
      if (prevDetail?.id === classId) {
        return { ...prevDetail, [field]: nextVal };
      }
      return prevDetail;
    });

    try {
      const res = await fetch(`${BACKEND_URL}/api/schedules/${scheduleId}/classes/${classId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({ [field]: nextVal }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setError('No se pudo actualizar la asistencia. Revisa tu conexión.');
      // Rollback del estado y cache
      setSchedule(prevScheduleSnapshot);
      if (cacheKey && prevScheduleSnapshot) setJSON(cacheKey, prevScheduleSnapshot);

      setSelectedClassDetail((prevDetail) => {
        if (prevDetail?.id === classId) {
          const target = prevScheduleSnapshot?.classes.find((c) => c.id === classId);
          return target ? { ...prevDetail, [field]: target[field] } : prevDetail;
        }
        return prevDetail;
      });
    }
  };

  const handleUpdateSettings = async ({ name, daysCount }) => {
    const prevSchedule = schedule;

    // Actualización optimista inmediata en UI y Cache
    const nextSchedule = schedule ? { ...schedule, name, daysCount } : null;
    setSchedule(nextSchedule);
    if (cacheKey && nextSchedule) setJSON(cacheKey, nextSchedule);

    if (activeDayIndex >= daysCount) {
      setActiveDayIndex(0);
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/schedules/${scheduleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({ name, daysCount }),
      });
      if (!res.ok) throw new Error();

      const updated = await res.json();
      setSchedule(updated);
      if (cacheKey) setJSON(cacheKey, updated);
    } catch {
      setError('No se pudieron guardar los ajustes. Revisa tu conexión.');
      // Rollback
      setSchedule(prevSchedule);
      if (cacheKey && prevSchedule) setJSON(cacheKey, prevSchedule);
    }
  };

  const currentDayClasses = (schedule?.classes || [])
    .filter((c) => c.dayIndex === activeDayIndex)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  return {
    loading,
    error,
    scheduleName: schedule?.name || '',
    daysCount: schedule?.daysCount || 5,
    classes: schedule?.classes || [],
    activeDayIndex,
    setActiveDayIndex,
    currentDayClasses,
    showSettings,
    setShowSettings,
    showDayPicker,
    setShowDayPicker,
    showClassForm,
    setShowClassForm,
    handleCloseClassForm,
    selectedDayForForm,
    setSelectedDayForForm,
    selectedClassDetail,
    setSelectedClassDetail,
    editingClass,
    handleEditClassClick,
    handleSaveClass,
    handleDeleteClass,
    handleUpdateAttendance,
    handleUpdateSettings,
  };
}
