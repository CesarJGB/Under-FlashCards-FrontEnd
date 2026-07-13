import { ArrowLeft } from 'lucide-react';

export default function StudyModesList({ methods, onBack, onSelectMethod }) {
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
        <h1 className="text-xl font-black tracking-tight text-slate-900">Modos de Estudio</h1>
      </div>

      <div className="flex flex-col gap-2.5">
        {methods.map((method) => {
          const Icon = method.icon;
          return (
            <div
              key={method.id}
              className={`p-4 rounded-2xl border bg-white flex items-center gap-4 transition-all duration-200 group ${
                method.active
                  ? 'border-slate-200 shadow-3xs hover:shadow-xs hover:border-slate-300 cursor-pointer active:scale-[0.99]'
                  : 'opacity-60 border-dashed border-slate-200 cursor-not-allowed select-none'
              }`}
              onClick={() => method.active && onSelectMethod(method.id)}
            >
              <div className={`p-3 rounded-xl bg-gradient-to-br ${method.color} text-white shadow-xs shrink-0`}>
                <Icon className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    {method.title}
                  </h3>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 ${
                    method.active ? 'bg-amber-50 text-amber-700 border border-amber-200/40' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {method.badge}
                  </span>
                </div>

                {method.active ? (
                  <div className="text-xs font-bold text-indigo-600 mt-1 flex items-center gap-1 transition-all group-hover:text-indigo-700">
                    Elegir mazo y comenzar ➔
                  </div>
                ) : (
                  <div className="text-xs font-medium text-slate-400 mt-1">
                    No disponible
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
