import React, { useState } from 'react';
import { Infinity, Calendar, ArrowLeft, Layers, BookOpen } from 'lucide-react';
import DeckCard from './DeckCard';
import BlankCategoryView from './study/BlankCategoryView';
import CategoryGrid from './study/CategoryGrid';
import DailyChallengeCard from './study/DailyChallengeCard';
import StudyModesList from './study/StudyModesList';

export default function StudySection({ decks, materias, userId, userEmail, onOpenReview }) {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState(null);

  const methods = [
    {
      id: 'normal',
      title: 'Repaso Normal',
      description: 'Recorre el mazo completo en orden aleatorio, sin priorizar errores. Ideal para una primera pasada o repasar todo el contenido.',
      icon: BookOpen,
      color: 'from-emerald-500 to-teal-600',
      badge: 'Para empezar',
      active: true,
      modeMapping: 'normal-review'
    },
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
  const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;
  const isAdmin = userEmail === ADMIN_EMAIL;

  if (!selectedCategory) {
    return (
      <div className="space-y-5 animate-[fadeIn_0.15s_ease] pt-1 md:-mt-2">
        <h1 className="mt-2 text-xl font-black tracking-tight text-slate-900">Modo de Estudio</h1>
        <DailyChallengeCard />
        <CategoryGrid onSelectCategory={setSelectedCategory} />
      </div>
    );
  }

  if (selectedCategory === 'minigames') {
    return <BlankCategoryView title="Minijuegos" onBack={() => setSelectedCategory(null)} />;
  }

  if (selectedCategory === 'features') {
    return <BlankCategoryView title="Funcionalidades" onBack={() => setSelectedCategory(null)} />;
  }

  if (!selectedMethod) {
    return (
      <StudyModesList
        methods={methods}
        onBack={() => setSelectedCategory(null)}
        onSelectMethod={setSelectedMethod}
      />
    );
  }

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
