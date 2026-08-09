const SCROLL_EPSILON = 1;

export function shouldContainActionSheetPan({
  scrollTop,
  scrollHeight,
  clientHeight,
  deltaY,
}) {
  if (!Number.isFinite(deltaY) || deltaY === 0) return false;
  if (scrollHeight <= clientHeight + SCROLL_EPSILON) return true;
  if (deltaY > 0 && scrollTop <= SCROLL_EPSILON) return true;
  if (deltaY < 0 && scrollTop + clientHeight >= scrollHeight - SCROLL_EPSILON) return true;
  return false;
}

const findTouch = (touches, identifier) => (
  [...(touches || [])].find((touch) => touch.identifier === identifier)
  || touches?.[0]
  || null
);

const findScrollRoot = (layer, target) => {
  const candidate = target?.closest?.('[data-action-sheet-scroll="true"]');
  return candidate && layer.contains(candidate) ? candidate : null;
};

export function installActionSheetGestureGuard(layer) {
  if (!layer?.addEventListener) return () => {};
  let gesture = null;

  const handleTouchStart = (event) => {
    if (event.touches?.length !== 1) {
      gesture = null;
      return;
    }
    const touch = event.touches[0];
    gesture = {
      identifier: touch.identifier,
      lastX: touch.clientX,
      lastY: touch.clientY,
      scrollRoot: findScrollRoot(layer, event.target),
      nativeRange: Boolean(event.target?.closest?.('input[type="range"]')),
    };
  };

  const handleTouchMove = (event) => {
    if (!gesture || event.touches?.length !== 1 || gesture.nativeRange) return;
    const touch = findTouch(event.touches, gesture.identifier);
    if (!touch) return;
    const deltaX = touch.clientX - gesture.lastX;
    const deltaY = touch.clientY - gesture.lastY;
    gesture.lastX = touch.clientX;
    gesture.lastY = touch.clientY;
    if (Math.abs(deltaX) > Math.abs(deltaY)) return;
    const scrollRoot = gesture.scrollRoot;
    if (!scrollRoot || shouldContainActionSheetPan({
      scrollTop: scrollRoot.scrollTop,
      scrollHeight: scrollRoot.scrollHeight,
      clientHeight: scrollRoot.clientHeight,
      deltaY,
    })) {
      event.preventDefault();
    }
  };

  const endGesture = () => {
    gesture = null;
  };

  layer.addEventListener('touchstart', handleTouchStart, { passive: true });
  layer.addEventListener('touchmove', handleTouchMove, { passive: false });
  layer.addEventListener('touchend', endGesture, { passive: true });
  layer.addEventListener('touchcancel', endGesture, { passive: true });

  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    gesture = null;
    layer.removeEventListener('touchstart', handleTouchStart);
    layer.removeEventListener('touchmove', handleTouchMove);
    layer.removeEventListener('touchend', endGesture);
    layer.removeEventListener('touchcancel', endGesture);
  };
}
