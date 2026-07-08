import { useEffect } from 'react';

// Simple owner-based body scroll lock utility.
// Multiple callers can request the lock; only when the last owner releases it
// we restore the original body styles.

const isClient = typeof document !== 'undefined' && typeof window !== 'undefined';
let owners = new Set();
let originalOverflow = '';
let originalOverscrollBehavior = '';

export function lockBodyScroll(owner = 'default') {
  if (!isClient) return;
  if (owners.size === 0) {
    // store original values once
    originalOverflow = document.body.style.overflow;
    originalOverscrollBehavior = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
  }
  owners.add(owner);
}

export function unlockBodyScroll(owner = 'default') {
  if (!isClient) return;
  owners.delete(owner);
  if (owners.size === 0) {
    // restore when no owners remain
    document.body.style.overflow = originalOverflow || '';
    document.body.style.overscrollBehavior = originalOverscrollBehavior || '';
    originalOverflow = '';
    originalOverscrollBehavior = '';
  }
}

// Hook convenience wrapper
export function useBodyScrollLock(active = true, owner = 'default') {
  useEffect(() => {
    if (!active) return;
    lockBodyScroll(owner);
    return () => unlockBodyScroll(owner);
  }, [active, owner]);
}

export function isBodyScrollLocked() {
  return owners.size > 0;
}
