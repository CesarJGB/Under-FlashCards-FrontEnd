import React, { useState } from 'react';
import { Infinity, Calendar, BookOpen } from 'lucide-react';
import BlankCategoryView from './study/BlankCategoryView';
import CategoryGrid from './study/CategoryGrid';
import DailyChallengeCard from './study/DailyChallengeCard';
import StudyDeckSelector from './study/StudyDeckSelector';
import StudyFeaturesList from './study/StudyFeaturesList';
import StudyModesList from './study/StudyModesList';
import ExamFoldersView from './study/ExamFoldersView';
import usePdfExport from '../hooks/usePdfExport';
import PdfExportOverlay from './PdfExportOverlay';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export default function StudySection({ decks, materias, userId, userEmail, onOpenReview, dashboardShell }) {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [selectedFeature, setSelectedFeature] = useState(null);
  const pdfExport = usePdfExport();

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

  const pdfFeatures = [
    {
      id: 'guide',
      title: 'Guía de estudio',
      description: 'Descarga un PDF continuo con todas las preguntas y respuestas para lectura estática.',
      color: 'from-indigo-500 to-violet-600',
    },
    {
      id: 'cards',
      title: 'Tarjetas imprimibles',
      description: 'Genera cuadrículas listas para imprimir, recortar y estudiar fuera de pantalla.',
      color: 'from-emerald-500 to-teal-600',
    },
    {
      id: 'questions',
      title: 'Banco de preguntas',
      description: 'Exporta las preguntas numeradas con soporte para imágenes frontales.',
      color: 'from-amber-500 to-orange-600',
    },
    {
      id: 'answers',
      title: 'Banco de respuestas',
      description: 'Genera las respuestas numeradas para practicar tu autoevaluación.',
      color: 'from-cyan-500 to-blue-600',
    },
  ];

  const currentMethodObj = methods.find(m => m.id === selectedMethod);

  const handlePdfExport = async (deck) => {
    if (!selectedFeature) return;

    await pdfExport.exportPdf({
      deck,
      type: selectedFeature.id,
      loadCards: async (signal) => {
        const response = await fetch(`${BACKEND_URL}/api/flashcards/deck/${deck.id}`, { signal });
        if (!response.ok) throw new Error('No se pudieron cargar las tarjetas del mazo.');
        return response.json();
      },
    });
  };
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

  if (selectedCategory === 'exams') {
    return (
      <ExamFoldersView
        userId={userId}
        decks={decks}
        materias={materias}
        onBack={() => setSelectedCategory(null)}
        dashboardShell={dashboardShell}
      />
    );
  }

  if (selectedCategory === 'features') {
    if (!selectedFeature) {
      return (
        <StudyFeaturesList
          features={pdfFeatures}
          onBack={() => setSelectedCategory(null)}
          onSelectFeature={(feature) => {
            pdfExport.reset();
            setSelectedFeature(feature);
          }}
        />
      );
    }

    return (
      <>
        <StudyDeckSelector
          decks={decks}
          materias={materias}
          modeLabel={selectedFeature.title}
          onBack={() => {
            pdfExport.reset();
            setSelectedFeature(null);
          }}
          onSelectDeck={handlePdfExport}
          isProcessing={pdfExport.isExporting}
          processingMessage={pdfExport.progress.message}
          errorMessage={pdfExport.error}
          warnings={pdfExport.warnings}
        />
        <PdfExportOverlay
          isOpen={pdfExport.isExporting}
          progress={pdfExport.progress}
          onCancel={pdfExport.cancel}
        />
      </>
    );
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
