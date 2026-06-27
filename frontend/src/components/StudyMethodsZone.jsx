import React from 'react';
import { Infinity, Calendar, Zap, ArrowRight } from 'lucide-react';

export default function StudyMethodsZone({ onSelectMethod }) {
  const methods = [
    {
      id: 'continuous',
      title: 'Repaso Continuo',
      description: 'Bucle infinito sin bloqueos de fecha. El algoritmo prioriza automáticamente tus fallos recientes y conceptos de alta fricción.',
      icon: Infinity,
      color: 'from-amber-500 to-orange-600',
      badge: 'Recomendado Pre-Examen',
      active: true
    },
    {
      id: 'anki',
      title: 'Método Anki Estricto',
      description: 'Calendario predictivo basado en el algoritmo SM2. Las tarjetas se ocultan de forma inteligente hasta que toque repasarlas según tu curva del olvido.',
      icon: Calendar,
      color: 'from-blue-500 to-indigo-600',
      badge: 'Próximamente',
      active: false
    }
  ];

  return (
    <div className="my-6 animate-[fadeIn_0.15s_ease]">
      <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-6">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
          Selecciona tu Estrategia de Estudio
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {methods.map((method) => {
            const Icon = method.icon;
            return (
              <div 
                key={method.id}
                className={`p-5 rounded-2xl border bg-white text-left transition-all duration-200 ${
                  method.active 
                    ? 'border-slate-200 shadow-xs hover:shadow-md cursor-pointer hover:border-slate-300' 
                    : 'opacity-65 border-dashed border-slate-200 cursor-not-allowed select-none'
                }`}
                onClick={() => method.active && onSelectMethod(method.id)}
              >
                <div className="flex justify-between items-start mb-3.5">
                  <div className={`p-2.5 rounded-xl bg-gradient-to-br ${method.color} text-white shadow-xs`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    method.active ? 'bg-amber-50 text-amber-700 border border-amber-200/40' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {method.badge}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">{method.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-4">{method.description}</p>
                
                {method.active && (
                  <div className="flex items-center text-xs font-bold text-indigo-600 gap-1 group-hover:gap-2 transition-all">
                    Comenzar entrenamiento <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
