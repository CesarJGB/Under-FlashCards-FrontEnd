import { getJSON, remove, setJSON } from '../../../lib/safeLocalStorage';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export class ScheduleRequestError extends Error {
  constructor(message, { status = 0, code = '', details = null } = {}) {
    super(message);
    this.name = 'ScheduleRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function requestSchedule(path, options = {}) {
  const response = await fetch(`${BACKEND_URL}${path}`, options);
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new ScheduleRequestError(
      payload?.error || `No se pudo completar la operación (${response.status}).`,
      { status: response.status, code: payload?.code || '', details: payload }
    );
  }
  return payload;
}

export function getScheduleCacheKey(scheduleId) {
  return scheduleId ? `schedule_${scheduleId}` : null;
}

export function getScheduleDayCacheKey(scheduleId) {
  return scheduleId ? `schedule_day_${scheduleId}` : null;
}

export function getScheduleListCacheKey(userId) {
  return userId ? `schedules_list_${userId}` : null;
}

export function cacheSchedule(schedule) {
  if (schedule?.id) setJSON(getScheduleCacheKey(schedule.id), schedule);
}

export function syncScheduleListCache(userId, schedule) {
  const key = getScheduleListCacheKey(userId);
  if (!key || !schedule?.id) return;
  const current = getJSON(key);
  if (!Array.isArray(current)) return;
  const next = current.map((item) => item.id === schedule.id ? schedule : item);
  setJSON(key, next);
}

export function removeScheduleCaches(userId, scheduleId) {
  const scheduleKey = getScheduleCacheKey(scheduleId);
  const dayKey = getScheduleDayCacheKey(scheduleId);
  if (scheduleKey) remove(scheduleKey);
  if (dayKey) remove(dayKey);

  const listKey = getScheduleListCacheKey(userId);
  const current = listKey ? getJSON(listKey) : null;
  if (Array.isArray(current)) {
    setJSON(listKey, current.filter((item) => item.id !== scheduleId));
  }
}

export function getScheduleErrorMessage(error, fallback = 'No se pudo completar la operación.') {
  if (error?.name === 'AbortError') return '';
  return error?.message || fallback;
}
