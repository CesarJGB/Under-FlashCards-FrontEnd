import React, { useState } from 'react';
import { Infinity, Calendar, BookOpen } from 'lucide-react';
import BlankCategoryView from './study/BlankCategoryView';
import CategoryGrid from './study/CategoryGrid';
import DailyChallengeCard from './study/DailyChallengeCard';
import StudyDeckSelector from './study/StudyDeckSelector';
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
    <StudyDeckSelector
      decks={decks}
      materias={materias}
      modeLabel={currentMethodObj?.title}
      onBack={() => setSelectedMethod(null)}
      onSelectDeck={(deck) => onOpenReview(deck, currentMethodObj?.modeMapping)}
    />
  );
}
