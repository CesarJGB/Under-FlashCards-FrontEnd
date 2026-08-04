import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getJSON, setJSON } from '../../../lib/safeLocalStorage';
import { isAttendanceField, normalizeScheduleAttendance } from './attendanceUtils';
import {
  cacheSchedule,
  getScheduleCacheKey,
  getScheduleDayCacheKey,
  getScheduleErrorMessage,
  requestSchedule,
  syncScheduleListCache,
} from './scheduleApi';
import { getInitialDayIndex, getSubjectKey, sortClassesByStart } from './scheduleUtils';

export const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const SHORT_WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const LEGACY_ATTENDANCE_FIELDS = { tardies: 'partialAttendances', participations: 'canceledClasses' };

function getClassSubjectKey(classItem) {
  return classItem?.subjectKey || getSubjectKey(classItem?.subject);
}

function withAttendanceDelta(schedule, subjectKey, field, delta) {
  if (!schedule?.classes?.length) return { schedule, applied: 0 };
  const target = schedule.classes.find((item) => getClassSubjectKey(item) === subjectKey);
  if (!target) return { schedule, applied: 0 };

  const current = Math.max(0, Number(target[field]) || 0);
  const next = Math.max(0, current + delta);
  const applied = next - current;
  if (applied === 0) return { schedule, applied: 0 };

  const nextProfiles = (schedule.subjectProfiles || []).map((profile) => (
    profile.key === subjectKey ? { ...profile, [field]: next } : profile
  ));
  const legacyField = LEGACY_ATTENDANCE_FIELDS[field];
  const nextClasses = schedule.classes.map((item) => {
    if (getClassSubjectKey(item) !== subjectKey) return item;
    return {
      ...item,
      [field]: next,
      ...(legacyField ? { [legacyField]: next } : {}),
    };
  });

  return {
    applied,
    schedule: {
      ...schedule,
      subjectProfiles: nextProfiles,
      classes: nextClasses,
    },
  };
}

function applyPendingAttendanceOperations(schedule, operations) {
  return operations.reduce((currentSchedule, operation) => (
    withAttendanceDelta(currentSchedule, operation.subjectKey, operation.field, operation.delta).schedule
  ), schedule);
}

export function useScheduleCalendar(userId, scheduleId) {
  const cacheKey = getScheduleCacheKey(scheduleId);
  const dayCacheKey = getScheduleDayCacheKey(scheduleId);
  const initialSchedule = cacheKey ? normalizeScheduleAttendance(getJSON(cacheKey)) : null;
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
  const attendanceQueueRef = useRef([]);
  const attendanceWorkerRef = useRef(false);
  const deletingClassRef = useRef(false);
  const dayInitializedRef = useRef(Boolean(initialSchedule));

  const commitSchedule = useCallback((nextSchedule) => {
    const normalized = normalizeScheduleAttendance(nextSchedule);
    scheduleRef.current = normalized;
    if (mountedRef.current) setSchedule(normalized);
    if (normalized) {
      cacheSchedule(normalized);
      syncScheduleListCache(userId, normalized);
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
      attendanceQueueRef.current = [];
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

  const handleSaveClass = useCallback(async (formData, editingClassId = null, scope = 'occurrence') => {
    if (savingClassRef.current) return { ok: false, error: 'Ya se está guardando esta clase.' };

    const currentSchedule = scheduleRef.current;
    const conflict = currentSchedule?.classes.find((classItem) => (
      classItem.id !== editingClassId
      && Number(classItem.dayIndex) === Number(selectedDayForForm)
      && formData.startTime < classItem.endTime
      && formData.endTime > classItem.startTime
    ));
    if (conflict) {
      return { ok: false, error: `Esta clase se superpone con ${conflict.subject} (${conflict.startTime} - ${conflict.endTime}).` };
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
          body: JSON.stringify(editingClassId
            ? { ...formData, scope }
            : { ...formData, dayIndex: selectedDayForForm }),
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

  const handleDeleteClass = useCallback(async (classId, scope = 'occurrence') => {
    if (deletingClassRef.current) return { ok: false };
    const previousSchedule = scheduleRef.current;
    const target = previousSchedule?.classes.find((item) => item.id === classId);
    if (!target) return { ok: false };
    const subjectKey = getClassSubjectKey(target);
    const optimisticSchedule = previousSchedule
      ? {
        ...previousSchedule,
        classes: previousSchedule.classes.filter((item) => (
          scope === 'all' ? getClassSubjectKey(item) !== subjectKey : item.id !== classId
        )),
      }
      : null;

    deletingClassRef.current = true;
    setDeletingClassId(classId);
    setDetailError('');
    if (optimisticSchedule) commitSchedule(optimisticSchedule);

    try {
      const data = await requestSchedule(`/api/schedules/${scheduleId}/classes/${classId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({ scope }),
      });
      commitSchedule(data);
      setSelectedClassDetailState(null);
      return { ok: true };
    } catch (deleteError) {
      if (previousSchedule) commitSchedule(previousSchedule);
      setDetailError(getScheduleErrorMessage(deleteError, 'No se pudo eliminar la clase.'));
      return { ok: false };
    } finally {
      deletingClassRef.current = false;
      if (mountedRef.current) setDeletingClassId(null);
    }
  }, [commitSchedule, scheduleId, userId]);

  const drainAttendanceQueue = useCallback(async () => {
    if (attendanceWorkerRef.current) return;
    attendanceWorkerRef.current = true;
    try {
      while (attendanceQueueRef.current.length > 0 && mountedRef.current) {
        const operation = attendanceQueueRef.current.shift();
        try {
          const data = await requestSchedule(`/api/schedules/${scheduleId}/classes/${operation.classId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
            // Delta updates are atomic at the subject level on the backend;
            // serializing the queue also protects older Mongo deployments.
            body: JSON.stringify({ attendanceDelta: { [operation.field]: operation.delta } }),
          });
          // Clicks that arrived while the request was in flight were already
          // rendered optimistically. Reapply them to the authoritative response
          // so a fast sequence never flashes backward or loses increments.
          commitSchedule(applyPendingAttendanceOperations(data, attendanceQueueRef.current));
        } catch (attendanceError) {
          const rollback = withAttendanceDelta(scheduleRef.current, operation.subjectKey, operation.field, -operation.delta);
          if (rollback.applied !== 0) commitSchedule(rollback.schedule);
          setDetailError(getScheduleErrorMessage(attendanceError, 'No se pudo actualizar la asistencia. Revisa tu conexión.'));
        }
      }
    } finally {
      attendanceWorkerRef.current = false;
      if (mountedRef.current) setUpdatingAttendance(attendanceQueueRef.current.length > 0);
      if (attendanceQueueRef.current.length > 0 && mountedRef.current) void drainAttendanceQueue();
    }
  }, [commitSchedule, scheduleId, userId]);

  const handleUpdateAttendance = useCallback((classId, field, delta) => {
    if (!isAttendanceField(field) || !Number.isInteger(delta)) return { ok: false };
    const currentSchedule = scheduleRef.current;
    const target = currentSchedule?.classes.find((item) => item.id === classId);
    if (!target) return { ok: false };

    const subjectKey = getClassSubjectKey(target);
    const optimistic = withAttendanceDelta(currentSchedule, subjectKey, field, delta);
    if (optimistic.applied === 0) return { ok: true };

    setDetailError('');
    commitSchedule(optimistic.schedule);
    attendanceQueueRef.current.push({
      classId,
      subjectKey,
      field,
      delta: optimistic.applied,
    });
    setUpdatingAttendance(true);
    void drainAttendanceQueue();
    return { ok: true };
  }, [commitSchedule, drainAttendanceQueue]);

  const handleUpdateSettings = useCallback(async ({ name, daysCount }) => {
    if (savingSettingsRef.current) return { ok: false, error: 'Ya se están guardando los ajustes.' };

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
    subjectProfiles: schedule?.subjectProfiles || [],
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
