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

  const handleSaveClass = async (formData, editingClassId = null) => {
    // 1. VALIDACIÓN DE CHOQUE DE HORARIOS
    const hasConflict = schedule?.classes.some((c) => {
      // Ignorar la clase actual si se está editando
      if (c.id === editingClassId) return false;

      // Solo importa comparar con clases del mismo día
      if (c.dayIndex !== selectedDayForForm) return false;

      // Lógica de superposición de intervalos: (StartA < EndB) && (EndA > StartB)
      const isOverlap = formData.startTime < c.endTime && formData.endTime > c.startTime;

      return isOverlap;
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
        // MODO EDICIÓN: Petición PUT
        res = await fetch(`${BACKEND_URL}/api/schedules/${scheduleId}/classes/${editingClassId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
          body: JSON.stringify(formData),
        });
      } else {
        // MODO CREACIÓN: Petición POST
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

      if (!editingClassId) {
        setActiveDayIndex(selectedDayForForm); // Saltar al día solo si es nueva
      }

      setShowClassForm(false);
      setEditingClass(null); // Limpia el modo edición
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
    let nextVal = 0;
    let prevScheduleSnapshot = schedule;

    // Usamos actualización funcional para evitar race conditions si el usuario hace clic muy rápido
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
      return { ...prev, classes: optimisticClasses };
    });

    // Actualizamos el modal de detalle de forma funcional también
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
      // Rollback a la versión exacta de antes del fallo
      setSchedule(prevScheduleSnapshot);
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
    // 1. Guardamos el estado previo por si falla
    const prevSchedule = schedule;

    // 2. Actualización optimista inmediata en la UI
    setSchedule({ ...schedule, name, daysCount });
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

      // Si todo sale bien, sincronizamos con la respuesta del servidor
      const updated = await res.json();
      setSchedule(updated);
    } catch {
      // 3. Si falla, mostramos error y revertimos la UI
      setError('No se pudieron guardar los ajustes. Revisa tu conexión.');
      setSchedule(prevSchedule); // Rollback
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
