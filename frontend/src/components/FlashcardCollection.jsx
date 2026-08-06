import { useDeferredValue, useMemo, useState } from 'react';
import { Clock, History, Image, Loader2, RefreshCw } from 'lucide-react';
import FlashcardGrid from './FlashcardGrid';
import LibraryToolbar from './library/LibraryToolbar';

const CARD_SORT_OPTIONS = [
  { id: 'recent', label: 'Más recientes', icon: Clock },
  { id: 'oldest', label: 'Más antiguas', icon: History },
  { id: 'images-first', label: 'Con imagen primero', icon: Image },
];

function CardGridSkeleton() {
  return (
    <div
      className="mt-4 grid grid-cols-2 gap-3 sm:gap-4"
      aria-hidden="true"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="min-h-44 animate-pulse rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="ml-auto h-7 w-7 rounded-lg bg-slate-100 dark:bg-slate-800" />
          <div className="mt-3 h-2 w-12 rounded-full bg-slate-100 dark:bg-slate-800" />
          <div className="mt-2 h-3 w-full rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="mt-2 h-3 w-3/4 rounded-full bg-slate-100 dark:bg-slate-800" />
          <div className="my-4 border-t border-dashed border-slate-200 dark:border-slate-700" />
          <div className="h-2 w-12 rounded-full bg-slate-100 dark:bg-slate-800" />
          <div className="mt-2 h-3 w-5/6 rounded-full bg-slate-200 dark:bg-slate-700" />
        </div>
      ))}
    </div>
  );
}

export default function FlashcardCollection({
  cards,
  onEdit,
  onDelete,
  loading = false,
  error = '',
  onRetry,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const processedCards = useMemo(() => {
    const normalizedQuery = deferredSearchQuery.trim().toLocaleLowerCase('es-MX');
    const result = cards.filter((card) => {
      if (!normalizedQuery) return true;

      return String(card.question || '').toLocaleLowerCase('es-MX').includes(normalizedQuery)
        || String(card.answer || '').toLocaleLowerCase('es-MX').includes(normalizedQuery);
    });

    if (sortBy === 'recent') {
      result.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    } else if (sortBy === 'oldest') {
      result.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    } else if (sortBy === 'images-first') {
      result.sort((a, b) => Number(Boolean(b.contentImage)) - Number(Boolean(a.contentImage)));
    }

    return result;
  }, [cards, deferredSearchQuery, sortBy]);

  const hasCards = cards.length > 0;
  const hasSearch = deferredSearchQuery.trim().length > 0;

  return (
    <div
      className="animate-[fadeIn_0.15s_ease]"
      aria-busy={loading}
    >
      <LibraryToolbar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        sortBy={sortBy}
        setSortBy={setSortBy}
        sortOptions={CARD_SORT_OPTIONS}
        defaultSort="recent"
        searchPlaceholder="Buscar pregunta o respuesta"
        className="!mt-0"
      />

      {loading && hasCards && (
        <div
          className="mt-3 flex items-center justify-end gap-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500"
          role="status"
        >
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          Actualizando cartas…
        </div>
      )}

      {loading && !hasCards ? (
        <CardGridSkeleton />
      ) : error && !hasCards ? (
        <div
          role="alert"
          className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-8 text-center dark:border-rose-900/60 dark:bg-rose-950/40"
        >
          <p className="text-sm font-bold text-rose-800 dark:text-rose-200">No pudimos cargar las cartas</p>
          <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-300">{error}</p>
          {typeof onRetry === 'function' && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-rose-800 active:scale-[0.98]"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Reintentar
            </button>
          )}
        </div>
      ) : processedCards.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-12 text-center text-xs font-medium text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500">
          {hasSearch
            ? 'No se encontraron cartas que coincidan con tu búsqueda.'
            : 'Aún no hay cartas en este mazo.'}
        </div>
      ) : (
        <FlashcardGrid cards={processedCards} onEdit={onEdit} onDelete={onDelete} />
      )}
    </div>
  );
}
