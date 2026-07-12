// FILE: frontend/src/components/home/WidgetCarouselExpanded.jsx
import { useEffect } from 'react';

export default function WidgetCarouselExpanded({ 
  order, 
  onReorder, 
  onClose 
}) {
  // Bloquear scroll del body cuando el modal está abierto
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const moveWidget = (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= order.length) return;
    
    const newOrder = [...order];
    [newOrder[index], newOrder[newIndex]] = [newOrder[newIndex], newOrder[index]];
    onReorder(newOrder);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-white">
      {/* Header completo (sin asumir que hay header en HomeSection) */}
      <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-4 z-10">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Tus Widgets</h2>
            <p className="text-sm text-slate-500">Orden actual ({order.length} widgets)</p>
          </div>
          <button
            onClick={onClose}
            className="p-3 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2 text-xs text-indigo-700">
          Usa los botones ↑↓ para reordenar. El #1 es el que se ve en el carrusel.
        </div>
      </div>

      {/* Contenido con scroll independiente */}
      <div 
        className="p-4 space-y-3 overflow-y-auto" 
        style={{ 
          height: 'calc(100vh - 140px)', 
          WebkitOverflowScrolling: 'touch' 
        }}
      >
        {order.map((widgetNum, position) => {
          const isFirst = position === 0;
          
          return (
            <div
              key={`${widgetNum}-${position}`}
              className={`bg-white rounded-2xl border-2 p-6 transition-all ${
                isFirst 
                  ? 'border-indigo-400 shadow-lg shadow-indigo-100' 
                  : 'border-slate-200'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base font-bold ${
                  isFirst ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {position + 1}
                </div>
                
                <div className="flex-1">
                  <span className="text-4xl font-bold text-slate-800">#{widgetNum}</span>
                  {isFirst && (
                    <span className="ml-3 text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                      Visible ahora
                    </span>
                  )}
                </div>
                
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => moveWidget(position, 'up')}
                    disabled={position === 0}
                    className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => moveWidget(position, 'down')}
                    disabled={position === order.length - 1}
                    className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
