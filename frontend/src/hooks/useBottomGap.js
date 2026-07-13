import { useLayoutEffect, useRef, useState } from 'react';

const DEFAULT_THRESHOLDS = {
  compact: 80,
  comfortable: 240,
  expanded: 450
};

const INITIAL_STATE = {
  gap: 0,
  tier: 'none',
  isReady: false
};

function resolveTier(gap, thresholds) {
  if (gap >= thresholds.expanded) return 'expanded';
  if (gap >= thresholds.comfortable) return 'comfortable';
  if (gap >= thresholds.compact) return 'compact';
  return 'none';
}

function isVisibleNav(node, rect) {
  if (!node || !rect) return false;
  if (rect.width <= 0 || rect.height <= 0) return false;

  const styles = window.getComputedStyle(node);
  return styles.display !== 'none' && styles.visibility !== 'hidden';
}

export default function useBottomGap({
  contentEndRef,
  navRef,
  thresholds = DEFAULT_THRESHOLDS,
  isPaused = false
}) {
  const resolvedThresholds = {
    ...DEFAULT_THRESHOLDS,
    ...(thresholds || {})
  };
  const [state, setState] = useState(INITIAL_STATE);
  const frameRef = useRef(0);
  const lastStateRef = useRef(INITIAL_STATE);

  useLayoutEffect(() => {
    if (isPaused) return undefined;

    const contentContainer = contentEndRef?.current?.parentElement || null;
    const navNode = navRef?.current || null;

    let contentObserver = null;
    let navObserver = null;

    const commitState = (nextState) => {
      const prevState = lastStateRef.current;
      if (
        prevState.gap === nextState.gap &&
        prevState.tier === nextState.tier &&
        prevState.isReady === nextState.isReady
      ) {
        return;
      }

      lastStateRef.current = nextState;
      setState(nextState);
    };

    const measure = () => {
      frameRef.current = 0;

      const currentContentNode = contentEndRef?.current;
      const currentNavNode = navRef?.current;

      if (!currentContentNode || !currentNavNode) {
        commitState(INITIAL_STATE);
        return;
      }

      const contentRect = currentContentNode.getBoundingClientRect();
      const navRect = currentNavNode.getBoundingClientRect();

      if (!isVisibleNav(currentNavNode, navRect)) {
        commitState(INITIAL_STATE);
        return;
      }

      const gap = Math.max(0, Math.round(navRect.top - contentRect.bottom));

      commitState({
        gap,
        tier: resolveTier(gap, resolvedThresholds),
        isReady: true
      });
    };

    const scheduleMeasure = () => {
      if (frameRef.current) return;
      frameRef.current = window.requestAnimationFrame(measure);
    };

    scheduleMeasure();

    if (typeof ResizeObserver !== 'undefined') {
      if (contentContainer) {
        contentObserver = new ResizeObserver(scheduleMeasure);
        contentObserver.observe(contentContainer);
      }

      if (navNode) {
        navObserver = new ResizeObserver(scheduleMeasure);
        navObserver.observe(navNode);
      }
    }

    const viewport = window.visualViewport;
    const resizeTarget = viewport || window;

    resizeTarget.addEventListener('resize', scheduleMeasure);
    window.addEventListener('orientationchange', scheduleMeasure);
    window.addEventListener('scroll', scheduleMeasure, { passive: true });

    return () => {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = 0;
      }

      contentObserver?.disconnect();
      navObserver?.disconnect();
      resizeTarget.removeEventListener('resize', scheduleMeasure);
      window.removeEventListener('orientationchange', scheduleMeasure);
      window.removeEventListener('scroll', scheduleMeasure);
    };
  }, [
    contentEndRef,
    navRef,
    isPaused,
    resolvedThresholds.compact,
    resolvedThresholds.comfortable,
    resolvedThresholds.expanded
  ]);

  return state;
}
