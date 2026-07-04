import React, { useMemo, useEffect, useState, useCallback } from 'react';
import RadarDebugPanel from './RadarDebugPanel';
import GlobalStatsHeader from './home/GlobalStatsHeader';
import QuickViewGrid from './home/QuickViewGrid';
import DetailedMateriasGrid from './home/DetailedMateriasGrid';
import UnclassifiedDecksSection from './home/UnclassifiedDecksSection';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export default function HomeSection({ 
  user,          
  decks,         
  materias,      
  onOpenReview,  
  onLogout,
  loadDecks,     
  loadMaterias   
}) {

  // =========================================================================
  // 🔄 DISPARADOR DE SINCRONIZACIÓN PASIVA EN SEGUNDO PLANO
  // =========================================================================
  useEffect(() => {
    if (typeof loadDecks === 'function') loadDecks();
    if (typeof loadMaterias === 'function') loadMaterias();
  }, [loadDecks, loadMaterias]);

  const [domainPreviews, setDomainPreviews] = useState({});

  const fetchDomainPreviews = useCallback(async () => {
    if (!materias) return;
    const filtered = materias.filter(m => {
      const ap = m.activeParciales;
      return ap && ap.length > 0 && ap.length < 3;
    });
    if (filtered.length === 0) return;

    const results = {};
    await Promise.all(filtered.map(async (m) => {
      try {
        const id = m._id || m.id;
        const res = await fetch(`${BACKEND_URL}/api/academic/materias/${id}/domain-preview?parciales=${m.activeParciales.join(',')}`);
        if (res.ok) {
          const data = await res.json();
          results[id] = data.mastery;
        }
      } catch {}
    }));
    setDomainPreviews(results);
  }, [materias]);

  useEffect(() => { fetchDomainPreviews(); }, [fetchDomainPreviews]);

  // =========================================================================
  // MOTOR DE PROCESAMIENTO REACTIVO EN MEMORIA (0ms)
  // =========================================================================
  const { enrichedMaterias, unclassifiedDecks, globalStats } = useMemo(() => {
    if (!materias || !decks) {
      return { enrichedMaterias: [], unclassifiedDecks: [], globalStats: { totalCards: 0, globalMastery: 0 } };
    }

    const enriched = materias.map(materia => {
      const currentMateriaId = String(materia._id || materia.id || '');
      const materiaDecks = decks.filter(d => String(d.materiaId || '') === currentMateriaId);
      const totalCards = materiaDecks.reduce((acc, curr) => acc + (curr.cardCount || 0), 0);
      const uniqueTemasCount = materia.themesCount || new Set(materiaDecks.map(d => d.temaId).filter(Boolean)).size;

      const ap = materia.activeParciales || [1, 2, 3];
      const isFiltered = ap.length > 0 && ap.length < 3;
      const masteryPercentage = isFiltered && domainPreviews[currentMateriaId] !== undefined
        ? domainPreviews[currentMateriaId]
        : (materia.analytics?.masteryPercentage ?? 0);

      return {
        ...materia,
        id: currentMateriaId,
        title: materia.name || materia.title || 'Asignatura sin nombre',
        decksCount: materiaDecks.length,
        temasCount: uniqueTemasCount,
        totalCards,
        masteryPercentage,
        activeParciales: ap
      };
    });

    const unclassified = decks.filter(deck => {
      if (!deck.materiaId) return true;
      return !materias.some(m => String(m._id || m.id) === String(deck.materiaId));
    });

    const totalCardsGlobal = decks.reduce((acc, curr) => acc + (curr.cardCount || 0), 0);
    const activeMaterias = enriched.filter(m => m.decksCount > 0);
    const globalMasterySum = activeMaterias.reduce((acc, curr) => acc + curr.masteryPercentage, 0);
    const globalMastery = activeMaterias.length > 0 ? Math.round(globalMasterySum / activeMaterias.length) : 0;

    return {
      enrichedMaterias: enriched,
      unclassifiedDecks: unclassified,
      globalStats: { totalCards: totalCardsGlobal, globalMastery }
    };
  }, [materias, decks, user, domainPreviews]);

  /**
   * REFACTORIZACIÓN DE ESTILOS: Control de acentos semánticos de alta legibilidad
   */
  const getParcialesLabel = (activeParciales) => {
    if (!activeParciales || activeParciales.length === 0 || activeParciales.length === 3) return null;
    if (activeParciales.length === 1) return `Parcial ${activeParciales[0]}`;
    return `Parcial ${activeParciales.join(' y Parcial ')}`;
  };

  const getParcialesBadge = (activeParciales) => {
    if (!activeParciales || activeParciales.length === 0 || activeParciales.length === 3) return null;
    if (activeParciales.length === 1) return `Parcial ${activeParciales[0]}`;
    return `Parcial ${activeParciales.join(' y Parcial ')}`;
  };

  const getKnowledgeAccent = (percentage) => {
    if (percentage >= 80) return {
      borderLeft: 'border-l-emerald-500',
      badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      bar: 'bg-emerald-500',
      circle: 'text-emerald-500'
    };
    if (percentage >= 50) return {
      borderLeft: 'border-l-amber-500',
      badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      bar: 'bg-amber-500',
      circle: 'text-amber-500'
    };
    return {
      borderLeft: 'border-l-rose-500',
      badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400', 
      bar: 'bg-rose-500',
      circle: 'text-rose-500'
    };
  };

  return (
    <div className="w-full space-y-8 animate-[fadeIn_0.15s_ease]">
      
      {/* Resumen Global */}
      <GlobalStatsHeader 
        user={user} 
        globalStats={globalStats} 
      />

      {/* Nuevo Grid Compacto de Materias */}
      <QuickViewGrid 
        enrichedMaterias={enrichedMaterias}
        getKnowledgeAccent={getKnowledgeAccent}
        getParcialesBadge={getParcialesBadge}
      />

      {/* Grid Detallado de Materias (Original) */}
      <DetailedMateriasGrid 
        enrichedMaterias={enrichedMaterias}
        getKnowledgeAccent={getKnowledgeAccent}
        getParcialesLabel={getParcialesLabel}
      />

      {/* Mazos Fuera de la Jerarquía */}
      <UnclassifiedDecksSection 
        unclassifiedDecks={unclassifiedDecks}
        onOpenReview={onOpenReview}
      />

      {/* ⚡ PANEL DE TELEMETRÍA Y DEBUGGING DEL RADAR DE CONOCIMIENTO */}
      {import.meta.env.DEV && (
        <RadarDebugPanel
          userId={user?.id}
          decks={decks}
          loadDecks={loadDecks}
          loadMaterias={loadMaterias}
        />
      )}

    </div>
  );
}

