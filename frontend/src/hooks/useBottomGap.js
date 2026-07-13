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

const GAP_JITTER_TOLERANCE_PX = 4;

function waitForAnimationSettle(node) {
  if (!node?.getAnimations) {
    return Promise.resolve();
  }

  const animations = node.getAnimations().filter((animation) => animation.playState !== 'finished');
  if (animations.length === 0) {
    return Promise.resolve();
  }

  return Promise.allSettled(animations.map((animation) => animation.finished));
}

function waitForFontsReady() {
  if (typeof document === 'undefined' || !document.fonts?.ready) {
    return Promise.resolve();
  }

  return document.fonts.ready;
}

function waitWithTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      window.setTimeout(resolve, timeoutMs);
    })
  ]);
}

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
  const pendingStateRef = useRef(INITIAL_STATE);
  const readyRef = useRef(false);

  useLayoutEffect(() => {
    if (isPaused) return undefined;

    const contentContainer = contentEndRef?.current?.previousElementSibling || contentEndRef?.current?.parentElement || null;
    const navNode = navRef?.current || null;

    let contentObserver = null;
    let navObserver = null;
    let animationFrameTimeout = 0;
    let isCancelled = false;

    readyRef.current = false;
    pendingStateRef.current = INITIAL_STATE;
    lastStateRef.current = INITIAL_STATE;
    setState(INITIAL_STATE);

    const commitState = (nextState) => {
      const resolvedState = {
        ...nextState,
        isReady: readyRef.current && nextState.isReady
      };
      const prevState = lastStateRef.current;

      // Safari can settle the visual viewport a few pixels after first paint.
      // Keeping same-tier changes within this range avoids moving the preview.
      if (
        prevState.isReady &&
        resolvedState.isReady &&
        prevState.tier === resolvedState.tier &&
        Math.abs(prevState.gap - resolvedState.gap) <= GAP_JITTER_TOLERANCE_PX
      ) {
        return;
      }

      if (
        prevState.gap === resolvedState.gap &&
        prevState.tier === resolvedState.tier &&
        prevState.isReady === resolvedState.isReady
      ) {
        return;
      }

      lastStateRef.current = resolvedState;
      setState(resolvedState);
    };

    const publishStableMeasurement = () => {
      if (isCancelled) return;

      readyRef.current = true;

      if (!pendingStateRef.current.isReady) {
        measure();
      }

      commitState({
        ...pendingStateRef.current,
        isReady: true
      });
    };

    const measure = () => {
      frameRef.current = 0;

      const currentContentNode = contentEndRef?.current;
      const currentNavNode = navRef?.current;

      if (!currentContentNode || !currentNavNode) {
        pendingStateRef.current = INITIAL_STATE;
        if (readyRef.current) commitState(INITIAL_STATE);
        return;
      }

      const contentRect = currentContentNode.getBoundingClientRect();
      const navRect = currentNavNode.getBoundingClientRect();

      if (!isVisibleNav(currentNavNode, navRect)) {
        pendingStateRef.current = INITIAL_STATE;
        if (readyRef.current) commitState(INITIAL_STATE);
        return;
      }

      const gap = Math.max(0, Math.round(navRect.top - contentRect.bottom));

      const nextState = {
        gap,
        tier: resolveTier(gap, resolvedThresholds),
        isReady: true
      };

      pendingStateRef.current = nextState;

      if (readyRef.current) {
        commitState(nextState);
      }
    };

    const scheduleMeasure = () => {
      if (frameRef.current) return;
      frameRef.current = window.requestAnimationFrame(measure);
    };

    scheduleMeasure();

    waitWithTimeout(
      Promise.allSettled([
        waitForAnimationSettle(navNode),
        waitForFontsReady()
      ]),
      450
    ).then(() => {
      if (isCancelled) return;

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (isCancelled) return;
          measure();
          publishStableMeasurement();
        });
      });
    });

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
    navNode?.addEventListener('animationend', scheduleMeasure);

    animationFrameTimeout = window.setTimeout(scheduleMeasure, 240);

    return () => {
      isCancelled = true;

      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = 0;
      }

      if (animationFrameTimeout) {
        window.clearTimeout(animationFrameTimeout);
        animationFrameTimeout = 0;
      }

      contentObserver?.disconnect();
      navObserver?.disconnect();
      resizeTarget.removeEventListener('resize', scheduleMeasure);
      window.removeEventListener('orientationchange', scheduleMeasure);
      navNode?.removeEventListener('animationend', scheduleMeasure);
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
