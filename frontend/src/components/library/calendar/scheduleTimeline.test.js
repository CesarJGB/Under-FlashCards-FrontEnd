import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatFreeTime,
  getRoundedScheduleTimeRange,
  getScheduleGaps,
  getScheduleStats,
  getScheduleTimelineItems,
} from './scheduleTimeline.js';

function event(id, startTime, endTime, dayIndex = 0) {
  return { id, title: id, dayIndex, startTime, endTime };
}

test('distingue huecos de 0, 1, 15, 30 y 120 minutos', () => {
  const cases = [0, 1, 15, 30, 120];
  for (const minutes of cases) {
    const first = event(`a-${minutes}`, '08:00', '09:00');
    const nextStart = `${String(9 + Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    const second = event(`b-${minutes}`, nextStart, '12:00');
    const gap = getScheduleGaps([second, first], { dayIndex: 0 })[0];
    assert.equal(gap.durationMinutes, minutes);
    assert.equal(gap.status, minutes === 0 ? 'zero' : 'positive');
    assert.equal(gap.previousEvent, first);
    assert.equal(gap.nextEvent, second);
  }
});

test('marca solapamientos y datos horarios inválidos sin inventar tiempo libre', () => {
  const overlap = getScheduleGaps([
    event('a', '08:00', '10:00'),
    event('b', '09:30', '11:00'),
  ], { dayIndex: 0 });
  assert.equal(overlap[0].status, 'overlap');
  assert.equal(overlap[0].signedDurationMinutes, -30);

  const invalid = getScheduleGaps([event('bad', '', '11:00')], { dayIndex: 0 });
  assert.equal(invalid[0].status, 'invalid');
  assert.equal(invalid[0].durationMinutes, null);
});

test('mantiene ocupado todo el intervalo de solapamientos anidados', () => {
  const gaps = getScheduleGaps([
    event('long', '08:00', '12:00'),
    event('nested', '09:00', '10:00'),
    event('after', '11:00', '13:00'),
  ], { dayIndex: 0 });

  assert.deepEqual(gaps.map((gap) => gap.status), ['overlap', 'overlap']);
  assert.equal(gaps.some((gap) => gap.status === 'positive'), false);
  assert.equal(gaps[1].previousEvent.id, 'long');
});

test('incluye huecos opcionales antes del primer evento y después del último', () => {
  const gaps = getScheduleGaps([event('a', '09:00', '10:00')], {
    dayIndex: 0,
    rangeStart: '08:00',
    rangeEnd: '12:00',
    includeBoundaryGaps: true,
  });
  assert.deepEqual(gaps.map((gap) => [gap.kind, gap.durationMinutes]), [['before', 60], ['after', 120]]);
});

test('intercala eventos y huecos en orden cronológico', () => {
  const items = getScheduleTimelineItems([
    event('b', '10:30', '11:30'),
    event('a', '08:00', '09:00'),
  ], { dayIndex: 0 });
  assert.deepEqual(items.map((item) => item.type), ['event', 'gap', 'event']);
  assert.equal(items[1].durationMinutes, 90);
});

test('usa rango inteligente redondeado a 30 minutos sin mínimo rígido de ocho horas', () => {
  assert.deepEqual(getRoundedScheduleTimeRange([event('a', '10:10', '11:00')]), { start: 570, end: 690 });
  assert.deepEqual(getRoundedScheduleTimeRange([]), { start: 480, end: 1080 });
});

test('resume tiempo programado y mayor hueco visible', () => {
  const stats = getScheduleStats([
    event('a', '08:00', '09:00'),
    event('b', '09:30', '10:00'),
    event('c', '12:00', '13:00', 1),
  ], 5);
  assert.equal(stats.eventCount, 3);
  assert.equal(stats.totalMinutes, 150);
  assert.equal(stats.largestGap.durationMinutes, 30);
  assert.equal(formatFreeTime(1), '1 min libre');
  assert.equal(formatFreeTime(80), '1 h 20 min libres');
});
