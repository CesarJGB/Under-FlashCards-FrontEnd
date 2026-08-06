import FlashcardCollection from './FlashcardCollection';

export default function CardCollectionView({
  cards,
  loading,
  error,
  onRetry,
  onEdit,
  onDelete,
}) {
  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-slate-50 px-3 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-4 dark:bg-slate-950 sm:px-4">
      <section
        className="mx-auto w-full max-w-4xl"
        aria-label="Colección de cartas del mazo"
      >
        <FlashcardCollection
          cards={cards}
          loading={loading}
          error={error}
          onRetry={onRetry}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </section>
    </main>
  );
}
