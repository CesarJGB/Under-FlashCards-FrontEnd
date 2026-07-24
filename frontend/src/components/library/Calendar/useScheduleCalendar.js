// FILE: frontend/src/components/library/calendar/useScheduleCalendar.js
import { useState, useEffect } from 'react';

export const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const SHORT_WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function useScheduleCalendar() {
  const [scheduleName, setScheduleName] = useState(() => {
    return localStorage.getItem('schedule_name') || 'Horario Principal';
  });
  const [daysCount, setDaysCount] = useState(() => {
    return parseInt(localStorage.getItem('schedule_days') || '5', 10);
  });
  const [classes, setClasses] = useState(() => {
    const saved = localStorage.getItem('schedule_classes');
    return saved ? JSON.parse(saved) : [];
  });

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

  useEffect(() => {
    localStorage.setItem('schedule_name', scheduleName);
    localStorage.setItem('schedule_days', daysCount.toString());
    localStorage.setItem('schedule_classes', JSON.stringify(classes));
  }, [scheduleName, daysCount, classes]);

  const handleSaveClass = (e) => {
    e.preventDefault();
    if (!formSubject.trim()) return;

    const newClass = {
      id: Date.now().toString(),
      dayIndex: selectedDayForForm,
      subject: formSubject.trim(),
      teacher: formTeacher.trim() || 'Sin profesor',
      room: formRoom.trim() || 'Por definir',
      startTime: formStartTime,
      endTime: formEndTime,
      attendances: 0,
      absences: 0,
      partialAttendances: 0,
      canceledClasses: 0,
    };

    setClasses((prev) => [...prev, newClass]);
    setFormSubject('');
    setFormTeacher('');
    setFormRoom('');
    setFormStartTime('08:00');
    setFormEndTime('09:30');
    setShowClassForm(false);
  };

  const handleDeleteClass = (id) => {
    setClasses((prev) => prev.filter((c) => c.id !== id));
    setSelectedClassDetail(null);
  };

  const handleUpdateAttendance = (classId, field, delta) => {
    setClasses((prev) =>
      prev.map((item) => {
        if (item.id === classId) {
          const currentVal = item[field] || 0;
          const nextVal = Math.max(0, currentVal + delta);
          const updated = { ...item, [field]: nextVal };
          if (selectedClassDetail?.id === classId) {
            setSelectedClassDetail(updated);
          }
          return updated;
        }
        return item;
      })
    );
  };

  const currentDayClasses = classes
    .filter((c) => c.dayIndex === activeDayIndex)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  return {
    scheduleName, setScheduleName,
    daysCount, setDaysCount,
    classes,
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
    handleUpdateAttendance
  };
}
