// FILE: frontend/src/components/home/WidgetCarouselExpanded.jsx
export default function WidgetCarouselExpanded({ 
  order, 
  onReorder, 
  onClose,
  widgets = [] // Array de widgets con sus datos reales
}) {
  const moveWidget = (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= order.length) return;
    
    const newOrder = [...order];
    [newOrder[index], newOrder[newIndex]] = [newOrder[newIndex], newOrder[index]];
    onReorder(newOrder);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 animate-[fadeIn_0.2s_ease]">
      {/* Header sticky */}
      <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-slate-200 px-4 py-4 z-10">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Tus Widgets</h2>
            <p className="text-sm text-slate-500">Orden actual del carrusel ({order.length} widgets)</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 transition-colors"
          >
            <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Instrucciones */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2 text-xs text-indigo-700">
           Arrastra los botones ↑↓ para reordenar. El primero es el que se muestra en el carrusel.
        </div>
      </div>

      {/* Lista de widgets */}
      <div className="p-4 space-y-3 pb-24">
        {order.map((widgetIndex, position) => {
          const widget = widgets[widgetIndex];
          const isFirst = position === 0;
          
          return (
            <div
              key={`${widgetIndex}-${position}`}
              className={`bg-white rounded-2xl border-2 p-4 transition-all ${
                isFirst 
                  ? 'border-indigo-400 shadow-lg shadow-indigo-100' 
                  : 'border-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Número de posición */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  isFirst ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {position + 1}
                </div>
                
                {/* Contenido del widget */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{widget?.icon || '📦'}</span>
                    <h3 className="font-semibold text-slate-900">
                      {widget?.title || `Widget #${widgetIndex + 1}`}
                    </h3>
                  </div>
                  {widget?.description && (
                    <p className="text-sm text-slate-500 mt-1">{widget.description}</p>
                  )}
                  {isFirst && (
                    <span className="inline-block mt-2 text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                      Visible en el carrusel
                    </span>
                  )}
                </div>
                
                {/* Controles de reordenamiento */}
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => moveWidget(position, 'up')}
                    disabled={position === 0}
                    className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => moveWidget(position, 'down')}
                    disabled={position === order.length - 1}
                    className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
