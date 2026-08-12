// FILE: frontend/src/components/home/WidgetCarousel.jsx
import { ChevronRight } from 'lucide-react';
import useCardStack from './useCardStack';
import { DEFAULT_WIDGET_ORDER, getHomeWidgetDefinition } from './homeWidgetRegistry';

const CARD_HEIGHT = 360;

function PreviewCard({ widgetId, context, className, style }) {
  const definition = getHomeWidgetDefinition(widgetId);

  if (!definition) return null;

  const Icon = definition.icon;
  const preview = definition.getPreview?.(context) || definition.description;

  return (
    <div
      className={`absolute top-0 overflow-hidden rounded-[28px] border ${className}`}
      style={style}
      aria-hidden="true"
    >
      <div className="invisible flex h-full w-full flex-col justify-end p-6">
        <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
          <Icon className="w-5 h-5" />
        </div>
        <p className="text-sm font-bold text-slate-900">{definition.title}</p>
        <p className="text-xs text-slate-500 mt-1">{preview}</p>
      </div>
    </div>
  );
}

export default function WidgetCarousel({ 
  title = 'Widgets', 
  onViewAll, 
  order = DEFAULT_WIDGET_ORDER,
  onShift,
  widgetContext
}) {
  const { isPickedUp, dragY, handlers } = useCardStack(order.length, onShift);
  const behindIds = order.slice(1, 3);
  const activeWidgetId = order[0];
  const activeDefinition = getHomeWidgetDefinition(activeWidgetId);
  const ActiveComponent = activeDefinition?.Component;

  if (!activeDefinition || !ActiveComponent) {
    return null;
  }

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">{title}</h2>
        <button
          type="button"
          onClick={onViewAll}
          className="inline-flex min-h-11 cursor-pointer items-center gap-1 whitespace-nowrap text-sm font-semibold text-[#5F4AE6] transition-colors hover:text-[#4935C8]"
        >
          Ver todas ({order.length})
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="relative" style={{ height: CARD_HEIGHT + 44 }}>
        {behindIds[1] !== undefined && (
          <PreviewCard
            widgetId={behindIds[1]}
            context={widgetContext}
            className="inset-x-4 z-10 border-[#E7E0F7] bg-[#FAF8FF]"
            style={{ 
              height: CARD_HEIGHT, 
              transform: 'translateY(40px) scale(0.95)',
              transformOrigin: 'top center',
              opacity: 1
            }}
          />
        )}

        {behindIds[0] !== undefined && (
          <PreviewCard
            widgetId={behindIds[0]}
            context={widgetContext}
            className="inset-x-2 z-20 border-[#D8CEF5] bg-[#F2EEFF]"
            style={{ 
              height: CARD_HEIGHT, 
              transform: 'translateY(20px) scale(0.975)',
              transformOrigin: 'top center',
              opacity: 1
            }}
          />
        )}

        <div
          {...handlers}
          className="absolute inset-x-0 top-0 z-30 select-none overflow-hidden rounded-[28px] border border-[#D9D0F3] bg-[linear-gradient(180deg,#FAF8FF_0%,#FFFFFF_34%,#FFFFFF_100%)]"
          style={{
            height: CARD_HEIGHT,
            transform: `translateY(${dragY}px) scale(${isPickedUp ? 1.02 : 1})`,
            transition: isPickedUp ? 'none' : 'transform 200ms ease',
            touchAction: isPickedUp ? 'none' : 'pan-x',
            boxShadow: isPickedUp
              ? '0 16px 36px rgba(52, 39, 92, 0.16), 0 4px 10px rgba(52, 39, 92, 0.08)'
              : '0 12px 30px rgba(52, 39, 92, 0.10), 0 2px 8px rgba(52, 39, 92, 0.05)'
          }}
        >
          <ActiveComponent {...widgetContext} />
        </div>
      </div>
    </div>
  );
}
