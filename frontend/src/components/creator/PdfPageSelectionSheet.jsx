// FILE: frontend/src/components/creator/PdfPageSelectionSheet.jsx
// Entrega v3. Guardar este archivo con extensión .jsx.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useBodyScrollLock } from '../../lib/scrollLock';
import PdfPageThumbnail from './pdf/PdfPageThumbnail';

const PAGE_BLOCK_SIZE = 24;

function buildPageList(totalPages) {
  return Array.from({ length: totalPages }, (_, index) => index + 1);
}

function normalizePages(pages, totalPages) {
  return [...new Set(pages)]
    .map(Number)
    .filter((page) => Number.isInteger(page) && page >= 1 && page <= totalPages)
    .sort((left, right) => left - right);
}

function formatPageRanges(pages) {
  if (!pages.length) return '';

  const ranges = [];
  let rangeStart = pages[0];
  let previous = pages[0];

  for (let index = 1; index < pages.length; index += 1) {
    const page = pages[index];
    if (page === previous + 1) {
      previous = page;
      continue;
    }

    ranges.push(rangeStart === previous ? String(rangeStart) : rangeStart + '–' + previous);
    rangeStart = page;
    previous = page;
  }

  ranges.push(rangeStart === previous ? String(rangeStart) : rangeStart + '–' + previous);
  return ranges.join(', ');
}

export default function PdfPageSelectionSheet({
  open,
  pdf,
  totalPages,
  selectedPages,
  onChange,
  onConfirm,
  onClose,
  onPreview,
  disabled = false,
}) {
  const dialogRef = useRef(null);
  const scrollRootRef = useRef(null);
  const id = useId();
  const titleId = id + '-title';
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');

  const totalBlocks = Math.max(1, Math.ceil(totalPages / PAGE_BLOCK_SIZE));
  const safeSelectedPages = useMemo(
    () => normalizePages(selectedPages || [], totalPages),
    [selectedPages, totalPages],
  );
  const selectedPageSet = useMemo(() => new Set(safeSelectedPages), [safeSelectedPages]);
  const blockStartPage = currentBlockIndex * PAGE_BLOCK_SIZE + 1;
  const blockEndPage = Math.min(totalPages, blockStartPage + PAGE_BLOCK_SIZE - 1);
  const blockPages = useMemo(
    () => Array.from(
      { length: Math.max(0, blockEndPage - blockStartPage + 1) },
      (_, index) => blockStartPage + index,
    ),
    [blockEndPage, blockStartPage],
  );
  const selectedInBlock = useMemo(
    () => blockPages.reduce((count, page) => count + (selectedPageSet.has(page) ? 1 : 0), 0),
    [blockPages, selectedPageSet],
  );
  const selectionDescription = useMemo(() => {
    if (!safeSelectedPages.length) return 'Sin selección';
    if (safeSelectedPages.length === totalPages) return 'Documento completo';
    return 'Páginas ' + formatPageRanges(safeSelectedPages);
  }, [safeSelectedPages, totalPages]);

  useBodyScrollLock(Boolean(open), 'pdf-page-selection-' + id);

  useEffect(() => {
    if (!open) return undefined;

    const previousFocus = document.activeElement;
    const focusTimer = window.setTimeout(() => dialogRef.current?.focus(), 0);
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose?.();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;
    setCurrentBlockIndex((current) => Math.min(Math.max(0, current), totalBlocks - 1));
    setRangeStart('');
    setRangeEnd('');
  }, [open, totalBlocks]);

  const updateSelection = (nextPages) => {
    if (disabled) return;
    onChange?.(normalizePages(nextPages, totalPages));
  };

  const togglePage = (page) => {
    if (disabled) return;
    updateSelection(
      selectedPageSet.has(page)
        ? safeSelectedPages.filter((selectedPage) => selectedPage !== page)
        : [...safeSelectedPages, page],
    );
  };

  const selectBlock = () => updateSelection([...safeSelectedPages, ...blockPages]);
  const clearBlock = () => {
    const blockSet = new Set(blockPages);
    updateSelection(safeSelectedPages.filter((page) => !blockSet.has(page)));
  };

  const applyRange = () => {
    const parsedStart = Number.parseInt(rangeStart, 10);
    const parsedEnd = Number.parseInt(rangeEnd, 10);
    if (!Number.isInteger(parsedStart) || !Number.isInteger(parsedEnd)) return;

    const start = Math.max(1, Math.min(totalPages, Math.min(parsedStart, parsedEnd)));
    const end = Math.max(1, Math.min(totalPages, Math.max(parsedStart, parsedEnd)));
    const rangePages = Array.from({ length: end - start + 1 }, (_, index) => start + index);
    updateSelection([...safeSelectedPages, ...rangePages]);
    setRangeStart(String(start));
    setRangeEnd(String(end));
  };

  if (!open || !pdf || !totalPages || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-[90] cursor-default bg-slate-900/40 animate-[fadeIn_0.25s_ease-out]"
        aria-label="Cerrar selección de páginas"
        onClick={() => onClose?.()}
      />

      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="fixed inset-x-0 bottom-0 z-[100] max-h-[92dvh] overflow-hidden rounded-t-3xl bg-white shadow-2xl outline-none"
        style={{ animation: 'slideUp 0.4s cubic-bezier(0.32, 0.72, 0, 1) forwards' }}
      >
        <h2 id={titleId} className="sr-only">Seleccionar páginas del PDF</h2>

        <div className="relative flex justify-center pb-1 pt-3" aria-hidden="true">
          <div className="h-1 w-10 rounded-full bg-slate-300" />
        </div>
        <button
          type="button"
          onClick={() => onClose?.()}
          className="absolute right-4 top-3 flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="max-h-[calc(92dvh-112px)] overflow-y-auto px-4 pb-3 pt-2">
          <div className="flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/70 p-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black tabular-nums text-slate-800">
                {safeSelectedPages.length} de {totalPages}
              </p>
              <p className="mt-0.5 truncate text-[10px] font-medium text-slate-500">
                {selectionDescription}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                disabled={disabled}
                onClick={() => updateSelection(buildPageList(totalPages))}
                className="min-h-9 cursor-pointer rounded-lg bg-white px-2.5 text-[10px] font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
                aria-label="Seleccionar todas las páginas"
              >
                Todas
              </button>
              <button
                type="button"
                disabled={disabled || !safeSelectedPages.length}
                onClick={() => updateSelection([])}
                className="min-h-9 cursor-pointer rounded-lg bg-white px-2.5 text-[10px] font-bold text-slate-500 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
                aria-label="Quitar todas las páginas"
              >
                Ninguna
              </button>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-[1fr_auto_1fr_auto] items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/70 p-2">
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max={totalPages}
              value={rangeStart}
              onChange={(event) => setRangeStart(event.target.value)}
              disabled={disabled}
              placeholder="Desde"
              aria-label="Página inicial"
              className="min-h-9 min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-center text-xs font-bold text-slate-700 outline-none transition-colors placeholder:text-slate-300 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/[0.08] disabled:opacity-45"
            />
            <span className="text-xs font-bold text-slate-400" aria-hidden="true">–</span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max={totalPages}
              value={rangeEnd}
              onChange={(event) => setRangeEnd(event.target.value)}
              disabled={disabled}
              placeholder="Hasta"
              aria-label="Página final"
              className="min-h-9 min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-center text-xs font-bold text-slate-700 outline-none transition-colors placeholder:text-slate-300 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/[0.08] disabled:opacity-45"
            />
            <button
              type="button"
              disabled={disabled || !rangeStart || !rangeEnd}
              onClick={applyRange}
              className="min-h-9 cursor-pointer rounded-lg bg-slate-900 px-3 text-[10px] font-bold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Añadir
            </button>
          </div>

          <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-3xs">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-black tabular-nums text-slate-800">
                {blockStartPage}–{blockEndPage}
                <span className="ml-1 font-medium text-slate-400">de {totalPages}</span>
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={disabled || currentBlockIndex === 0}
                  onClick={() => setCurrentBlockIndex((current) => Math.max(0, current - 1))}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label="Bloque anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={disabled || currentBlockIndex >= totalBlocks - 1}
                  onClick={() => setCurrentBlockIndex((current) => Math.min(totalBlocks - 1, current + 1))}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label="Bloque siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={disabled}
                onClick={selectBlock}
                className="min-h-9 cursor-pointer rounded-lg border border-indigo-100 bg-indigo-50 px-3 text-[10px] font-bold text-indigo-700 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Todo el bloque
              </button>
              <button
                type="button"
                disabled={disabled || selectedInBlock === 0}
                onClick={clearBlock}
                className="min-h-9 cursor-pointer rounded-lg border border-slate-200 px-3 text-[10px] font-bold text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Quitar bloque
              </button>
            </div>

            <div
              ref={scrollRootRef}
              className="mt-2 grid max-h-[37dvh] grid-cols-2 gap-2.5 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2 sm:grid-cols-3"
            >
              {blockPages.map((page) => (
                <PdfPageThumbnail
                  key={page}
                  pdf={pdf}
                  pageNum={page}
                  isSelected={selectedPageSet.has(page)}
                  onToggle={togglePage}
                  onPreview={onPreview}
                  scrollRootRef={scrollRootRef}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-t border-slate-100 bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2.5">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onClose?.()}
            className="min-h-11 cursor-pointer rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={disabled || !safeSelectedPages.length}
            onClick={() => onConfirm?.(safeSelectedPages)}
            className="flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-xl bg-indigo-600 px-4 text-xs font-black text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Analizar {safeSelectedPages.length || ''} {safeSelectedPages.length === 1 ? 'página' : 'páginas'}
          </button>
        </div>
      </section>
    </>,
    document.body,
  );
}
