import { ArrowLeft, Layers } from 'lucide-react';

export default function BlankCategoryView({ title, onBack }) {
  return (
    <div className="space-y-6 animate-[fadeIn_0.15s_ease]">
      <div className="flex items-center gap-3 border-b border-slate-200/60 pb-4">
        <button
          type="button"
          onClick={onBack}
          className="h-9 w-9 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl flex items-center justify-center text-slate-600 active:scale-95 transition-all cursor-pointer shadow-3xs"
          title="Volver a categorías"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-xl font-black tracking-tight text-slate-900">{title}</h1>
      </div>

      <div className="border border-dashed border-slate-200 bg-white rounded-2xl p-8 text-center max-w-md mx-auto mt-6">
        <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto mb-3">
          <Layers className="w-5 h-5" />
        </div>
        <h4 className="text-sm font-bold text-slate-800">Próximamente</h4>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
          Todavía no hay contenido aquí.
        </p>
      </div>
    </div>
  );
}
