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

  // Formulario
  const [formSubject, setFormSubject] = useState('');
  const [formTeacher, setFormTeacher] = useState('');
  const [formRoom, setFormRoom] = useState('');
  const [formStartTime, setFormStartTime] = useState('08:00');
  const [formEndTime, setFormEndTime] = useState('09:30');

  // NOTA: reutilizamos el mismo GET de lista (no hay endpoint de detalle por id)
  // y buscamos el horario dentro de la respuesta. Es aceptable mientras la
  // cantidad de horarios/clases por usuario sea pequeña.
  const loadSchedule = useCallback(async () => {
    if (!userId || !scheduleId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/schedules/${userId}`, {
        headers: { 'X-User-Id': userId },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const found = data.find((s) => s.id === scheduleId);
      setSchedule(found || null);
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

  const handleSaveClass = async (e) => {
    e.preventDefault();
    if (!formSubject.trim()) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/schedules/${scheduleId}/classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({
          subject: formSubject.trim(),
          teacher: formTeacher.trim(),
          room: formRoom.trim(),
          dayIndex: selectedDayForForm,
          startTime: formStartTime,
          endTime: formEndTime,
        }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setSchedule(updated);
      setFormSubject('');
      setFormTeacher('');
      setFormRoom('');
      setFormStartTime('08:00');
      setFormEndTime('09:30');
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
    selectedDayForForm, setSelectedDayForForm,
    selectedClassDetail, setSelectedClassDetail,
    formSubject, setFormSubject,
    formTeacher, setFormTeacher,
    formRoom, setFormRoom,
    formStartTime, setFormStartTime,
    formEndTime, setFormEndTime,
    handleSaveClass,
    handleDeleteClass,
    handleUpdateAttendance,
    handleUpdateSettings,
  };
}
