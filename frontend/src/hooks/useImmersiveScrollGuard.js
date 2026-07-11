import { useEffect, useRef } from 'react';
import { useBodyScrollLock } from '../lib/scrollLock';

const IMMERSIVE_ALLOW_SCROLL_SELECTOR = '[data-immersive-allow-scroll="true"]';
const isClient = typeof document !== 'undefined';

let immersiveOwners = new Set();
let originalHtmlOverflow = '';
let originalHtmlOverscroll = '';
let originalBodyOverscroll = '';
let preventViewportScrollRef = null;

function isAllowedScrollTarget(target) {
  const element = target instanceof Element ? target : target?.parentElement;
  return !!element?.closest(IMMERSIVE_ALLOW_SCROLL_SELECTOR);
}

function lockImmersiveViewport(owner) {
  if (!isClient) return;

  if (immersiveOwners.size === 0) {
    const html = document.documentElement;
    const body = document.body;

    originalHtmlOverflow = html.style.overflow;
    originalHtmlOverscroll = html.style.overscrollBehavior;
    originalBodyOverscroll = body.style.overscrollBehavior;

    html.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    body.style.overscrollBehavior = 'none';

    preventViewportScrollRef = (event) => {
      if (isAllowedScrollTarget(event.target)) return;
      if (event.cancelable) event.preventDefault();
    };

    document.addEventListener('wheel', preventViewportScrollRef, { passive: false });
    document.addEventListener('touchmove', preventViewportScrollRef, { passive: false });
  }

  immersiveOwners.add(owner);
}

function unlockImmersiveViewport(owner) {
  if (!isClient) return;

  immersiveOwners.delete(owner);

  if (immersiveOwners.size === 0) {
    const html = document.documentElement;
    const body = document.body;

    if (preventViewportScrollRef) {
      document.removeEventListener('wheel', preventViewportScrollRef);
      document.removeEventListener('touchmove', preventViewportScrollRef);
      preventViewportScrollRef = null;
    }

    html.style.overflow = originalHtmlOverflow || '';
    html.style.overscrollBehavior = originalHtmlOverscroll || '';
    body.style.overscrollBehavior = originalBodyOverscroll || '';

    originalHtmlOverflow = '';
    originalHtmlOverscroll = '';
    originalBodyOverscroll = '';
  }
}

export default function useImmersiveScrollGuard(active = true, owner = 'immersive-mode') {
  const ownerRef = useRef(`${owner || 'immersive-mode'}_${Math.random().toString(36).slice(2, 9)}`);

  useBodyScrollLock(active, ownerRef.current);

  useEffect(() => {
    if (!active) return;

    lockImmersiveViewport(ownerRef.current);
    return () => unlockImmersiveViewport(ownerRef.current);
  }, [active]);
}
