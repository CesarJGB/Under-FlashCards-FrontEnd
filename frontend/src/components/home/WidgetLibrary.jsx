// FILE: frontend/src/components/home/WidgetLibrary.jsx
import { useMemo } from 'react';
import { HOME_WIDGET_DEFINITIONS } from './homeWidgetRegistry';

export default function WidgetLibrary({ 
  activeWidgetIds = [],
  onClose,
}) {
  const availableWidgets = useMemo(() => {
    return HOME_WIDGET_DEFINITIONS;
  }, []);

  const categories = useMemo(() => {
    const cats = {};
    availableWidgets.forEach(widget => {
      if (!cats[widget.category]) {
        cats[widget.category] = [];
      }
      cats[widget.category].push(widget);
    });
    return cats;
  }, [availableWidgets]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-50/95 backdrop-blur-sm animate-[fadeIn_0.2s_ease]">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Biblioteca de Widgets</h2>
          <p className="text-sm text-slate-500">El registro central ya alimenta el carrusel y este catálogo.</p>
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

      {/* Contenido */}
      <div className="p-4 pb-24 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 80px)' }}>
        <div className="mb-6 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
          Por ahora los widgets base ya están activos. Cuando agregues uno nuevo al registro, aparecerá aquí,
          en el gestor y en el carrusel sin duplicar configuración.
        </div>

        {Object.entries(categories).map(([category, widgets]) => (
          <div key={category} className="mb-8">
            <h3 className="text-lg font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <span>{category}</span>
              <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                {widgets.length}
              </span>
            </h3>
            
            <div className="grid grid-cols-1 gap-3">
              {widgets.map(widget => {
                const Icon = widget.icon;
                const isActive = activeWidgetIds.includes(widget.id);

                return (
                  <div
                    key={widget.id}
                    className="bg-white rounded-2xl border border-slate-200 p-4 hover:border-indigo-300 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                            {widget.title}
                          </h4>
                          {isActive && (
                            <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                              Activo
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 mt-1">{widget.description}</p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {widget.capabilities?.map((capability) => (
                            <span
                              key={capability}
                              className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full"
                            >
                              {capability}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="shrink-0">
                        <div className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${
                          isActive
                            ? 'bg-indigo-50 text-indigo-600'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {isActive ? 'En uso' : 'Base lista'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
