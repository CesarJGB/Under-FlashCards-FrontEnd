// FILE: frontend/src/components/home/WidgetCarousel.jsx
import useCardStack from './useCardStack';

const CARD_HEIGHT = 176; // ajustable — equivale a h-44

export default function WidgetCarousel({ title = 'Widgets', onViewAll, cardCount = 4 }) {
  const { order, isPickedUp, dragX, handlers } = useCardStack(cardCount);

  // Solo se muestran hasta 2 "asomos" detrás de la tarjeta del frente,
  // igual que en la referencia — el resto de la pila existe en `order`
  // pero no se renderiza en esta versión mínima.
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
          Ver todas
        </button>
      </div>

      <div className="relative" style={{ height: CARD_HEIGHT + 24 }}>
        {/* Asomo de la tarjeta más al fondo */}
        {behindIds[1] !== undefined && (
          <div
            className="absolute inset-x-4 top-0 rounded-3xl bg-white border border-slate-200/60 z-10"
            style={{ height: CARD_HEIGHT, transform: 'translateY(24px)' }}
          />
        )}

        {/* Asomo de la tarjeta intermedia */}
        {behindIds[0] !== undefined && (
          <div
            className="absolute inset-x-2 top-0 rounded-3xl bg-white border border-slate-200/80 z-20"
            style={{ height: CARD_HEIGHT, transform: 'translateY(12px)' }}
          />
        )}

        {/* Tarjeta del frente — mantener presionado ~600ms y arrastrar para reordenar */}
        <div
          {...handlers}
          className="absolute inset-x-0 top-0 z-30 rounded-3xl bg-white border border-slate-200 select-none"
          style={{
            height: CARD_HEIGHT,
            transform: `translateX(${dragX}px) scale(${isPickedUp ? 1.02 : 1})`,
            transition: isPickedUp ? 'none' : 'transform 200ms ease',
            touchAction: isPickedUp ? 'none' : 'pan-y',
            boxShadow: isPickedUp
              ? '0 12px 32px rgba(15, 23, 42, 0.18)'
              : '0 1px 2px rgba(15, 23, 42, 0.06)'
          }}
        >
          {/* En blanco por ahora — acá va el contenido real (QuickViewGrid, DetailedMateriasGrid, etc.) */}
        </div>
      </div>
    </div>
  );
}
