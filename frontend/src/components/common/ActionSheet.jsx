// FILE: frontend/src/components/common/ActionSheet.jsx
import {
  isValidElement,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { acquireScrollLease } from '../../lib/scrollLock';
import {
  createLayerInteractionState,
  focusConnectedTarget,
  getFocusableElements,
  getSharedOverlayRegistry,
} from './overlays/overlayRegistry';
import useEditorGeometry from '../creator/manual-editor/useEditorGeometry';
import { needsInitialEditorGeometryFallback } from '../creator/manual-editor/editorGeometry';
import { OverlayScope, useOverlayScope } from './OverlayScope';

const EMPTY_SNAPSHOT = Object.freeze({ layers: [], topId: null, nextOrder: 1 });
const EMPTY_SUBSCRIBE = () => () => {};

export default function ActionSheet({
  open,
  title,
  options,
  onClose,
  selectedId,
  compact = false,
  children,
  content,
  footer,
  closeAction,
  portalTarget: portalTargetOverride,
}) {
  const parentScope = useOverlayScope();
  const sharedRegistryRef = useRef(null);
  if (sharedRegistryRef.current === null) sharedRegistryRef.current = getSharedOverlayRegistry();
  const sharedRegistry = sharedRegistryRef.current;
  const subscribeShared = open && !parentScope?.layerStack
    ? sharedRegistry.subscribe
    : EMPTY_SUBSCRIBE;
  const sharedSnapshot = useSyncExternalStore(
    subscribeShared,
    sharedRegistry.getSnapshot,
    () => EMPTY_SNAPSHOT,
  );
  const layerStack = parentScope?.layerStack || sharedRegistry;
  const openLayer = layerStack.openLayer;
  const removeLayer = layerStack.removeLayer;
  const removeOwnerLayers = layerStack.removeOwnerLayers;
  const dismissLayer = layerStack.dismissLayer;
  const dismissTop = layerStack.dismissTop;
  const consumePendingFocus = layerStack.consumePendingFocus;
  const getLayerSnapshot = layerStack.getSnapshot;
  const dialogRef = useRef(null);
  const releaseLeaseRef = useRef(null);
  const layerTokenRef = useRef(null);
  const returnTargetRef = useRef(null);
  const closedRef = useRef(false);
  const wasTopRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const id = useId();
  const layerIdRef = useRef(null);
  if (layerIdRef.current === null) {
    layerIdRef.current = `action-sheet-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  }
  const layerId = layerIdRef.current;
  const titleId = `${layerId}-title`;
  const [overlayRoot, setOverlayRoot] = useState(null);
  const ownGeometry = useEditorGeometry({ active: Boolean(open && !parentScope?.geometry) });
  const geometry = parentScope?.geometry || ownGeometry;
  const isInitialFallback = needsInitialEditorGeometryFallback(geometry);
  const isTop = Boolean(open && (
    parentScope?.layerStack
      ? parentScope.layerStack.isTop(layerId)
      : sharedSnapshot.topId === layerId
  ));
  const interaction = createLayerInteractionState(isTop);

  useLayoutEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    closedRef.current = false;
    returnTargetRef.current = document.activeElement !== document.body
      ? document.activeElement
      : null;
    const token = openLayer({
      id: layerId,
      ownerId: parentScope?.hostLayerId || 'action-sheet-root',
      kind: 'sheet',
      focusPolicy: 'move-focus',
      returnTarget: returnTargetRef.current,
      replaceOwner: false,
      onDismiss(reason) {
        if (closedRef.current) return;
        closedRef.current = true;
        onCloseRef.current?.(reason);
      },
    });
    layerTokenRef.current = token;

    return () => {
      closedRef.current = true;
      removeOwnerLayers?.(layerId, 'host-unmount');
      removeLayer?.(layerId, token, 'unmount');
      if (layerTokenRef.current === token) layerTokenRef.current = null;
      wasTopRef.current = false;
    };
  }, [layerId, open, openLayer, parentScope?.hostLayerId, removeLayer, removeOwnerLayers]);

  useLayoutEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    if (parentScope?.ownsModality) {
      const release = acquireScrollLease({
        owner: `${layerId}-scope`,
        inertRoot: parentScope.modalContentRef?.current,
      });
      releaseLeaseRef.current = release;
      return () => {
        release();
        if (releaseLeaseRef.current === release) releaseLeaseRef.current = null;
        focusConnectedTarget(returnTargetRef.current);
      };
    }
    const scrollRoot = document.querySelector('[data-app-scroll-root]') || document.body;
    if (!document.querySelector('[data-app-scroll-root]') && import.meta.env?.DEV) {
      console.warn('[ActionSheet] data-app-scroll-root ausente; se usa body como fallback.');
    }
    const release = acquireScrollLease({
      owner: layerId,
      scrollRoot,
      inertRoot: document.getElementById('root'),
    });
    releaseLeaseRef.current = release;
    return () => {
      release();
      if (releaseLeaseRef.current === release) releaseLeaseRef.current = null;
      if (!getLayerSnapshot?.().topId) {
        const pending = consumePendingFocus?.('__root__') || returnTargetRef.current;
        focusConnectedTarget(pending);
      }
    };
  }, [
    consumePendingFocus,
    getLayerSnapshot,
    layerId,
    open,
    parentScope?.modalContentRef,
    parentScope?.ownsModality,
  ]);

  useLayoutEffect(() => {
    if (!open || !isTop) {
      wasTopRef.current = false;
      return;
    }
    if (wasTopRef.current) return;
    wasTopRef.current = true;
    const pending = consumePendingFocus?.(layerId);
    if (focusConnectedTarget(pending)) return;
    const firstAction = dialogRef.current?.querySelector('[data-action-sheet-action="true"]')
      || getFocusableElements(dialogRef.current)[0]
      || dialogRef.current;
    focusConnectedTarget(firstAction);
  }, [consumePendingFocus, isTop, layerId, open]);

  if (!open || typeof document === 'undefined') return null;

  const portalTarget = portalTargetOverride || parentScope?.portalTarget || document.body;
  if (!portalTarget) return null;
  const actionOptions = Array.isArray(options) ? options : [];
  const isSelectable = selectedId !== undefined;
  const customContent = children ?? content;
  const hasCustomContent = customContent !== undefined && customContent !== null;
  const hasFooter = Boolean(footer || closeAction);
  const dismissSelf = (reason) => {
    if (!isTop) return false;
    return dismissLayer?.(layerId, layerTokenRef.current, reason)
      ?? dismissTop?.(reason)
      ?? false;
  };
  const closeControl = closeAction && !isValidElement(closeAction) ? (
    <button
      type="button"
      data-action-sheet-action="true"
      onClick={() => {
        closeAction?.onClick?.();
        dismissSelf('close-action');
      }}
      className="min-h-11 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800 active:scale-[0.99] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
    >
      {typeof closeAction === 'string' ? closeAction : (closeAction?.label || 'Cerrar')}
    </button>
  ) : closeAction;
  const frameStyle = isInitialFallback
    ? { left: 0, top: 0, width: '100%', height: '100dvh' }
    : {
      left: `${geometry.visual.left}px`,
      top: `${geometry.visual.top}px`,
      width: `${geometry.visual.width}px`,
      height: `${geometry.visual.height}px`,
    };
  const maxSurfaceHeight = isInitialFallback
    ? 'min(100dvh, 720px)'
    : `${Math.max(1, Math.min(720, geometry.visual.height))}px`;
  const layerProps = layerStack.getLayerProps?.(layerId) || {};
  const setDialogRef = (node) => {
    dialogRef.current = node;
    layerProps.ref?.(node);
  };

  return createPortal(
    <div
      className={`fixed z-[90] isolate overflow-hidden ${isTop ? 'pointer-events-auto' : 'pointer-events-none'}`}
      style={frameStyle}
      data-action-sheet-layer={layerId}
      data-action-sheet-top={isTop ? 'true' : 'false'}
      data-action-sheet-geometry={geometry.source}
      data-action-sheet-scale={geometry.visual.scale}
    >
      <div
        role="presentation"
        aria-hidden="true"
        className="absolute inset-0 z-0 cursor-default bg-slate-900/40 animate-[fadeIn_0.25s_ease-out]"
        onPointerDown={(event) => {
          if (!isTop) return;
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={(event) => {
          if (!isTop) return;
          event.preventDefault();
          event.stopPropagation();
          dismissSelf('backdrop');
        }}
        data-action-sheet-backdrop="true"
      />

      <section
        {...layerProps}
        ref={setDialogRef}
        role="dialog"
        aria-modal={isTop ? 'true' : undefined}
        aria-hidden={interaction.ariaHidden}
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : 'Acciones'}
        inert={interaction.inert}
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 z-10 flex flex-col rounded-t-3xl bg-white shadow-2xl outline-none dark:bg-slate-900"
        style={{
          animation: 'slideUp 0.4s cubic-bezier(0.32, 0.72, 0, 1) forwards',
          maxHeight: maxSurfaceHeight,
          left: 'env(safe-area-inset-left, 0px)',
          right: 'env(safe-area-inset-right, 0px)',
        }}
      >
        <div className="flex justify-center pt-3 pb-4" aria-hidden="true">
          <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>

        {title && (
          <h2 id={titleId} className="px-4 pb-2 text-center text-sm font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {title}
          </h2>
        )}

        <OverlayScope
          portalTarget={overlayRoot}
          layerStack={layerStack}
          bounds={geometry.visual}
          geometry={geometry}
          hostLayerId={layerId}
          ownsModality
          modalContentRef={dialogRef}
        >
          <div
            className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 ${hasFooter ? 'pb-2' : 'pb-[calc(1.25rem+env(safe-area-inset-bottom))]'}`}
            style={{ WebkitOverflowScrolling: 'touch' }}
            data-action-sheet-scroll="true"
          >
            {hasCustomContent && customContent}

            {actionOptions.length > 0 && (
              <div className={`flex flex-col gap-2.5 ${hasCustomContent ? 'mt-3' : ''}`}>
                {actionOptions.map((option, index) => {
                  if (!option) return null;
                  const Icon = option.icon;
                  const isSelected = isSelectable && option.id === selectedId;
                  const isPrimary = isSelectable ? isSelected : index === 0;
                  const isDanger = Boolean(option.danger);
                  let optionClasses = 'bg-slate-50 border border-slate-200 hover:shadow-md dark:bg-slate-800 dark:border-slate-700';
                  if (isPrimary) {
                    optionClasses = 'bg-gradient-to-br from-indigo-100 to-violet-100 border-2 border-indigo-200 shadow-lg shadow-indigo-200/50 hover:shadow-xl dark:from-indigo-500/20 dark:to-violet-500/20 dark:border-indigo-400/40';
                  }
                  if (isDanger) {
                    optionClasses = 'bg-gradient-to-br from-red-50 to-rose-100 border-2 border-red-200 shadow-lg shadow-red-200/50 hover:shadow-xl dark:from-red-500/15 dark:to-rose-500/15 dark:border-red-400/40';
                  }
                  const iconColor = isDanger ? 'text-red-600 dark:text-red-300' : (isPrimary ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-200');
                  const descColor = isDanger ? 'text-red-700 dark:text-red-300' : (isPrimary ? 'text-slate-700 dark:text-slate-300' : 'text-slate-600 dark:text-slate-400');

                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={option.disabled}
                      data-action-sheet-action="true"
                      onClick={() => {
                        if (option.disabled) return;
                        option.onSelect?.();
                        dismissSelf('option');
                      }}
                      className={`w-full min-h-11 rounded-3xl ${compact ? 'p-4' : 'p-5'} text-left active:scale-[0.98] transition-all duration-200 motion-reduce:transition-none disabled:opacity-50 ${optionClasses}`}
                      style={{ animation: `cardIn 0.35s cubic-bezier(0.32, 0.72, 0, 1) ${0.08 + index * 0.06}s both` }}
                    >
                      <div className="flex items-center gap-4">
                        {Icon && (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-slate-950">
                            {isValidElement(Icon)
                              ? Icon
                              : <Icon className={`w-6 h-6 ${iconColor}`} aria-hidden="true" />}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className={`${compact ? 'text-base' : 'text-lg'} mb-1 font-bold leading-tight text-slate-900 dark:text-white`}>{option.label}</h3>
                          {option.description && <p className={`text-sm leading-snug ${descColor}`}>{option.description}</p>}
                        </div>
                        {isSelected && <Check className="w-5 h-5 text-indigo-600 stroke-[2.5] flex-shrink-0" aria-hidden="true" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {hasFooter && (
            <div className="shrink-0 border-t border-slate-200/70 px-4 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] dark:border-slate-700/70">
              {footer || closeControl}
            </div>
          )}
        </OverlayScope>
      </section>

      <div
        ref={setOverlayRoot}
        className="pointer-events-none absolute inset-0 z-20 overflow-visible"
        data-action-sheet-overlay-root="true"
      />
    </div>,
    portalTarget,
  );
}
