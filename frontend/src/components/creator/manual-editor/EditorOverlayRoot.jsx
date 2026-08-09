import { forwardRef } from 'react';
import { needsInitialEditorGeometryFallback } from './editorGeometry.js';

const sampledStyle = (geometry) => ({
  left: `${geometry.visual.left}px`,
  top: `${geometry.visual.top}px`,
  width: `${geometry.visual.width}px`,
  height: `${geometry.visual.height}px`,
});

const initialStyle = {
  left: 0,
  top: 0,
  width: '100%',
  height: '100dvh',
};

const EditorOverlayRoot = forwardRef(function EditorOverlayRoot({ geometry }, ref) {
  const style = needsInitialEditorGeometryFallback(geometry)
    ? initialStyle
    : sampledStyle(geometry);
  return (
    <div
      ref={ref}
      data-editor-overlay-root="true"
      data-geometry-phase={geometry.phase}
      className="pointer-events-none fixed z-20 overflow-visible"
      style={{
        ...style,
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    />
  );
});

export default EditorOverlayRoot;
