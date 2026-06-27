import React, { useState } from 'react';
import { Infinity, Calendar, ArrowLeft, Layers } from 'lucide-react';
import DeckCard from './DeckCard'; // 👈 REUTILIZACIÓN ATÓMICA: Tu componente nativo de la biblioteca

export default function StudySection({ decks, materias, userId, userEmail, onOpenReview }) {
  const [selectedMethod, setSelectedMethod] = useState(null);

  const methods = [
    {
      id: 'continuous',
      title: 'Repaso Continuo',
      description: 'Bucle infinito sin bloqueos de fecha. El algoritmo prioriza automáticamente tus fallos recientes y conceptos de alta fricción.',
      icon: Infinity,
      color: 'from-amber-500 to-orange-600',
      badge: 'Recomendado Pre-Examen',
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

  // VISTA 1: Catálogo de Estrategias de Estudio
  if (!selectedMethod) {
    return (
      <div className="space-y-6 animate-[fadeIn_0.15s_ease]">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Modo de Estudio</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Selecciona una estrategia de entrenamiento cognitivo para tus flashcards.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {methods.map((method) => {
            const Icon = method.icon;
            return (
              <div 
                key={method.id}
                className={`p-5 rounded-2xl border bg-white text-left transition-all duration-200 group ${
                  method.active 
                    ? 'border-slate-200 shadow-3xs hover:shadow-md cursor-pointer hover:border-slate-300 active:scale-[0.99]' 
                    : 'opacity-60 border-dashed border-slate-200 cursor-not-allowed select-none'
                }`}
                onClick={() => method.active && setSelectedMethod(method.id)}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-2.5 rounded-xl bg-gradient-to-br ${method.color} text-white shadow-sm`}>
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
                  <div className="flex items-center text-xs font-bold text-indigo-600 gap-1 transition-all group-hover:gap-2">
                    Elegir mazo y comenzar ➔
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // VISTA 2: Selector del Mazo a entrenar (Idéntico a tu Biblioteca)
  return (
    <div className="space-y-6 animate-[fadeIn_0.15s_ease]">
      {/* ENCABEZADO Y CONTROL DE NAVEGACIÓN RETROACTIVA */}
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

      {/* CUADRÍCULA NATIVA USANDO TU COMPONENTE DECKCARD */}
      {decks.length > 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 pb-12">
          {decks.map((deck) => (
            <DeckCard 
              key={deck.id} 
              deck={deck} 
              currentUserId={userId} 
              isAdmin={isAdmin} 
              isList={false} // Forzamos siempre el modo Grid/Cuadrícula que se ve espectacular
              onOpen={(dk) => onOpenReview(dk, currentMethodObj?.modeMapping)} // Inyecta el modo de juego estratégico
              
              /* Omitimos intencionalmente las mutaciones CRUD (onEdit, onDelete, etc.) 
                 para que actúe puramente como un disparador inmersivo de juego */
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
