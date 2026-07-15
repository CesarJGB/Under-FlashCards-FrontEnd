import { isValidElement, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
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
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        onClick={() => onClose?.()}
        className="absolute inset-0 cursor-default bg-slate-950/40 backdrop-blur-[1px] animate-[fadeIn_0.15s_ease]"
        aria-label="Cerrar acciones"
      />

      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : 'Acciones'}
        tabIndex={-1}
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl outline-none animate-[slideUp_0.2s_ease-out] sm:rounded-2xl"
      >
        <div className="flex justify-center pb-2 pt-3 sm:hidden" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-slate-300" />
        </div>

        <div className={`flex items-center gap-3 px-5 ${title ? 'pb-3 pt-1' : 'pb-1 pt-0'}`}>
          {title && <h2 id={titleId} className="text-base font-bold text-slate-900">{title}</h2>}
          <button
            type="button"
            onClick={() => onClose?.()}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"
            aria-label="Cerrar acciones"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[70dvh] space-y-1 overflow-y-auto px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:pb-3">
          {actionOptions.map((option) => {
            if (!option) return null;

            const Icon = option.icon;

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
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {Icon && (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                    {isValidElement(Icon) ? Icon : <Icon className="h-4 w-4" aria-hidden="true" />}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-800">{option.label}</span>
                  {option.description && (
                    <span className="mt-0.5 block text-xs font-medium leading-snug text-slate-500">{option.description}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>,
    document.body
  );
}
