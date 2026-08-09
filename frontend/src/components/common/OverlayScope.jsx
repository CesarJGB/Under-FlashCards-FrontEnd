import {
  createContext,
  forwardRef,
  useContext,
  useMemo,
} from 'react';
import { createPortal } from 'react-dom';

const OverlayScopeContext = createContext(null);

export function OverlayScope({ portalTarget, layerStack, bounds, children }) {
  const value = useMemo(
    () => ({ portalTarget, layerStack, bounds }),
    [bounds, layerStack, portalTarget],
  );
  return (
    <OverlayScopeContext.Provider value={value}>
      {children}
    </OverlayScopeContext.Provider>
  );
}

export function useOverlayScope() {
  return useContext(OverlayScopeContext);
}

export const OverlayPortal = forwardRef(function OverlayPortal({
  layerId,
  onClose,
  backdropTestId,
  className = '',
  style,
  children,
  onKeyDown,
  ...contentProps
}, forwardedRef) {
  const scope = useOverlayScope();
  const target = scope?.portalTarget
    || (typeof document !== 'undefined' ? document.body : null);
  if (!target) return null;

  const scoped = Boolean(scope?.portalTarget && scope?.layerStack && layerId);
  const layerProps = scoped ? scope.layerStack.getLayerProps(layerId) : {};
  const setContentRef = (node) => {
    layerProps.ref?.(node);
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };
  const dismiss = (reason) => {
    if (scoped) {
      if (scope.layerStack.isTop(layerId)) scope.layerStack.dismissTop(reason);
      return;
    }
    onClose?.(reason);
  };

  return createPortal(
    <>
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        data-testid={backdropTestId}
        className={`${scoped ? 'absolute' : 'fixed'} inset-0 z-0 cursor-default bg-transparent pointer-events-auto`}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          dismiss('backdrop');
        }}
      />
      <div
        {...contentProps}
        {...layerProps}
        ref={setContentRef}
        className={`pointer-events-auto z-10 ${className}`}
        style={style}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (!scoped && !event.defaultPrevented && event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            dismiss('escape');
          }
        }}
      >
        {children}
      </div>
    </>,
    target,
  );
});
