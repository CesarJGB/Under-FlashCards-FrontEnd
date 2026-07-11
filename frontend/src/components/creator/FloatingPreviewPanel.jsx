import { useState, useRef, useEffect, useCallback } from 'react';
import { Move, Minimize2, Maximize2, X } from 'lucide-react';
import { getJSON, setJSON } from '../../lib/safeLocalStorage';
import LivePreview from './LivePreview';

const STORAGE_KEY = 'ufc_preview_panel_v1';
const MIN_W = 240;
const MIN_H = 260;
const VIEWPORT_GUTTER = 8;
const BUBBLE = 60;
const DRAG_THRESHOLD = 5;

function loadPanelState() {
  const parsed = getJSON(STORAGE_KEY);
  if (parsed && typeof parsed === 'object') {
    return {
      mode: parsed.mode === 'floating' || parsed.mode === 'minimized' ? parsed.mode : 'docked',
      x: typeof parsed.x === 'number' ? parsed.x : 16,
      y: typeof parsed.y === 'number' ? parsed.y : 120,
      width: typeof parsed.width === 'number' ? parsed.width : 320,
      height: typeof parsed.height === 'number' ? parsed.height : 420,
    };
  }

  return { mode: 'docked', x: 16, y: 120, width: 320, height: 420 };
}

function clampPos(x, y, w, h) {
  if (typeof window === 'undefined') return { x, y };

  const maxX = Math.max(VIEWPORT_GUTTER, window.innerWidth - w - VIEWPORT_GUTTER);
  const maxY = Math.max(VIEWPORT_GUTTER, window.innerHeight - h - VIEWPORT_GUTTER);

  return {
    x: Math.min(Math.max(VIEWPORT_GUTTER, x), maxX),
    y: Math.min(Math.max(VIEWPORT_GUTTER, y), maxY),
  };
}

function clampFloatingFrame(x, y, width, height) {
  if (typeof window === 'undefined') return { x, y, width, height };

  const maxWidth = Math.max(160, window.innerWidth - VIEWPORT_GUTTER * 2);
  const maxHeight = Math.max(180, window.innerHeight - VIEWPORT_GUTTER * 2);
  const minWidth = Math.min(MIN_W, maxWidth);
  const minHeight = Math.min(MIN_H, maxHeight);
  const nextWidth = Math.min(Math.max(minWidth, width), maxWidth);
  const nextHeight = Math.min(Math.max(minHeight, height), maxHeight);
  const nextPos = clampPos(x, y, nextWidth, nextHeight);

  return { ...nextPos, width: nextWidth, height: nextHeight };
}

function clampPanelByMode(panel) {
  if (panel.mode === 'minimized') {
    const nextPos = clampPos(panel.x, panel.y, BUBBLE, BUBBLE);
    return { ...panel, ...nextPos };
  }

  if (panel.mode === 'floating') {
    return { ...panel, ...clampFloatingFrame(panel.x, panel.y, panel.width, panel.height) };
  }

  return panel;
}

export default function FloatingPreviewPanel(props) {
  const [panel, setPanel] = useState(loadPanelState);
  const panelRef = useRef(panel);
  panelRef.current = panel;

  useEffect(() => {
    setJSON(STORAGE_KEY, panel);
  }, [panel]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setPanel((prev) => clampPanelByMode(prev));

    const onResize = () => {
      setPanel((prev) => clampPanelByMode(prev));
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  const setMode = (mode) => {
    setPanel((prev) => {
      if (mode === 'floating') {
        return { ...prev, mode, ...clampFloatingFrame(prev.x, prev.y, prev.width, prev.height) };
      }

      if (mode === 'minimized') {
        return { ...prev, mode, ...clampPos(prev.x, prev.y, BUBBLE, BUBBLE) };
      }

      return { ...prev, mode };
    });
  };

  const handleDragStart = useCallback((e, onTap) => {
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const originX = panelRef.current.x;
    const originY = panelRef.current.y;
    const mode = panelRef.current.mode;
    const width = mode === 'minimized' ? BUBBLE : panelRef.current.width;
    const height = mode === 'minimized' ? BUBBLE : panelRef.current.height;
    let moved = false;

    const onMove = (moveEvt) => {
      const dx = moveEvt.clientX - startX;
      const dy = moveEvt.clientY - startY;
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) moved = true;
      const nextPos = clampPos(originX + dx, originY + dy, width, height);
      setPanel((prev) => ({ ...prev, ...nextPos }));
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (!moved && onTap) onTap();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }, []);

  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const originW = panelRef.current.width;
    const originH = panelRef.current.height;
    const originX = panelRef.current.x;
    const originY = panelRef.current.y;

    const onMove = (moveEvt) => {
      const dx = moveEvt.clientX - startX;
      const dy = moveEvt.clientY - startY;
      const nextFrame = clampFloatingFrame(originX, originY, originW + dx, originH + dy);
      setPanel((prev) => ({ ...prev, width: nextFrame.width, height: nextFrame.height }));
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }, []);

  if (panel.mode === 'docked') {
    return (
      <div>
        <div className="flex justify-end mb-1">
          <button
            type="button"
            onClick={() => setMode('floating')}
            title="Convertir en panel flotante"
            className="flex items-center gap-1 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full shadow-sm hover:bg-slate-800 active:scale-95 transition-transform"
          >
            <Maximize2 className="w-3 h-3" /> Flotante
          </button>
        </div>
        <LivePreview {...props} />
      </div>
    );
  }

  if (panel.mode === 'minimized') {
    return (
      <button
        type="button"
        onPointerDown={(e) => handleDragStart(e, () => setMode('floating'))}
        style={{ position: 'fixed', left: panel.x, top: panel.y, width: BUBBLE, height: BUBBLE, touchAction: 'none' }}
        className="z-[45] rounded-full bg-slate-900 text-white shadow-xl flex items-center justify-center border-2 border-white/20 active:scale-95 transition-transform select-none"
        title="Mostrar previsualización"
      >
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
      </button>
    );
  }

  return (
    <div
      style={{ position: 'fixed', left: panel.x, top: panel.y, width: panel.width, height: panel.height, touchAction: 'none' }}
      className="z-[45] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 select-none"
    >
      <div
        onPointerDown={(e) => handleDragStart(e)}
        className="flex items-center justify-between px-2 py-1.5 bg-slate-900 text-white shrink-0 cursor-grab active:cursor-grabbing rounded-t-2xl"
        style={{ touchAction: 'none' }}
      >
        <div className="flex items-center gap-1.5 px-1">
          <Move className="w-3.5 h-3.5 opacity-70" />
          <span className="text-[10px] font-bold uppercase tracking-wide opacity-90">Preview</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setMode('minimized')}
            title="Minimizar"
            className="p-1.5 rounded-lg hover:bg-white/10"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setMode('docked')}
            title="Volver a la vista normal"
            className="p-1.5 rounded-lg hover:bg-white/10"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain rounded-b-2xl bg-white" style={{ touchAction: 'pan-y' }}>
        <LivePreview {...props} />
      </div>

      <div
        onPointerDown={handleResizeStart}
        className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize flex items-end justify-end p-1"
        style={{ touchAction: 'none' }}
      >
        <div className="w-2.5 h-2.5 border-r-2 border-b-2 border-slate-300 rounded-br" />
      </div>
    </div>
  );
}
