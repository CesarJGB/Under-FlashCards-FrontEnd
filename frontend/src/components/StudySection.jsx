import React, { useState } from 'react';
import { Infinity, Calendar, ArrowLeft, Layers } from 'lucide-react';
import DeckCard from './DeckCard';

export default function StudySection({ decks, materias, userId, userEmail, onOpenReview }) {
  const [selectedMethod, setSelectedMethod] = useState(null);

  const methods = [
    {
      id: 'continuous',
      title: 'Repaso Continuo',
      description: 'Bucle infinito sin bloqueos de fecha. El algoritmo prioriza automáticamente tus fallos recientes y conceptos de alta fricción.',
      icon: Infinity,
      color: 'from-amber-500 to-orange-600',
      badge: 'Recomendado',
      active: true,
      modeMapping: 'continuous-review'
    },
    {
      id: 'anki',
      title: 'Método Anki Estricto',
      description: 'Calendario predictivo basado en el algoritmo SM2. Las tarjetas se ocultan de forma inteligente hasta que toque repasarlas según tu curva del olvido.',
      icon: Calendar,
      color: 'from-blue-500 to-indigo-600',
      badge: 'Próximamente',
      active: false,
      modeMapping: 'anki-review'
    }
  ];

  const currentMethodObj = methods.find(m => m.id === selectedMethod);
  const isAdmin = userEmail === "cesarjaviervebe@gmail.com";

  // VISTA 1: Catálogo de Estrategias de Estudio (Optimizado para no duplicar Header)
  if (!selectedMethod) {
    return (
      <div className="space-y-4 animate-[fadeIn_0.15s_ease] md:-mt-2">
        <div className="hidden md:block">
          <h1 className="text-xl font-black tracking-tight text-slate-900">Modo de Estudio</h1>
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
                onClick={() => method.active && setSelectedMethod(method.id)}
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

  // VISTA 2: Selector del Mazo a entrenar (Mantiene consistencia estructural)
  return (
    <div className="space-y-6 animate-[fadeIn_0.15s_ease]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/60 pb-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setSelectedMethod(null)}
            className="h-9 w-9 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl flex items-center justify-center text-slate-600 active:scale-95 transition-all cursor-pointer shadow-3xs"
            title="Volver a estrategias"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-slate-900 text-white font-extrabold px-2 py-0.5 rounded-md tracking-wide uppercase">
                {currentMethodObj?.title}
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-1">Selecciona el mazo para entrenar</h2>
          </div>
        </div>
      </div>

      {decks.length > 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 pb-12">
          {decks.map((deck) => (
            <DeckCard 
              key={deck.id} 
              deck={deck} 
              currentUserId={userId} 
              isAdmin={isAdmin} 
              isList={false} 
              onOpen={(dk) => onOpenReview(dk, currentMethodObj?.modeMapping)} 
            />
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-slate-200 bg-white rounded-2xl p-8 text-center max-w-md mx-auto mt-6">
          <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Layers className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-slate-800">No hay mazos en tu biblioteca</h4>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Necesitas tener al menos un mazo configurado en tu biblioteca para poder iniciar un entrenamiento estratégico.
          </p>
        </div>
      )}
    </div>
  );
}
