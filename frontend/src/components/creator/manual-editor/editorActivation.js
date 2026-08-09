import { useLayoutEffect, useRef } from 'react';

export function createFocusPreservingPressState() {
  return {
    ignoreNextClick: false,
    touchStartPrevented: false,
  };
}

/**
 * Executes one logical press before a pointer can transfer focus. A small,
 * explicit gesture state is required because Safari can expose a touch click
 * without pointer metadata or retarget the end of the gesture after React
 * mounts an overlay.
 */
export function handleFocusPreservingPress(
  event,
  activate,
  state = createFocusPreservingPressState(),
) {
  if (!event || typeof activate !== 'function') return false;

  if (event.type === 'pointerdown') {
    if (event.isPrimary === false) return false;
    if (typeof event.button === 'number' && event.button !== 0) return false;
    event.preventDefault?.();
    state.ignoreNextClick = true;
    activate('pointer');
    return true;
  }

  if (event.type === 'mousedown') {
    if (typeof event.button === 'number' && event.button !== 0) return false;
    event.preventDefault?.();
    if (state.ignoreNextClick) return false;
    state.ignoreNextClick = true;
    activate('pointer');
    return true;
  }

  if (event.type === 'touchstart') {
    if (event.touches?.length > 1) return false;
    event.preventDefault?.();
    state.touchStartPrevented = true;
    return false;
  }

  if (event.type === 'touchend' || event.type === 'touchcancel') {
    // A cancelled native touchstart suppresses its compatibility mouse/click
    // sequence. Do not leave a sentinel that could consume a later AT click.
    if (state.touchStartPrevented) state.ignoreNextClick = false;
    state.touchStartPrevented = false;
    return false;
  }

  if (event.type === 'keydown') {
    if (event.key === 'Enter' || event.key === ' ') state.ignoreNextClick = false;
    return false;
  }

  if (event.type === 'click') {
    if (state.ignoreNextClick) {
      state.ignoreNextClick = false;
      return false;
    }
    const pointerType = event.pointerType || event.nativeEvent?.pointerType || '';
    if (pointerType || Number(event.detail || 0) !== 0) return false;
    activate('semantic-click');
    return true;
  }

  return false;
}

/**
 * React delegates touchstart passively. Attach the one non-passive listener
 * directly to each focus-sensitive trigger so preventDefault is effective in
 * Safari without introducing a global touch guard.
 */
export function useFocusPreservingPress(targetRef, activate, active = true) {
  const activateRef = useRef(activate);
  activateRef.current = activate;
  const stateRef = useRef(null);
  if (stateRef.current === null) stateRef.current = createFocusPreservingPressState();

  const press = (event) => handleFocusPreservingPress(
    event,
    (source) => activateRef.current?.(source, event),
    stateRef.current,
  );

  useLayoutEffect(() => {
    if (!active) return undefined;
    const target = targetRef.current;
    if (!target) return undefined;
    const handleTouchStart = (event) => press(event);
    const handleTouchEnd = (event) => press(event);
    target.addEventListener('touchstart', handleTouchStart, { passive: false });
    target.addEventListener('touchend', handleTouchEnd, { passive: false });
    target.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    return () => {
      target.removeEventListener('touchstart', handleTouchStart, { passive: false });
      target.removeEventListener('touchend', handleTouchEnd, { passive: false });
      target.removeEventListener('touchcancel', handleTouchEnd, { passive: false });
    };
  }, [active, targetRef]);

  return {
    onPointerDown: press,
    onMouseDown: press,
    onClick: press,
    onKeyDown: press,
  };
}
