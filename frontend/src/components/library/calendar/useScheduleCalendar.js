// FILE: frontend/src/components/library/calendar/useScheduleCalendar.js
import { useState, useEffect, useCallback } from 'react';

export const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const SHORT_WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export function useScheduleCalendar(userId, scheduleId) {
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeDayIndex, setActiveDayIndex] = useState(0);

  // Modales
  const [showSettings, setShowSettings] = useState(false);
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [showClassForm, setShowClassForm] = useState(false);
  const [selectedDayForForm, setSelectedDayForForm] = useState(0);
  const [selectedClassDetail, setSelectedClassDetail] = useState(null);

  const handleCloseClassForm = () => {
    setShowClassForm(false);
  };

  // Carga directa del horario por su ID específico
  const loadSchedule = useCallback(async () => {
    if (!userId || !scheduleId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/schedules/by-id/${scheduleId}`, {
        headers: { 'X-User-Id': userId },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSchedule(data);
    } catch {
      setError('No se pudo cargar el horario.');
    } finally {
      setLoading(false);
    }
  }, [userId, scheduleId]);

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

  const handleSaveClass = async (formData) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/schedules/${scheduleId}/classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({
          ...formData,
          dayIndex: selectedDayForForm,
        }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setSchedule(updated);
      setActiveDayIndex(selectedDayForForm); // salta al día donde se acaba de crear la clase
      setShowClassForm(false);
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
      setSelectedClassDetail(null);
    } catch {
      setError('No se pudo eliminar la clase.');
    }
  };

  const handleUpdateAttendance = async (classId, field, delta) => {
    const target = schedule?.classes.find((c) => c.id === classId);
    if (!target) return;
    const nextVal = Math.max(0, (target[field] || 0) + delta);

    try {
      const res = await fetch(`${BACKEND_URL}/api/schedules/${scheduleId}/classes/${classId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({ [field]: nextVal }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setSchedule(updated);
      const refreshed = updated.classes.find((c) => c.id === classId);
      if (selectedClassDetail?.id === classId && refreshed) {
        setSelectedClassDetail(refreshed);
      }
    } catch {
      setError('No se pudo actualizar la asistencia.');
    }
  };

  const handleUpdateSettings = async ({ name, daysCount }) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/schedules/${scheduleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({ name, daysCount }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setSchedule(updated);

      // Ajuste de índice fuera de rango al reducir los días
      if (activeDayIndex >= updated.daysCount) {
        setActiveDayIndex(0);
      }
    } catch {
      setError('No se pudieron guardar los ajustes.');
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
    activeDayIndex, setActiveDayIndex,
    currentDayClasses,
    showSettings, setShowSettings,
    showDayPicker, setShowDayPicker,
    showClassForm, setShowClassForm,
    handleCloseClassForm,
    selectedDayForForm, setSelectedDayForForm,
    selectedClassDetail, setSelectedClassDetail,
    handleSaveClass,
    handleDeleteClass,
    handleUpdateAttendance,
    handleUpdateSettings,
  };
}
