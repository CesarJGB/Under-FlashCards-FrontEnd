import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getJSON, setJSON } from '../../../lib/safeLocalStorage';
import {
  cacheSchedule,
  getScheduleCacheKey,
  getScheduleDayCacheKey,
  getScheduleErrorMessage,
  requestSchedule,
  syncScheduleListCache,
} from './scheduleApi';
import { getInitialDayIndex, sortClassesByStart } from './scheduleUtils';

export const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const SHORT_WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function useScheduleCalendar(userId, scheduleId) {
  const cacheKey = getScheduleCacheKey(scheduleId);
  const dayCacheKey = getScheduleDayCacheKey(scheduleId);
  const initialSchedule = cacheKey ? getJSON(cacheKey) : null;
  const initialDaysCount = initialSchedule?.daysCount || 5;

  const [schedule, setSchedule] = useState(initialSchedule);
  const scheduleRef = useRef(initialSchedule);
  const [loading, setLoading] = useState(() => Boolean(scheduleId && !initialSchedule));
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [activeDayIndexState, setActiveDayIndexState] = useState(() => (
    getInitialDayIndex(initialDaysCount, dayCacheKey ? getJSON(dayCacheKey) : null)
  ));

  const [showSettings, setShowSettingsState] = useState(false);
  const [showDayPicker, setShowDayPickerState] = useState(false);
  const [showClassForm, setShowClassFormState] = useState(false);
  const [selectedDayForForm, setSelectedDayForForm] = useState(0);
  const [selectedClassDetail, setSelectedClassDetailState] = useState(null);
  const [editingClass, setEditingClass] = useState(null);
  const [savingClass, setSavingClass] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [updatingAttendance, setUpdatingAttendance] = useState(false);
  const [deletingClassId, setDeletingClassId] = useState(null);

  const mountedRef = useRef(true);
  const loadControllerRef = useRef(null);
  const savingClassRef = useRef(false);
  const savingSettingsRef = useRef(false);
  const attendanceRef = useRef(false);
  const deletingClassRef = useRef(false);
  const dayInitializedRef = useRef(Boolean(initialSchedule));

  const commitSchedule = useCallback((nextSchedule) => {
    scheduleRef.current = nextSchedule;
    if (mountedRef.current) setSchedule(nextSchedule);
    if (nextSchedule) {
      cacheSchedule(nextSchedule);
      syncScheduleListCache(userId, nextSchedule);
    }
  }, [userId]);

  const setActiveDayIndex = useCallback((nextValue) => {
    setActiveDayIndexState((previous) => {
      const candidate = typeof nextValue === 'function' ? nextValue(previous) : nextValue;
      const maximum = Math.max(0, (scheduleRef.current?.daysCount || 5) - 1);
      const next = Math.max(0, Math.min(maximum, Number(candidate) || 0));
      if (dayCacheKey) setJSON(dayCacheKey, next);
      return next;
    });
  }, [dayCacheKey]);

  const closeOtherSurfaces = useCallback((surface) => {
    if (surface !== 'settings') setShowSettingsState(false);
    if (surface !== 'day-picker') setShowDayPickerState(false);
    if (surface !== 'class-form') setShowClassFormState(false);
    if (surface !== 'detail') setSelectedClassDetailState(null);
    setError('');
    setDetailError('');
  }, []);

  const setShowSettings = useCallback((value) => {
    if (value) closeOtherSurfaces('settings');
    setShowSettingsState(Boolean(value));
  }, [closeOtherSurfaces]);

  const setShowDayPicker = useCallback((value) => {
    if (value) closeOtherSurfaces('day-picker');
    setShowDayPickerState(Boolean(value));
  }, [closeOtherSurfaces]);

  const setShowClassForm = useCallback((value) => {
    if (value) closeOtherSurfaces('class-form');
    setShowClassFormState(Boolean(value));
  }, [closeOtherSurfaces]);

  const setSelectedClassDetail = useCallback((value) => {
    if (typeof value === 'function') {
      setSelectedClassDetailState(value);
      return;
    }
    if (value) closeOtherSurfaces('detail');
    setSelectedClassDetailState(value);
  }, [closeOtherSurfaces]);

  const loadSchedule = useCallback(async () => {
    if (!userId || !scheduleId) {
      setLoading(false);
      return null;
    }

    loadControllerRef.current?.abort();
    const controller = new AbortController();
    loadControllerRef.current = controller;
    if (!scheduleRef.current) setLoading(true);
    setError('');

    try {
      const data = await requestSchedule(`/api/schedules/by-id/${scheduleId}`, {
        headers: { 'X-User-Id': userId },
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        commitSchedule(data);
        if (!dayInitializedRef.current) {
          dayInitializedRef.current = true;
          setActiveDayIndex(getInitialDayIndex(data?.daysCount || 5, dayCacheKey ? getJSON(dayCacheKey) : null));
        }
      }
      return data;
    } catch (loadError) {
      if (loadError?.name !== 'AbortError' && mountedRef.current) {
        const message = getScheduleErrorMessage(loadError, 'No se pudo cargar el horario.');
        setError(scheduleRef.current ? `${message} Se muestra la última copia guardada.` : message);
      }
      return null;
    } finally {
      if (mountedRef.current) setLoading(false);
      if (loadControllerRef.current === controller) loadControllerRef.current = null;
    }
  }, [commitSchedule, dayCacheKey, scheduleId, setActiveDayIndex, userId]);

  useEffect(() => {
    mountedRef.current = true;
    void loadSchedule();
    return () => {
      mountedRef.current = false;
      loadControllerRef.current?.abort();
    };
  }, [loadSchedule]);

  useEffect(() => {
    const daysCount = schedule?.daysCount || 5;
    if (activeDayIndexState >= daysCount) setActiveDayIndex(0);
  }, [activeDayIndexState, schedule?.daysCount, setActiveDayIndex]);

  useEffect(() => {
    if (!selectedClassDetail || !schedule) return;
    const latest = schedule.classes.find((item) => item.id === selectedClassDetail.id);
    if (!latest) setSelectedClassDetailState(null);
    else if (latest !== selectedClassDetail) setSelectedClassDetailState(latest);
  }, [schedule, selectedClassDetail]);

  const handleCloseClassForm = useCallback(() => {
    setShowClassFormState(false);
    setEditingClass(null);
  }, []);

  const handleEditClassClick = useCallback((classItem) => {
    closeOtherSurfaces('class-form');
    setEditingClass(classItem);
    setSelectedDayForForm(classItem.dayIndex);
    setShowClassFormState(true);
  }, [closeOtherSurfaces]);

  const handleSaveClass = useCallback(async (formData, editingClassId = null) => {
    if (savingClassRef.current) {
      return { ok: false, error: 'Ya se está guardando esta clase.' };
    }

    const currentSchedule = scheduleRef.current;
    const conflict = currentSchedule?.classes.find((classItem) => (
      classItem.id !== editingClassId
      && Number(classItem.dayIndex) === Number(selectedDayForForm)
      && formData.startTime < classItem.endTime
      && formData.endTime > classItem.startTime
    ));
    if (conflict) {
      return {
        ok: false,
        error: `Esta clase se superpone con ${conflict.subject} (${conflict.startTime} - ${conflict.endTime}).`,
      };
    }

    savingClassRef.current = true;
    setSavingClass(true);
    try {
      const data = await requestSchedule(
        editingClassId
          ? `/api/schedules/${scheduleId}/classes/${editingClassId}`
          : `/api/schedules/${scheduleId}/classes`,
        {
          method: editingClassId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
          body: JSON.stringify(editingClassId ? formData : { ...formData, dayIndex: selectedDayForForm }),
        }
      );
      commitSchedule(data);
      if (!editingClassId) setActiveDayIndex(selectedDayForForm);
      setShowClassFormState(false);
      setEditingClass(null);
      return { ok: true };
    } catch (saveError) {
      return { ok: false, error: getScheduleErrorMessage(saveError, 'No se pudo guardar la clase.') };
    } finally {
      savingClassRef.current = false;
      if (mountedRef.current) setSavingClass(false);
    }
  }, [commitSchedule, scheduleId, selectedDayForForm, setActiveDayIndex, userId]);

  const handleDeleteClass = useCallback(async (classId) => {
    if (deletingClassRef.current) return { ok: false };
    const previousSchedule = scheduleRef.current;
    const optimisticSchedule = previousSchedule
      ? { ...previousSchedule, classes: previousSchedule.classes.filter((item) => item.id !== classId) }
      : null;
    deletingClassRef.current = true;
    setDeletingClassId(classId);
    setSelectedClassDetailState(null);
    if (optimisticSchedule) commitSchedule(optimisticSchedule);

    try {
      const data = await requestSchedule(`/api/schedules/${scheduleId}/classes/${classId}`, {
        method: 'DELETE',
        headers: { 'X-User-Id': userId },
      });
      commitSchedule(data);
      return { ok: true };
    } catch (deleteError) {
      if (previousSchedule) commitSchedule(previousSchedule);
      setError(getScheduleErrorMessage(deleteError, 'No se pudo eliminar la clase.'));
      return { ok: false };
    } finally {
      deletingClassRef.current = false;
      if (mountedRef.current) setDeletingClassId(null);
    }
  }, [commitSchedule, scheduleId, userId]);

  const handleUpdateAttendance = useCallback(async (classId, field, delta) => {
    if (attendanceRef.current) return { ok: false };
    const previousSchedule = scheduleRef.current;
    const target = previousSchedule?.classes.find((item) => item.id === classId);
    if (!target) return { ok: false };

    const nextValue = Math.max(0, (Number(target[field]) || 0) + delta);
    if (nextValue === target[field]) return { ok: true };
    const optimisticSchedule = {
      ...previousSchedule,
      classes: previousSchedule.classes.map((item) => (
        item.id === classId ? { ...item, [field]: nextValue } : item
      )),
    };

    attendanceRef.current = true;
    setUpdatingAttendance(true);
    setDetailError('');
    commitSchedule(optimisticSchedule);

    try {
      const data = await requestSchedule(`/api/schedules/${scheduleId}/classes/${classId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({ [field]: nextValue }),
      });
      commitSchedule(data);
      return { ok: true };
    } catch (attendanceError) {
      commitSchedule(previousSchedule);
      setDetailError(getScheduleErrorMessage(attendanceError, 'No se pudo actualizar la asistencia. Revisa tu conexión.'));
      return { ok: false };
    } finally {
      attendanceRef.current = false;
      if (mountedRef.current) setUpdatingAttendance(false);
    }
  }, [commitSchedule, scheduleId, userId]);

  const handleUpdateSettings = useCallback(async ({ name, daysCount }) => {
    if (savingSettingsRef.current) {
      return { ok: false, error: 'Ya se están guardando los ajustes.' };
    }

    savingSettingsRef.current = true;
    setSavingSettings(true);
    try {
      const data = await requestSchedule(`/api/schedules/${scheduleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({ name, daysCount }),
      });
      commitSchedule(data);
      if (activeDayIndexState >= daysCount) setActiveDayIndex(0);
      return { ok: true };
    } catch (settingsError) {
      return { ok: false, error: getScheduleErrorMessage(settingsError, 'No se pudieron guardar los ajustes.') };
    } finally {
      savingSettingsRef.current = false;
      if (mountedRef.current) setSavingSettings(false);
    }
  }, [activeDayIndexState, commitSchedule, scheduleId, setActiveDayIndex, userId]);

  const currentDayClasses = useMemo(() => sortClassesByStart(
    (schedule?.classes || []).filter((classItem) => Number(classItem.dayIndex) === activeDayIndexState)
  ), [activeDayIndexState, schedule?.classes]);

  return {
    schedule,
    loading,
    error,
    detailError,
    scheduleName: schedule?.name || '',
    daysCount: schedule?.daysCount || 5,
    classes: schedule?.classes || [],
    subjectColors: schedule?.subjectColors || [],
    activeDayIndex: activeDayIndexState,
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
    savingClass,
    savingSettings,
    updatingAttendance,
    deletingClassId,
    reload: loadSchedule,
  };
}
