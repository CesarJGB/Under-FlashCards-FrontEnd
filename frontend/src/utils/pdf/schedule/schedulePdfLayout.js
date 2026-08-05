import {
  getEventDurationMinutes,
  getRoundedScheduleTimeRange,
  getScheduleTimelineItems,
  sortScheduleEvents,
} from '../../../components/library/calendar/scheduleTimeline.js';

const LANDSCAPE_MAX_MINUTES_PER_PAGE = 16 * 60;
const PORTRAIT_COLUMN_CAPACITY = 232;
const PORTRAIT_SECTION_GAP = 5;
const PORTRAIT_HEADER_HEIGHT = 10;
const PORTRAIT_EVENT_BASE_HEIGHT = 10.5;
const PORTRAIT_EVENT_MIN_HEIGHT = 11.5;
const PORTRAIT_EVENT_MAX_HEIGHT = 21;
const PORTRAIT_EVENT_MINUTE_SCALE = 0.032;
const PORTRAIT_GAP_BASE_HEIGHT = 3.8;
const PORTRAIT_GAP_MAX_HEIGHT = 8;
const PORTRAIT_GAP_MINUTE_SCALE = 0.012;

function getPortraitItemHeight(item) {
  if (item.type === 'gap') {
    const duration = Math.max(0, Number(item.durationMinutes) || 0);
    return Math.min(
      PORTRAIT_GAP_MAX_HEIGHT,
      PORTRAIT_GAP_BASE_HEIGHT + (duration * PORTRAIT_GAP_MINUTE_SCALE)
    );
  }
  if (!item.isValid) return PORTRAIT_EVENT_MIN_HEIGHT;
  const duration = Math.max(0, Number(item.durationMinutes) || 0);
  return Math.min(
    PORTRAIT_EVENT_MAX_HEIGHT,
    Math.max(PORTRAIT_EVENT_MIN_HEIGHT, PORTRAIT_EVENT_BASE_HEIGHT + (duration * PORTRAIT_EVENT_MINUTE_SCALE))
  );
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

  const headerHeight = PORTRAIT_HEADER_HEIGHT;
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
  let currentSections = [];
  let currentHeight = 0;

  sections.forEach((section) => {
    const sectionGap = currentSections.length > 0 ? PORTRAIT_SECTION_GAP : 0;
    if (
      currentSections.length > 0
      && currentHeight + sectionGap + section.estimatedHeight > PORTRAIT_COLUMN_CAPACITY
    ) {
      pages.push({ type: 'portrait-week', sections: currentSections, columns: [currentSections] });
      currentSections = [];
      currentHeight = 0;
    }

    currentSections.push(section);
    currentHeight += (currentSections.length > 1 ? PORTRAIT_SECTION_GAP : 0) + section.estimatedHeight;
  });

  if (currentSections.length > 0) {
    pages.push({ type: 'portrait-week', sections: currentSections, columns: [currentSections] });
  }

  return pages.length > 0
    ? pages
    : [{ type: 'portrait-week', sections: [], columns: [[]] }];
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
