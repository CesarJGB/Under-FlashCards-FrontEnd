import { isValidElement, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useBodyScrollLock } from '../../lib/scrollLock';

export default function ActionSheet({ open, title, options, onClose }) {
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement;
    const focusTimer = window.setTimeout(() => dialogRef.current?.focus(), 0);

    return () => {
      window.clearTimeout(focusTimer);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const actionOptions = Array.isArray(options) ? options : [];

  return createPortal(
    <>
      <button
        type="button"
        onClick={() => onClose?.()}
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
        className="fixed inset-x-0 bottom-0 z-[100] bg-white rounded-t-3xl shadow-2xl outline-none"
        style={{ animation: 'slideUp 0.4s cubic-bezier(0.32, 0.72, 0, 1) forwards' }}
      >
        <div className="flex justify-center pt-3 pb-4" aria-hidden="true">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>

        {title && <h2 id={titleId} className="sr-only">{title}</h2>}

        <div className="px-4 pb-8 flex flex-col gap-3">
          {actionOptions.map((option, index) => {
            if (!option) return null;

            const Icon = option.icon;
            const isPrimary = index === 0;

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
                className={`w-full rounded-3xl p-5 text-left active:scale-[0.98] transition-all duration-200 disabled:opacity-50 ${
                  isPrimary
                    ? 'bg-gradient-to-br from-indigo-100 to-violet-100 border-2 border-indigo-200 shadow-lg shadow-indigo-200/50 hover:shadow-xl'
                    : 'bg-slate-50 border border-slate-200 hover:shadow-md'
                }`}
                style={{
                  animation: `cardIn 0.35s cubic-bezier(0.32, 0.72, 0, 1) ${0.08 + index * 0.06}s both`,
                }}
              >
                <div className="flex items-center gap-4">
                  {Icon && (
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
                      {isValidElement(Icon)
                        ? Icon
                        : <Icon className={`w-6 h-6 ${isPrimary ? 'text-indigo-600' : 'text-slate-700'}`} aria-hidden="true" />}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-slate-900 leading-tight mb-1">{option.label}</h3>
                    {option.description && (
                      <p className={`text-sm leading-snug ${isPrimary ? 'text-slate-700' : 'text-slate-600'}`}>{option.description}</p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </>,
    document.body
  );
}
