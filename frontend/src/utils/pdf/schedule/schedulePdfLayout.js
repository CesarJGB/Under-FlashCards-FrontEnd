import {
  getEventDurationMinutes,
  getRoundedScheduleTimeRange,
  getScheduleTimelineItems,
  sortScheduleEvents,
} from '../../../components/library/calendar/scheduleTimeline.js';

const LANDSCAPE_MAX_MINUTES_PER_PAGE = 16 * 60;
const PORTRAIT_COLUMN_CAPACITY = 232;
const PORTRAIT_COLUMNS = 2;
const PORTRAIT_SECTION_GAP = 4;

function getPortraitItemHeight(item) {
  if (item.type === 'gap') return item.durationMinutes >= 15 ? 3.6 : 3;
  if (!item.isValid) return 9.5;
  const duration = item.durationMinutes;
  if (duration <= 60) return 9.5;
  if (duration <= 120) return 10.5;
  return 11.5;
}

function createDayTimeline(day) {
  return getScheduleTimelineItems(day.classes, { dayIndex: day.dayIndex }).filter((item) => (
    item.type === 'event' || (item.type === 'gap' && item.status === 'positive')
  ));
}

function createDaySections(day) {
  const timelineItems = createDayTimeline(day);
  if (timelineItems.length === 0) {
    return [{
      dayIndex: day.dayIndex,
      classes: [],
      items: [],
      continued: false,
      hasContinuation: false,
      estimatedHeight: 21,
    }];
  }

  const headerHeight = 10;
  const maximumItemsHeight = PORTRAIT_COLUMN_CAPACITY - headerHeight;
  const chunks = [];
  let currentItems = [];
  let currentHeight = 0;

  timelineItems.forEach((item) => {
    const itemHeight = getPortraitItemHeight(item);
    if (currentItems.length > 0 && currentHeight + itemHeight > maximumItemsHeight) {
      chunks.push(currentItems);
      currentItems = [];
      currentHeight = 0;
    }
    currentItems.push({ ...item, estimatedHeight: itemHeight });
    currentHeight += itemHeight;
  });
  if (currentItems.length > 0) chunks.push(currentItems);

  return chunks.map((items, index) => ({
    dayIndex: day.dayIndex,
    classes: items.filter((item) => item.type === 'event').map((item) => item.event),
    items,
    continued: index > 0,
    hasContinuation: index < chunks.length - 1,
    estimatedHeight: headerHeight + items.reduce((total, item) => total + item.estimatedHeight, 0),
  }));
}

function packPortraitPages(days) {
  const sections = days.flatMap(createDaySections);
  const pages = [];
  const columnHeight = (column) => column.reduce((total, section, index) => (
    total + section.estimatedHeight + (index > 0 ? PORTRAIT_SECTION_GAP : 0)
  ), 0);
  let cursor = 0;

  while (cursor < sections.length) {
    let best = null;

    for (let take = 1; cursor + take <= sections.length; take += 1) {
      const candidateSections = sections.slice(cursor, cursor + take);
      let bestSplit = null;
      const lastSplit = take === 1 ? 1 : take - 1;

      for (let split = 1; split <= lastSplit; split += 1) {
        const columns = [candidateSections.slice(0, split), candidateSections.slice(split)];
        const heights = columns.map(columnHeight);
        if (heights.every((height) => height <= PORTRAIT_COLUMN_CAPACITY)) {
          const imbalance = Math.abs(heights[0] - heights[1]);
          if (!bestSplit || imbalance < bestSplit.imbalance) {
            bestSplit = { columns, heights, imbalance };
          }
        }
      }

      if (!bestSplit) break;
      best = { take, ...bestSplit };
    }

    // Every section is capped to one column, so this fallback is defensive.
    if (!best) best = { take: 1, columns: [[sections[cursor]], []] };
    pages.push({ type: 'portrait-week', columns: best.columns });
    cursor += best.take;
  }

  return pages.length > 0 ? pages : [{ type: 'portrait-week', columns: [[], []] }];
}

function createLandscapeTimeRanges(classes) {
  const timeRange = getRoundedScheduleTimeRange(classes);
  const ranges = [];
  const totalMinutes = timeRange.end - timeRange.start;
  const pageCount = Math.max(1, Math.ceil(totalMinutes / LANDSCAPE_MAX_MINUTES_PER_PAGE));
  const balancedBandMinutes = Math.ceil((totalMinutes / pageCount) / 30) * 30;
  let cursor = timeRange.start;

  while (cursor < timeRange.end) {
    const end = Math.min(timeRange.end, cursor + balancedBandMinutes);
    ranges.push({ start: cursor, end });
    cursor = end;
  }

  return ranges.length > 0 ? ranges : [timeRange];
}

export function createSchedulePdfLayout({ classes = [], daysCount = 5, orientation = 'portrait' } = {}) {
  const safeDaysCount = Math.max(5, Math.min(7, Number(daysCount) || 5));
  const normalizedClasses = sortScheduleEvents(Array.isArray(classes) ? classes : []).filter((item) => {
    const dayIndex = Number(item?.dayIndex);
    return Number.isInteger(dayIndex) && dayIndex >= 0 && dayIndex < 7;
  });
  const visibleClasses = normalizedClasses.filter((item) => Number(item.dayIndex) < safeDaysCount);
  const hiddenEventCount = normalizedClasses.length - visibleClasses.length;
  const days = Array.from({ length: safeDaysCount }, (_, dayIndex) => ({
    dayIndex,
    classes: visibleClasses.filter((item) => Number(item.dayIndex) === dayIndex),
  }));

  const safeOrientation = orientation === 'landscape' ? 'landscape' : 'portrait';
  const pages = safeOrientation === 'landscape'
    ? createLandscapeTimeRanges(visibleClasses).map((timeRange) => ({
      type: 'landscape-week',
      days,
      timeRange,
    }))
    : packPortraitPages(days).map((page) => ({
      ...page,
      days,
      timeRange: getRoundedScheduleTimeRange(visibleClasses),
    }));

  return {
    orientation: safeOrientation,
    daysCount: safeDaysCount,
    classes: visibleClasses,
    hiddenEventCount,
    days,
    pages,
    pageCount: pages.length,
  };
}

export function estimateSchedulePdfPages(input) {
  return createSchedulePdfLayout(input).pages.length;
}

export function estimateDayHeight(classes = [], dayIndex = Number(classes[0]?.dayIndex) || 0) {
  return createDaySections({ dayIndex, classes })
    .reduce((total, section) => total + section.estimatedHeight, 0);
}

export { LANDSCAPE_MAX_MINUTES_PER_PAGE, PORTRAIT_COLUMN_CAPACITY, getPortraitItemHeight };
