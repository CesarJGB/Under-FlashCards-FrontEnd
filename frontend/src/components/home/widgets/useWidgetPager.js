import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const AXIS_LOCK_THRESHOLD_PX = 12;
const SWIPE_THRESHOLD_PX = 48;

function chunkItems(items, pageSize) {
  if (pageSize <= 0) return [items];

  const pages = [];
  for (let index = 0; index < items.length; index += pageSize) {
    pages.push(items.slice(index, index + pageSize));
  }

  return pages.length > 0 ? pages : [[]];
}

export default function useWidgetPager(items, pageSize) {
  const pages = useMemo(() => chunkItems(items, pageSize), [items, pageSize]);
  const [currentPage, setCurrentPage] = useState(0);
  const swipeConsumedRef = useRef(false);
  const gestureRef = useRef({
    startX: 0,
    startY: 0,
    axis: null,
    locked: false
  });

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, pages.length - 1));
  }, [pages.length]);

  const goToPage = useCallback((nextPage) => {
    setCurrentPage(Math.max(0, Math.min(nextPage, pages.length - 1)));
  }, [pages.length]);

  const goToNextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(prev + 1, pages.length - 1));
  }, [pages.length]);

  const goToPreviousPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(prev - 1, 0));
  }, []);

  const resetGesture = useCallback(() => {
    gestureRef.current = {
      startX: 0,
      startY: 0,
      axis: null,
      locked: false
    };
  }, []);

  const onPointerDown = useCallback((event) => {
    swipeConsumedRef.current = false;
    gestureRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      axis: null,
      locked: false
    };
  }, []);

  const onPointerMove = useCallback((event) => {
    if (pages.length <= 1) return;

    const gesture = gestureRef.current;
    if (gesture.locked) return;

    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;

    if (!gesture.axis) {
      if (Math.abs(deltaX) < AXIS_LOCK_THRESHOLD_PX && Math.abs(deltaY) < AXIS_LOCK_THRESHOLD_PX) {
        return;
      }

      gesture.axis = Math.abs(deltaX) > Math.abs(deltaY) ? 'x' : 'y';
    }

    if (gesture.axis !== 'x' || Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return;

    if (deltaX > 0) {
      goToPreviousPage();
    } else {
      goToNextPage();
    }

    gesture.locked = true;
    swipeConsumedRef.current = true;
  }, [goToNextPage, goToPreviousPage, pages.length]);

  const onPointerUp = useCallback(() => {
    resetGesture();
  }, [resetGesture]);

  const shouldSuppressClick = useCallback(() => {
    if (!swipeConsumedRef.current) return false;
    swipeConsumedRef.current = false;
    return true;
  }, []);

  return {
    currentPage,
    totalPages: pages.length,
    pageItems: pages[currentPage] || [],
    goToPage,
    shouldSuppressClick,
    swipeHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp
    }
  };
}
