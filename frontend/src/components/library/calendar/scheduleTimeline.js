const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function toBoundaryMinutes(value) {
  if (Number.isFinite(value)) return Math.max(0, Math.min(24 * 60, Number(value)));
  return timeToMinutes(value);
}

function eventIdentity(event, index) {
  return String(event?.id || event?._id || `${event?.dayIndex ?? 'day'}-${event?.startTime || 'invalid'}-${index}`);
}

export function timeToMinutes(value) {
  if (typeof value !== 'string' || !TIME_PATTERN.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return (hours * 60) + minutes;
}

export function minutesToTime(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return '--:--';
  const clamped = Math.max(0, Math.min((24 * 60) - 1, Math.round(minutes)));
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}

export function getEventDurationMinutes(event) {
  const start = timeToMinutes(event?.startTime);
  const end = timeToMinutes(event?.endTime);
  if (start === null || end === null || end <= start) return 0;
  return end - start;
}

export function sortScheduleEvents(events = []) {
  return [...events].sort((first, second) => {
    const firstDay = Number.isInteger(Number(first?.dayIndex)) ? Number(first.dayIndex) : Number.MAX_SAFE_INTEGER;
    const secondDay = Number.isInteger(Number(second?.dayIndex)) ? Number(second.dayIndex) : Number.MAX_SAFE_INTEGER;
    if (firstDay !== secondDay) return firstDay - secondDay;

    const startDifference = (timeToMinutes(first?.startTime) ?? Number.MAX_SAFE_INTEGER)
      - (timeToMinutes(second?.startTime) ?? Number.MAX_SAFE_INTEGER);
    if (startDifference !== 0) return startDifference;
    return (timeToMinutes(first?.endTime) ?? Number.MAX_SAFE_INTEGER)
      - (timeToMinutes(second?.endTime) ?? Number.MAX_SAFE_INTEGER);
  });
}

function normalizeEvents(events, dayIndex) {
  return sortScheduleEvents(events)
    .filter((event) => dayIndex === undefined || Number(event?.dayIndex) === Number(dayIndex))
    .map((event, index) => {
      const startMinutes = timeToMinutes(event?.startTime);
      const endMinutes = timeToMinutes(event?.endTime);
      const isValid = startMinutes !== null && endMinutes !== null && endMinutes > startMinutes;
      return {
        id: eventIdentity(event, index),
        type: 'event',
        event,
        dayIndex: Number(event?.dayIndex),
        startMinutes,
        endMinutes,
        durationMinutes: isValid ? endMinutes - startMinutes : 0,
        isValid,
      };
    });
}

function createGap({ kind, dayIndex, previousEvent = null, nextEvent = null, startMinutes, endMinutes, status }) {
  const signedDurationMinutes = startMinutes === null || endMinutes === null
    ? null
    : endMinutes - startMinutes;
  const resolvedStatus = status || (
    signedDurationMinutes === null
      ? 'invalid'
      : signedDurationMinutes > 0
        ? 'positive'
        : signedDurationMinutes === 0
          ? 'zero'
          : 'overlap'
  );

  return {
    id: `gap-${dayIndex}-${kind}-${previousEvent?.id || 'start'}-${nextEvent?.id || 'end'}`,
    type: 'gap',
    kind,
    status: resolvedStatus,
    dayIndex,
    startMinutes,
    endMinutes,
    startTime: startMinutes === null ? null : minutesToTime(startMinutes),
    endTime: endMinutes === null ? null : minutesToTime(endMinutes),
    durationMinutes: signedDurationMinutes === null ? null : Math.max(0, signedDurationMinutes),
    signedDurationMinutes,
    previousEvent: previousEvent?.event || null,
    nextEvent: nextEvent?.event || null,
  };
}

/**
 * Calculates real free time between compatible schedule events. Boundary gaps
 * are opt-in because a schedule does not imply a commute or a full-day window.
 */
export function getScheduleGaps(events = [], {
  dayIndex,
  rangeStart,
  rangeEnd,
  includeBoundaryGaps = false,
} = {}) {
  const normalized = normalizeEvents(events, dayIndex);
  const valid = normalized.filter((item) => item.isValid);
  const invalid = normalized.filter((item) => !item.isValid);
  const resolvedDayIndex = Number.isInteger(Number(dayIndex))
    ? Number(dayIndex)
    : (valid[0]?.dayIndex ?? invalid[0]?.dayIndex ?? 0);
  const gaps = invalid.map((item) => createGap({
    kind: 'invalid',
    dayIndex: item.dayIndex,
    previousEvent: item,
    nextEvent: item,
    startMinutes: null,
    endMinutes: null,
    status: 'invalid',
  }));

  if (valid.length === 0) return gaps;

  if (includeBoundaryGaps) {
    const startBoundary = toBoundaryMinutes(rangeStart);
    if (startBoundary !== null) {
      gaps.push(createGap({
        kind: 'before',
        dayIndex: resolvedDayIndex,
        nextEvent: valid[0],
        startMinutes: startBoundary,
        endMinutes: valid[0].startMinutes,
      }));
    }
  }

  let coverageEnd = valid[0].endMinutes;
  let coverageEvent = valid[0];
  for (let index = 1; index < valid.length; index += 1) {
    const current = valid[index];
    gaps.push(createGap({
      kind: 'between',
      dayIndex: resolvedDayIndex,
      previousEvent: coverageEvent,
      nextEvent: current,
      startMinutes: coverageEnd,
      endMinutes: current.startMinutes,
    }));

    // Keep the occupied interval open until the latest overlapping event ends.
    // Comparing only adjacent events could otherwise invent a free gap inside
    // a longer event that contains a shorter one.
    if (current.endMinutes >= coverageEnd) {
      coverageEnd = current.endMinutes;
      coverageEvent = current;
    }
  }

  if (includeBoundaryGaps) {
    const endBoundary = toBoundaryMinutes(rangeEnd);
    if (endBoundary !== null) {
      gaps.push(createGap({
        kind: 'after',
        dayIndex: resolvedDayIndex,
        previousEvent: coverageEvent,
        startMinutes: coverageEnd,
        endMinutes: endBoundary,
      }));
    }
  }

  return gaps;
}

export function getScheduleTimelineItems(events = [], options = {}) {
  const normalized = normalizeEvents(events, options.dayIndex);
  const valid = normalized.filter((item) => item.isValid);
  const invalid = normalized.filter((item) => !item.isValid);
  const gaps = getScheduleGaps(events, options);
  const items = [];

  const beforeGap = gaps.find((gap) => gap.kind === 'before');
  if (beforeGap) items.push(beforeGap);

  valid.forEach((eventItem, index) => {
    if (index > 0) {
      const gap = gaps.find((candidate) => (
        candidate.kind === 'between'
        && candidate.nextEvent === eventItem.event
      ));
      if (gap) items.push(gap);
    }
    items.push(eventItem);
  });

  const afterGap = gaps.find((gap) => gap.kind === 'after');
  if (afterGap) items.push(afterGap);
  items.push(...invalid);
  return items;
}

export function getRoundedScheduleTimeRange(events = [], {
  stepMinutes = 30,
  paddingMinutes = 30,
  minimumMinutes = 120,
  emptyStart = 8 * 60,
  emptyEnd = 18 * 60,
} = {}) {
  const valid = normalizeEvents(events).filter((item) => item.isValid);
  if (valid.length === 0) return { start: emptyStart, end: emptyEnd };

  const rawStart = Math.min(...valid.map((item) => item.startMinutes));
  const rawEnd = Math.max(...valid.map((item) => item.endMinutes));
  const rawDuration = rawEnd - rawStart;
  const adaptivePadding = rawDuration >= 12 * 60 ? 0 : paddingMinutes;
  let start = Math.max(0, Math.floor((rawStart - adaptivePadding) / stepMinutes) * stepMinutes);
  let end = Math.min(24 * 60, Math.ceil((rawEnd + adaptivePadding) / stepMinutes) * stepMinutes);

  if (end - start < minimumMinutes) {
    let missing = minimumMinutes - (end - start);
    const before = Math.min(start, Math.ceil((missing / 2) / stepMinutes) * stepMinutes);
    start -= before;
    missing -= before;
    end = Math.min(24 * 60, end + Math.ceil(missing / stepMinutes) * stepMinutes);
    if (end - start < minimumMinutes) start = Math.max(0, end - minimumMinutes);
  }

  return { start, end: Math.max(start + stepMinutes, end) };
}

export function formatScheduleDuration(minutes) {
  const safeMinutes = Math.max(0, Number(minutes) || 0);
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;
  if (hours === 0) return `${remainder} min`;
  if (remainder === 0) return `${hours} h`;
  return `${hours} h ${remainder} min`;
}

export function formatFreeTime(minutes) {
  const safeMinutes = Math.max(0, Number(minutes) || 0);
  return `${formatScheduleDuration(safeMinutes)} ${safeMinutes === 1 ? 'libre' : 'libres'}`;
}

export function getScheduleStats(events = [], daysCount = 7) {
  const visibleEvents = events.filter((event) => {
    const day = Number(event?.dayIndex);
    return Number.isInteger(day) && day >= 0 && day < daysCount;
  });
  const valid = normalizeEvents(visibleEvents).filter((item) => item.isValid);
  const positiveGaps = Array.from({ length: daysCount }, (_, dayIndex) => (
    getScheduleGaps(visibleEvents, { dayIndex }).filter((gap) => gap.kind === 'between' && gap.status === 'positive')
  )).flat();
  const largestGap = positiveGaps.reduce((largest, gap) => (
    !largest || gap.durationMinutes > largest.durationMinutes ? gap : largest
  ), null);

  return {
    eventCount: valid.length,
    totalMinutes: valid.reduce((total, item) => total + item.durationMinutes, 0),
    largestGap,
    invalidEventCount: visibleEvents.length - valid.length,
  };
}

export { TIME_PATTERN };
