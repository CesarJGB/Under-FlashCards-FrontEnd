// FILE: frontend/src/components/home/WidgetLibrary.jsx
import { useMemo } from 'react';

export default function WidgetLibrary({ 
  user, 
  globalStats, 
  enrichedMaterias, 
  unclassifiedDecks,
  onClose,
  onOpenReview,
  onNavigateToLibrary 
}) {
  // Widgets disponibles organizados por categorías
  const availableWidgets = useMemo(() => {
    return [
      {
        id: 'globalStats',
        title: 'Resumen Global',
        description: 'Tarjetas totales y dominio general',
        category: 'Resumen',
        icon: '📊',
        data: globalStats
      },
      {
        id: 'greeting',
        title: 'Saludo Personalizado',
        description: 'Mensaje de bienvenida con tu progreso',
        category: 'Personal',
        icon: '',
        data: { userName: user?.name || user?.firstName || 'Usuario' }
      },
      ...enrichedMaterias.slice(0, 10).map(materia => ({
        id: `materia-${materia.id}`,
        title: materia.title,
        description: `${materia.decksCount} mazos • ${materia.totalCards} tarjetas`,
        category: 'Asignaturas',
        icon: '📚',
        data: {
          masteryPercentage: materia.masteryPercentage,
          decksCount: materia.decksCount,
          totalCards: materia.totalCards,
          activeParciales: materia.activeParciales
        }
      }))
    ];
  }, [globalStats, user, enrichedMaterias]);

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
          <p className="text-sm text-slate-500">Selecciona y organiza tus widgets</p>
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
        {Object.entries(categories).map(([category, widgets]) => (
          <div key={category} className="mb-8">
            <h3 className="text-lg font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <span>{category}</span>
              <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                {widgets.length}
              </span>
            </h3>
            
            <div className="grid grid-cols-1 gap-3">
              {widgets.map(widget => (
                <div
                  key={widget.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">{widget.icon}</div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {widget.title}
                      </h4>
                      <p className="text-sm text-slate-500 mt-1">{widget.description}</p>
                      
                      {widget.data.masteryPercentage !== undefined && (
                        <div className="mt-3 flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">Dominio:</span>
                            <span className={`text-sm font-bold ${
                              widget.data.masteryPercentage >= 80 ? 'text-emerald-600' :
                              widget.data.masteryPercentage >= 50 ? 'text-amber-600' :
                              'text-rose-600'
                            }`}>
                              {widget.data.masteryPercentage}%
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">Mazos:</span>
                            <span className="text-sm font-semibold text-slate-700">
                              {widget.data.decksCount}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <button className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-indigo-50 rounded-lg">
                      <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
