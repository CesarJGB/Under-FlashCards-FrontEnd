import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { getMateriaTitleLayout } from '../lib/materiaTitleLayout.js';

let sharedCanvasContext = null;

function getCanvasContext() {
  if (sharedCanvasContext || typeof document === 'undefined') return sharedCanvasContext;
  sharedCanvasContext = document.createElement('canvas').getContext('2d');
  return sharedCanvasContext;
}

const INITIAL_LAYOUT = Object.freeze({
  state: 'dense',
  fontSizePx: 14,
  lineHeight: 1.12,
  maxLines: 2,
  showLabel: true,
  truncated: false,
});

export function useMateriaTitleLayout(name) {
  const regionRef = useRef(null);
  const frameRef = useRef(null);
  const lastWidthRef = useRef(0);
  const [layout, setLayout] = useState(INITIAL_LAYOUT);

  const calculateLayout = useCallback((availableWidth) => {
    const region = regionRef.current;
    const context = getCanvasContext();
    if (!region || !context || availableWidth <= 0) return;

    const { fontFamily } = window.getComputedStyle(region);
    const nextLayout = getMateriaTitleLayout({
      name,
      availableWidth,
      measureText: (text, fontSize) => {
        context.font = `900 ${fontSize}px ${fontFamily}`;
        return context.measureText(text).width;
      },
    });

    setLayout((current) => (
      current.state === nextLayout.state
      && current.fontSizePx === nextLayout.fontSizePx
      && current.showLabel === nextLayout.showLabel
      && current.truncated === nextLayout.truncated
        ? current
        : nextLayout
    ));
  }, [name]);

  const scheduleCalculation = useCallback((width = lastWidthRef.current) => {
    lastWidthRef.current = width;
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => calculateLayout(lastWidthRef.current));
  }, [calculateLayout]);

  useLayoutEffect(() => {
    const region = regionRef.current;
    if (!region) return undefined;

    let active = true;
    let observer;
    const handleWindowResize = () => scheduleCalculation(region.getBoundingClientRect().width);
    const initialWidth = region.getBoundingClientRect().width;

    lastWidthRef.current = initialWidth;
    calculateLayout(initialWidth);

    if (typeof ResizeObserver === 'function') {
      observer = new ResizeObserver(([entry]) => scheduleCalculation(entry.contentRect.width));
      observer.observe(region);
    } else {
      handleWindowResize();
      window.addEventListener('resize', handleWindowResize);
    }

    const handleFontsLoaded = () => {
      if (active) scheduleCalculation();
    };
    document.fonts?.addEventListener?.('loadingdone', handleFontsLoaded);
    document.fonts?.ready?.then(handleFontsLoaded);

    return () => {
      active = false;
      observer?.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      document.fonts?.removeEventListener?.('loadingdone', handleFontsLoaded);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [calculateLayout, scheduleCalculation]);

  return { regionRef, layout };
}
