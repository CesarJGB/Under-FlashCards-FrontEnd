import { ArrowLeft, Download, FileText } from 'lucide-react';

export default function StudyFeaturesList({ features, onBack, onSelectFeature }) {
  return (
    <div className="space-y-4 animate-[fadeIn_0.15s_ease] md:-mt-2">
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={onBack}
          className="h-9 w-9 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl flex items-center justify-center text-slate-600 active:scale-95 transition-all cursor-pointer shadow-3xs"
          title="Volver a categorías"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-xl font-black tracking-tight text-slate-900">Funcionalidades</h1>
      </div>

      <div className="flex flex-col gap-2.5">
        {features.map((feature) => {
          const Icon = feature.id === 'cards' ? Download : FileText;

          return (
            <button
              key={feature.id}
              type="button"
              onClick={() => onSelectFeature(feature)}
              className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-3xs transition-all duration-200 hover:border-slate-300 hover:shadow-xs active:scale-[0.99] cursor-pointer"
            >
              <span className={`shrink-0 rounded-xl bg-gradient-to-br ${feature.color} p-3 text-white shadow-xs`}>
                <Icon className="h-5 w-5" />
              </span>

              <span className="flex min-w-0 flex-1 flex-col justify-center">
                <span className="text-sm font-bold tracking-tight text-slate-900">{feature.title}</span>
                <span className="mt-1 text-xs font-medium leading-relaxed text-slate-500">{feature.description}</span>
                <span className="mt-1 flex items-center gap-1 text-xs font-bold text-indigo-600 transition-all group-hover:text-indigo-700">
                  {'Elegir mazo y descargar PDF ->'}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
