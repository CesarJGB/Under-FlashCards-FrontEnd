// FILE: frontend/src/components/home/WidgetCarousel.jsx
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
      className={`absolute top-0 rounded-3xl bg-white border border-slate-200/80 overflow-hidden ${className}`}
      style={style}
    >
      <div className="h-full w-full p-6 flex flex-col justify-end bg-gradient-to-br from-white to-slate-50">
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
          <PreviewCard
            widgetId={behindIds[1]}
            context={widgetContext}
            className="inset-x-4 z-10"
            style={{ 
              height: CARD_HEIGHT, 
              transform: 'translateY(24px) scale(0.95)',
              opacity: 0.6
            }}
          />
        )}

        {behindIds[0] !== undefined && (
          <PreviewCard
            widgetId={behindIds[0]}
            context={widgetContext}
            className="inset-x-2 z-20"
            style={{ 
              height: CARD_HEIGHT, 
              transform: 'translateY(12px) scale(0.97)',
              opacity: 0.8
            }}
          />
        )}

        <div
          {...handlers}
          className="absolute inset-x-0 top-0 z-30 rounded-3xl bg-white border border-slate-200 select-none overflow-hidden"
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
          <ActiveComponent {...widgetContext} />
        </div>
      </div>
    </div>
  );
}
