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
import { acquireScrollLeaseGroup } from '../../lib/scrollLock';
import {
  createLayerInteractionState,
  focusConnectedTarget,
  getFocusableElements,
  getSharedOverlayRegistry,
} from './overlays/overlayRegistry';
import useEditorGeometry from '../creator/manual-editor/useEditorGeometry';
import { needsInitialEditorGeometryFallback } from '../creator/manual-editor/editorGeometry';
import { OverlayScope, useOverlayScope } from './OverlayScope';
import { installActionSheetGestureGuard } from './actionSheetGestureGuard';
import {
  ACTION_SHEET_SNAP_CLOSED,
  ACTION_SHEET_SNAP_COMPACT,
  ACTION_SHEET_SNAP_EXPANDED,
  canActivateActionSheetDrag,
  clampActionSheetTranslation,
  getActionSheetSnapGeometry,
  isActionSheetDragControl,
  resolveActionSheetRelease,
} from './actionSheetDrag';
import {
  createActionSheetInputFocusState,
  endActionSheetInputFocus,
  enterActionSheetInputFocus,
  isActionSheetInputTarget,
  observeActionSheetInputFocusGeometry,
  shouldKeepActionSheetInputFocus,
} from './actionSheetFocus';

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
  returnTarget: returnTargetOverride,
  ariaLabel,
  appearance = 'default',
  draggable = false,
  dragDisabled = false,
  initialSnap = ACTION_SHEET_SNAP_COMPACT,
  restoreSnapAfterInput = false,
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
  const frameRef = useRef(null);
  const releaseLeaseRef = useRef(null);
  const layerTokenRef = useRef(null);
  const returnTargetRef = useRef(null);
  const closedRef = useRef(false);
  const actionTriggeredRef = useRef(false);
  const pendingTransitionRef = useRef(null);
  const wasTopRef = useRef(false);
  const dragGestureRef = useRef(null);
  const suppressHandleClickRef = useRef(false);
  const inputFocusStateRef = useRef(null);
  const pendingInputBlurRef = useRef(null);
  if (inputFocusStateRef.current === null) {
    inputFocusStateRef.current = createActionSheetInputFocusState();
  }
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
  const [dragSnap, setDragSnap] = useState(initialSnap);
  const [dragTranslation, setDragTranslation] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasEntered, setHasEntered] = useState(!draggable);
  const ownGeometry = useEditorGeometry({ active: Boolean(open && !parentScope?.geometry) });
  const geometry = parentScope?.geometry || ownGeometry;
  const isInitialFallback = needsInitialEditorGeometryFallback(geometry);
  const portalTarget = typeof document !== 'undefined'
    ? (portalTargetOverride || parentScope?.portalTarget || document.body)
    : null;
  const isViewportPortal = Boolean(
    portalTarget
    && (portalTarget === document.body || portalTarget === document.documentElement)
  );
  const isTop = Boolean(open && (
    parentScope?.layerStack
      ? parentScope.layerStack.isTop(layerId)
      : sharedSnapshot.topId === layerId
  ));
  const interaction = createLayerInteractionState(isTop);

  useLayoutEffect(() => {
    if (!open || !draggable || typeof window === 'undefined') {
      setHasEntered(!draggable);
      inputFocusStateRef.current = createActionSheetInputFocusState();
      pendingInputBlurRef.current = null;
      return undefined;
    }
    setDragSnap(initialSnap);
    setDragTranslation(null);
    setIsDragging(false);
    dragGestureRef.current = null;
    suppressHandleClickRef.current = false;
    inputFocusStateRef.current = createActionSheetInputFocusState();
    pendingInputBlurRef.current = null;

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setHasEntered(true);
      return undefined;
    }

    setHasEntered(false);
    const frameId = window.requestAnimationFrame(() => setHasEntered(true));
    return () => {
      window.cancelAnimationFrame(frameId);
      dragGestureRef.current = null;
    };
  }, [draggable, initialSnap, open, restoreSnapAfterInput]);

  useLayoutEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    closedRef.current = false;
    actionTriggeredRef.current = false;
    pendingTransitionRef.current = null;
    returnTargetRef.current = returnTargetOverride?.isConnected === true
      ? returnTargetOverride
      : document.activeElement !== document.body
        ? document.activeElement
        : null;
    const token = openLayer({
      id: layerId,
      ownerId: parentScope?.hostLayerId || 'action-sheet-root',
      kind: 'sheet',
      focusPolicy: 'move-focus',
      returnTarget: returnTargetRef.current,
      replaceOwner: false,
      onDismiss(reason, dismissedToken) {
        if (closedRef.current) return;
        closedRef.current = true;
        const pendingTransition = pendingTransitionRef.current;
        pendingTransitionRef.current = null;
        onCloseRef.current?.(reason);
        if (
          reason === 'option-transition'
          && pendingTransition?.token === dismissedToken
        ) {
          pendingTransition.run();
        }
      },
    });
    layerTokenRef.current = token;

    return () => {
      closedRef.current = true;
      pendingTransitionRef.current = null;
      removeOwnerLayers?.(layerId, 'host-unmount');
      removeLayer?.(layerId, token, 'unmount');
      if (layerTokenRef.current === token) layerTokenRef.current = null;
      wasTopRef.current = false;
    };
  }, [layerId, open, openLayer, parentScope?.hostLayerId, removeLayer, removeOwnerLayers]);

  useLayoutEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    if (parentScope?.ownsModality) {
      const release = acquireScrollLeaseGroup({
        owner: `${layerId}-scope`,
        scrollRoots: isViewportPortal ? [document.documentElement, document.body] : [],
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
    const release = acquireScrollLeaseGroup({
      owner: layerId,
      scrollRoots: isViewportPortal
        ? [scrollRoot, document.documentElement, document.body]
        : [scrollRoot],
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
    isViewportPortal,
  ]);

  useLayoutEffect(() => {
    if (!open || !isTop || !frameRef.current) return undefined;
    return installActionSheetGestureGuard(frameRef.current);
  }, [isTop, open]);

  useLayoutEffect(() => {
    if (!open || !draggable || !restoreSnapAfterInput) return undefined;
    const transition = observeActionSheetInputFocusGeometry(
      inputFocusStateRef.current,
      geometry,
    );
    inputFocusStateRef.current = transition.state;
    if (transition.shouldExpand) {
      setDragSnap((current) => (
        current === ACTION_SHEET_SNAP_EXPANDED ? current : ACTION_SHEET_SNAP_EXPANDED
      ));
    }
    if (transition.restoreSnap) {
      setDragSnap((current) => (
        current === transition.restoreSnap ? current : transition.restoreSnap
      ));
    }
    return undefined;
  }, [draggable, geometry, open, restoreSnapAfterInput]);

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
  const availableSurfaceHeight = isInitialFallback
    ? Math.min(720, window.innerHeight || 720)
    : geometry.visual.height;
  const dragGeometry = getActionSheetSnapGeometry(availableSurfaceHeight);
  const settledTranslation = dragSnap === ACTION_SHEET_SNAP_EXPANDED
    ? dragGeometry.expandedOffset
    : dragGeometry.compactOffset;
  const currentTranslation = hasEntered
    ? (dragTranslation ?? settledTranslation)
    : dragGeometry.closedOffset;
  const resetDragGesture = () => {
    dragGestureRef.current = null;
    setDragTranslation(null);
    setIsDragging(false);
  };
  const handleDragPointerDown = (event) => {
    if (!draggable || dragDisabled || !isTop || !event.isPrimary || event.button > 0) return;
    const fromHandle = Boolean(event.target.closest?.('[data-action-sheet-drag-region="true"]'));
    const scrollRoot = event.target.closest?.('[data-action-sheet-scroll="true"]');
    const blockedControl = !fromHandle && isActionSheetDragControl(event.target);
    if (!fromHandle && (!scrollRoot || blockedControl)) return;

    dragGestureRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      velocityY: 0,
      originSnap: dragSnap,
      originOffset: settledTranslation,
      fromHandle,
      scrollRoot,
      blockedControl,
      active: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const handleDragPointerMove = (event) => {
    const gesture = dragGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId || dragDisabled) return;
    const deltaY = event.clientY - gesture.startY;
    if (!gesture.active) {
      gesture.active = canActivateActionSheetDrag({
        fromHandle: gesture.fromHandle,
        scrollTop: gesture.scrollRoot?.scrollTop || 0,
        deltaY,
        blockedControl: gesture.blockedControl,
      });
      if (!gesture.active) return;
      suppressHandleClickRef.current = true;
      setIsDragging(true);
    }

    const elapsed = Math.max(1, event.timeStamp - gesture.lastTime);
    gesture.velocityY = (event.clientY - gesture.lastY) / elapsed;
    gesture.lastY = event.clientY;
    gesture.lastTime = event.timeStamp;
    setDragTranslation(clampActionSheetTranslation(gesture.originOffset + deltaY, dragGeometry));
    event.preventDefault();
  };
  const handleDragPointerEnd = (event, cancelled = false) => {
    const gesture = dragGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (cancelled || !gesture.active || dragDisabled) {
      if (cancelled) suppressHandleClickRef.current = false;
      resetDragGesture();
      return;
    }

    const releaseVelocity = event.timeStamp - gesture.lastTime <= 80
      ? gesture.velocityY
      : 0;
    const destination = resolveActionSheetRelease({
      originSnap: gesture.originSnap,
      deltaY: event.clientY - gesture.startY,
      velocityY: releaseVelocity,
    });
    resetDragGesture();
    if (destination === ACTION_SHEET_SNAP_CLOSED) {
      dismissSelf('drag');
      return;
    }
    setDragSnap(destination);
  };
  const toggleDragSnap = () => {
    if (!draggable || dragDisabled) return;
    if (suppressHandleClickRef.current) {
      suppressHandleClickRef.current = false;
      return;
    }
    setDragSnap((current) => (
      current === ACTION_SHEET_SNAP_EXPANDED
        ? ACTION_SHEET_SNAP_COMPACT
        : ACTION_SHEET_SNAP_EXPANDED
    ));
  };
  const finishInputFocus = () => {
    pendingInputBlurRef.current = null;
    const transition = endActionSheetInputFocus(inputFocusStateRef.current);
    inputFocusStateRef.current = transition.state;
    if (transition.restoreSnap) {
      setDragSnap((current) => (
        current === transition.restoreSnap ? current : transition.restoreSnap
      ));
    }
  };
  const scheduleInputFocusEnd = (scrollRoot, blurredTarget) => {
    const pending = {};
    pendingInputBlurRef.current = pending;
    const run = () => {
      if (pendingInputBlurRef.current !== pending || !dialogRef.current?.isConnected) return;
      if (
        document.activeElement !== blurredTarget
        && shouldKeepActionSheetInputFocus({
          activeElement: document.activeElement,
          container: scrollRoot,
        })
      ) {
        const entered = enterActionSheetInputFocus(inputFocusStateRef.current, {
          currentSnap: dragSnap,
          controlId: document.activeElement?.id || null,
          geometry,
        });
        inputFocusStateRef.current = entered.state;
        if (entered.shouldExpand) setDragSnap(ACTION_SHEET_SNAP_EXPANDED);
        pendingInputBlurRef.current = null;
        return;
      }
      finishInputFocus();
    };
    if (typeof queueMicrotask === 'function') queueMicrotask(run);
    else Promise.resolve().then(run);
  };
  const handleInputFocus = (event) => {
    if (!isActionSheetInputTarget(event.target)) return;
    pendingInputBlurRef.current = null;
    if (!restoreSnapAfterInput) {
      setDragSnap(ACTION_SHEET_SNAP_EXPANDED);
      return;
    }
    const entered = enterActionSheetInputFocus(inputFocusStateRef.current, {
      currentSnap: dragSnap,
      controlId: event.target.id || event.target.name || null,
      geometry,
    });
    inputFocusStateRef.current = entered.state;
    if (entered.shouldExpand) setDragSnap(ACTION_SHEET_SNAP_EXPANDED);
  };
  const handleInputBlur = (event) => {
    if (!restoreSnapAfterInput || !isActionSheetInputTarget(event.target)) return;
    const scrollRoot = event.currentTarget;
    if (shouldKeepActionSheetInputFocus({
      relatedTarget: event.relatedTarget,
      container: scrollRoot,
    })) return;
    scheduleInputFocusEnd(scrollRoot, event.target);
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
  const frameStyle = isViewportPortal
    ? { left: 0, right: 0, bottom: 0, height: '100dvh' }
    : { inset: 0 };
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
      ref={frameRef}
      className={`${isViewportPortal ? 'fixed' : 'absolute'} z-[90] isolate overflow-hidden overscroll-none ${isTop ? 'pointer-events-auto' : 'pointer-events-none'}`}
      style={frameStyle}
      data-action-sheet-layer={layerId}
      data-action-sheet-top={isTop ? 'true' : 'false'}
      data-action-sheet-geometry={geometry.source}
      data-action-sheet-scale={geometry.visual.scale}
      data-action-sheet-anchor={isViewportPortal ? 'viewport' : 'scope'}
      data-action-sheet-draggable={draggable ? 'true' : 'false'}
      data-action-sheet-restore-input-snap={restoreSnapAfterInput ? 'true' : 'false'}
    >
      <div
        role="presentation"
        aria-hidden="true"
        className={`absolute inset-0 z-0 touch-none cursor-default animate-[fadeIn_0.25s_ease-out] ${appearance === 'auth' ? 'bg-violet-950/35 backdrop-blur-[2px]' : 'bg-slate-900/40'}`}
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
        aria-label={title ? undefined : (ariaLabel || 'Acciones')}
        inert={interaction.inert}
        tabIndex={-1}
        onPointerDown={draggable ? handleDragPointerDown : undefined}
        onPointerMove={draggable ? handleDragPointerMove : undefined}
        onPointerUp={draggable ? (event) => handleDragPointerEnd(event) : undefined}
        onPointerCancel={draggable ? (event) => handleDragPointerEnd(event, true) : undefined}
        className={`absolute inset-x-0 bottom-0 z-10 flex flex-col overflow-hidden overscroll-none outline-none ${
          appearance === 'auth'
            ? 'rounded-t-[2rem] bg-white shadow-[0_-18px_60px_rgba(46,16,101,0.2)]'
            : 'rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900'
        } ${draggable ? `will-change-transform ${isDragging ? 'transition-none' : 'transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none'}` : ''}`}
        style={{
          animation: draggable ? undefined : 'slideUp 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
          maxHeight: maxSurfaceHeight,
          height: draggable ? `${dragGeometry.expandedHeight}px` : undefined,
          transform: draggable ? `translate3d(0, ${currentTranslation}px, 0)` : undefined,
          left: 'env(safe-area-inset-left, 0px)',
          right: 'env(safe-area-inset-right, 0px)',
        }}
        data-action-sheet-snap={draggable ? dragSnap : undefined}
        data-action-sheet-dragging={isDragging ? 'true' : 'false'}
      >
        {draggable ? (
          <div className="shrink-0 touch-none select-none px-4 pt-2" data-action-sheet-drag-region="true">
            <button
              type="button"
              onClick={toggleDragSnap}
              disabled={dragDisabled}
              aria-label={dragSnap === ACTION_SHEET_SNAP_EXPANDED ? 'Contraer panel' : 'Expandir panel'}
              className="mx-auto flex h-9 w-20 cursor-grab items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 disabled:cursor-not-allowed disabled:opacity-50 active:cursor-grabbing"
              data-action-sheet-drag-region="true"
              data-action-sheet-handle="true"
            >
              <span className="h-1.5 w-12 rounded-full bg-slate-300" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="flex touch-none select-none justify-center pt-3 pb-4" aria-hidden="true" data-action-sheet-handle="true">
            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
          </div>
        )}

        {title && (
          <h2 id={titleId} className="touch-none select-none px-4 pb-2 text-center text-sm font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500" data-action-sheet-title="true">
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
            className={`min-h-0 flex-1 overflow-y-auto overscroll-none ${appearance === 'auth' ? 'px-5 sm:px-6' : 'px-4'} ${hasFooter ? 'pb-2' : 'pb-[calc(1.25rem+env(safe-area-inset-bottom))]'}`}
            style={{ WebkitOverflowScrolling: 'touch' }}
            data-action-sheet-scroll="true"
            onFocusCapture={draggable ? handleInputFocus : undefined}
            onBlurCapture={draggable && restoreSnapAfterInput ? handleInputBlur : undefined}
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
                        if (option.disabled || actionTriggeredRef.current) return;
                        actionTriggeredRef.current = true;
                        option.onSelect?.();
                        if (typeof option.onAfterClose === 'function') {
                          pendingTransitionRef.current = {
                            token: layerTokenRef.current,
                            run: option.onAfterClose,
                          };
                          if (!dismissSelf('option-transition')) {
                            pendingTransitionRef.current = null;
                          }
                          return;
                        }
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
            <div className="shrink-0 touch-none border-t border-slate-200/70 px-4 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] dark:border-slate-700/70" data-action-sheet-footer="true">
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
