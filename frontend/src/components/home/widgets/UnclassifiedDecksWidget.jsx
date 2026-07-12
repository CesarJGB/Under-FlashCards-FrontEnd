import { ArrowRight, Compass } from 'lucide-react';
import HomeWidgetShell from './HomeWidgetShell';

export default function UnclassifiedDecksWidget({ unclassifiedDecks, onOpenReview }) {
  const visibleDecks = unclassifiedDecks.slice(0, 3);

  return (
    <HomeWidgetShell
      title="Mazos fuera de jerarquía"
      description="Atajos para rescatar lo que todavía no está bien ubicado."
      icon={Compass}
      footerNote={
        unclassifiedDecks.length > 0
          ? `${unclassifiedDecks.length} mazos pendientes de clasificar.`
          : 'Sin mazos huérfanos por ahora.'
      }
    >
      {visibleDecks.length === 0 ? (
        <div className="h-full rounded-[28px] border border-dashed border-zinc-200 bg-zinc-50/70 flex items-center justify-center px-6 text-center">
          <p className="text-sm font-medium text-zinc-500">Todo lo que estudias ya pertenece a una materia.</p>
        </div>
      ) : (
        <div className="h-full flex flex-col gap-3">
          {visibleDecks.map((deck) => (
            <button
              key={deck.id || deck._id}
              type="button"
              onClick={() => onOpenReview?.(deck)}
              className="rounded-[24px] border border-zinc-200 bg-white p-4 text-left hover:border-indigo-200 hover:shadow-sm transition-all flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-zinc-900 truncate">{deck.title}</p>
                <p className="text-[11px] text-zinc-500 mt-1">{deck.cardCount || 0} tarjetas listas para repasar</p>
              </div>
              <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <ArrowRight className="w-4 h-4" />
              </div>
            </button>
          ))}
        </div>
      )}
    </HomeWidgetShell>
  );
}
