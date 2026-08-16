export const ACTION_SHEET_SNAP_COMPACT = 'compact';
export const ACTION_SHEET_SNAP_EXPANDED = 'expanded';
export const ACTION_SHEET_SNAP_CLOSED = 'closed';

const DRAG_ACTIVATION_DISTANCE = 6;
const SNAP_DISTANCE = 48;
const CLOSE_DISTANCE = 84;
const SNAP_VELOCITY = 0.45;
const SCROLL_EPSILON = 1;

export function getActionSheetSnapGeometry(availableHeight) {
  const expandedHeight = Math.max(1, Math.min(720, Number(availableHeight) || 720));
  const preferredCompactHeight = Math.min(520, expandedHeight * 0.78);
  const compactHeight = Math.min(expandedHeight, Math.max(360, preferredCompactHeight));
  return {
    expandedHeight,
    compactHeight,
    expandedOffset: 0,
    compactOffset: Math.max(0, expandedHeight - compactHeight),
    closedOffset: expandedHeight + 24,
  };
}

export function clampActionSheetTranslation(value, geometry) {
  return Math.max(geometry.expandedOffset, Math.min(geometry.closedOffset, value));
}

export function isActionSheetDragControl(target) {
  return Boolean(target?.closest?.(
    'input, textarea, select, button, a, [contenteditable="true"], [data-action-sheet-no-drag="true"]',
  ));
}

export function canActivateActionSheetDrag({
  fromHandle,
  scrollTop,
  deltaY,
  blockedControl,
}) {
  if (blockedControl || Math.abs(deltaY) < DRAG_ACTIVATION_DISTANCE) return false;
  if (fromHandle) return true;
  return deltaY > 0 && scrollTop <= SCROLL_EPSILON;
}

export function resolveActionSheetRelease({
  originSnap,
  deltaY,
  velocityY,
}) {
  const fastUp = velocityY <= -SNAP_VELOCITY;
  const fastDown = velocityY >= SNAP_VELOCITY;

  if (originSnap === ACTION_SHEET_SNAP_EXPANDED) {
    if (deltaY >= SNAP_DISTANCE || fastDown) return ACTION_SHEET_SNAP_COMPACT;
    return ACTION_SHEET_SNAP_EXPANDED;
  }

  if (deltaY >= CLOSE_DISTANCE || (fastDown && deltaY > SNAP_DISTANCE / 2)) {
    return ACTION_SHEET_SNAP_CLOSED;
  }
  if (deltaY <= -SNAP_DISTANCE || fastUp) return ACTION_SHEET_SNAP_EXPANDED;
  return ACTION_SHEET_SNAP_COMPACT;
}
