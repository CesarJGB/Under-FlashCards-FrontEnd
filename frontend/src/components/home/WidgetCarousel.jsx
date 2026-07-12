// FILE: frontend/src/components/home/WidgetCarousel.jsx
import useCardStack from './useCardStack';

const CARD_HEIGHT = 264;

export default function WidgetCarousel({ 
  title = 'Widgets', 
  onViewAll, 
  cardCount = 4,
  order = [0, 1, 2, 3],
  onReorder
}) {
  const { isPickedUp, dragY, handlers } = useCardStack(cardCount, order, onReorder);
  const behindIds = order.slice(1, 3);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <button
          type="button"
          onClick={onViewAll}
          className="text-sm text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
        >
          Ver todas ({order.length})
        </button>
      </div>

      <div className="relative" style={{ height: CARD_HEIGHT + 24 }}>
        {behindIds[1] !== undefined && (
          <div
            className="absolute inset-x-4 top-0 rounded-3xl bg-white border border-slate-200/60 z-10 flex items-center justify-center"
            style={{ 
              height: CARD_HEIGHT, 
              transform: 'translateY(24px) scale(0.95)',
              opacity: 0.6
            }}
          >
            <span className="text-5xl font-bold text-slate-300">#{order[2]}</span>
          </div>
        )}

        {behindIds[0] !== undefined && (
          <div
            className="absolute inset-x-2 top-0 rounded-3xl bg-white border border-slate-200/80 z-20 flex items-center justify-center"
            style={{ 
              height: CARD_HEIGHT, 
              transform: 'translateY(12px) scale(0.97)',
              opacity: 0.8
            }}
          >
            <span className="text-5xl font-bold text-slate-400">#{order[1]}</span>
          </div>
        )}

        <div
          {...handlers}
          className="absolute inset-x-0 top-0 z-30 rounded-3xl bg-white border border-slate-200 select-none flex items-center justify-center"
          style={{
            height: CARD_HEIGHT,
            transform: `translateY(${dragY}px) scale(${isPickedUp ? 1.02 : 1})`,
            transition: isPickedUp ? 'none' : 'transform 200ms ease',
            touchAction: isPickedUp ? 'none' : 'pan-x',
            boxShadow: isPickedUp
              ? '0 12px 32px rgba(15, 23, 42, 0.18)'
              : '0 1px 2px rgba(15, 23, 42, 0.06)'
          }}
        >
          <div className="text-center">
            <span className="text-7xl font-bold text-slate-800">#{order[0]}</span>
            <p className="text-sm text-slate-500 mt-2">
              {isPickedUp ? 'Arrastra ↑↓' : 'Mantén presionado'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
