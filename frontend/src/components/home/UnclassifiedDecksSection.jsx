import React from 'react';

export default function UnclassifiedDecksSection({ unclassifiedDecks, onOpenReview }) {
  if (unclassifiedDecks.length === 0) return null;

  return (
    <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800">
      <div className="mb-3">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
          Mazos Fuera de la Jerarquía ({unclassifiedDecks.length})
        </h3>
        <p className="text-[11px] text-zinc-400">
          Presiona un mazo para iniciar un repaso de contingencia inmediato.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {unclassifiedDecks.map((deck) => (
          <div
            key={deck.id || deck._id}
            onClick={() => onOpenReview(deck)} 
            style={{ borderLeftColor: deck.coverColor || '#cbd5e1' }}
            className="p-3 bg-white dark:bg-zinc-900 border-l-4 border-y border-r border-zinc-200 dark:border-zinc-800 rounded-xl cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-600 hover:translate-y-[-1px] transition-all group flex flex-col justify-between min-h-[70px]"
          >
            <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 truncate group-hover:text-indigo-600 transition-colors">
              {deck.title}
            </h4>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-zinc-400 font-medium">
                {deck.cardCount || 0} cards
              </span>
              {deck.analytics?.masteryPercentage !== undefined && (
                <span className="text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded">
                  {deck.analytics.masteryPercentage}% d.
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

