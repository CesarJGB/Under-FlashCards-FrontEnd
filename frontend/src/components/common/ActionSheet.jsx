// FILE: frontend/src/components/common/ActionSheet.jsx
import { isValidElement, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { useBodyScrollLock } from '../../lib/scrollLock';

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
  preserveFocus = false,
}) {
  const dialogRef = useRef(null);
  const id = useId();
  const titleId = `${id}-title`;

  useBodyScrollLock(Boolean(open), `action-sheet-${id}`);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
        return;
      }
      if (event.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement;
    const focusTimer = preserveFocus
      ? null
      : window.setTimeout(() => dialogRef.current?.focus(), 0);

    return () => {
      if (focusTimer) window.clearTimeout(focusTimer);
      if (
        previouslyFocused instanceof HTMLElement
        && document.activeElement !== previouslyFocused
        && previouslyFocused.isConnected
      ) {
        try {
          previouslyFocused.focus({ preventScroll: true });
        } catch {
          previouslyFocused.focus();
        }
      }
    };
  }, [open, preserveFocus]);

  if (!open || typeof document === 'undefined') return null;

  const actionOptions = Array.isArray(options) ? options : [];
  const isSelectable = selectedId !== undefined;
  const customContent = children ?? content;
  const hasCustomContent = customContent !== undefined && customContent !== null;
  const hasFooter = Boolean(footer || closeAction);
  const closeControl = closeAction && !isValidElement(closeAction) ? (
    <button
      type="button"
      onClick={() => {
        closeAction?.onClick?.();
        onClose?.();
      }}
      className="min-h-11 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800 active:scale-[0.99] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
    >
      {typeof closeAction === 'string' ? closeAction : (closeAction?.label || 'Cerrar')}
    </button>
  ) : closeAction;

  return createPortal(
    <>
      <button
        type="button"
        onPointerDown={(event) => {
          event.preventDefault();
          onClose?.();
        }}
        className="fixed inset-0 z-[90] cursor-default bg-slate-900/40 animate-[fadeIn_0.25s_ease-out]"
        aria-label="Cerrar acciones"
      />

      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : 'Acciones'}
        tabIndex={-1}
        className="fixed inset-x-0 bottom-0 z-[100] flex max-h-[min(90dvh,720px)] flex-col rounded-t-3xl bg-white shadow-2xl outline-none dark:bg-slate-900"
        style={{ animation: 'slideUp 0.4s cubic-bezier(0.32, 0.72, 0, 1) forwards' }}
      >
        <div className="flex justify-center pt-3 pb-4" aria-hidden="true">
          <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>

        {title && (
          <h2 id={titleId} className="px-4 pb-2 text-center text-sm font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {title}
          </h2>
        )}

        <div
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 ${hasFooter ? 'pb-2' : 'pb-[calc(1.25rem+env(safe-area-inset-bottom))]'}`}
          style={{ WebkitOverflowScrolling: 'touch' }}
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

                // Lógica de clases dinámicas
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
                    onClick={() => {
                      if (option.disabled) return;
                      option.onSelect?.();
                      onClose?.();
                    }}
                    className={`w-full min-h-11 rounded-3xl ${compact ? 'p-4' : 'p-5'} text-left active:scale-[0.98] transition-all duration-200 motion-reduce:transition-none disabled:opacity-50 ${optionClasses}`}
                    style={{
                      animation: `cardIn 0.35s cubic-bezier(0.32, 0.72, 0, 1) ${0.08 + index * 0.06}s both`,
                    }}
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
                        {option.description && (
                          <p className={`text-sm leading-snug ${descColor}`}>{option.description}</p>
                        )}
                      </div>
                      {isSelected && (
                        <Check className="w-5 h-5 text-indigo-600 stroke-[2.5] flex-shrink-0" aria-hidden="true" />
                      )}
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
      </section>
    </>,
    document.body
  );
}
