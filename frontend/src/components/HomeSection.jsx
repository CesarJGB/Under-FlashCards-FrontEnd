import React, { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import RadarDebugPanel from './RadarDebugPanel';
import GlobalStatsHeader from './home/GlobalStatsHeader';
import QuickViewGrid from './home/QuickViewGrid';
import DetailedMateriasGrid from './home/DetailedMateriasGrid';
import UnclassifiedDecksSection from './home/UnclassifiedDecksSection';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const DOMAIN_PREVIEWS_TTL_MS = 15 * 60 * 1000; // 15 minutos

export default function HomeSection({ 
  user,          
  decks,         
  materias,      
  onOpenReview,  
  onNavigateToLibrary,
  onLogout,
  loadDecks,     
  loadMaterias   
}) {
  const [homeVisibility, setHomeVisibility] = useState({
    quickView: true,
    detailedView: false,
    unclassifiedDecks: false
  });

  const isMounted = useRef(true);
  const abortController = useRef(null);
  const requestSeq = useRef(0);

  // Escuchar actualizaciones/invalidation disparadas por otras secciones (Library) para evitar parpadeos
  useEffect(() => {
    const handleUpdate = (e) => {
      try {
        const detail = e?.detail || {};
        if (!detail || String(detail.userId) !== String(user?.id)) return;
        const materiaId = String(detail.materiaId);
        const preview = detail.preview;
        if (!preview) return;
        setDomainPreviews(prev => {
          if (prev && typeof prev[materiaId] === 'number' && prev[materiaId] === preview.mastery) return prev;
          return { ...(prev || {}), [materiaId]: preview.mastery };
        });
      } catch (err) {
        console.error('[HomeSection] Error handling domainPreviews:update event', err);
      }
    };

    const handleInvalidate = (e) => {
      try {
        const detail = e?.detail || {};
        if (!detail || String(detail.userId) !== String(user?.id)) return;
        const materiaId = String(detail.materiaId);
        setDomainPreviews(prev => {
          if (!prev || !(materiaId in prev)) return prev;
          const next = { ...prev };
          delete next[materiaId];
          return next;
        });
      } catch (err) {
        console.error('[HomeSection] Error handling domainPreviews:invalidate event', err);
      }
    };

    window.addEventListener('domainPreviews:update', handleUpdate);
    window.addEventListener('domainPreviews:invalidate', handleInvalidate);
    return () => {
      window.removeEventListener('domainPreviews:update', handleUpdate);
      window.removeEventListener('domainPreviews:invalidate', handleInvalidate);
    };
  }, [user?.id]);

  // =========================================================================
  // 🔄 DISPARADOR DE SINCRONIZACIÓN PASIVA EN SEGUNDO PLANO
  // =========================================================================
  useEffect(() => {
    if (typeof loadDecks === 'function') loadDecks();
    if (typeof loadMaterias === 'function') loadMaterias();
  }, [loadDecks, loadMaterias]);

  // Cargar preferencias de visibilidad del home
  useEffect(() => {
    if (!user?.id) return;
    
    const loadVisibility = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/users/${user.id}/preferences`);
        if (res.ok) {
          const data = await res.json();
          if (data.homeSectionVisibility) {
            setHomeVisibility(data.homeSectionVisibility);
          }
        }
      } catch (error) {
        console.error('Error al cargar visibilidad del home:', error);
      }
    };
    
    loadVisibility();
  }, [user?.id]);

  // =========================================================================
  // 🎯 INICIALIZACIÓN SINCRÓNICA DESDE CACHÉ (sin fase intermedia)
  // =========================================================================
  const [domainPreviews, setDomainPreviews] = useState(() => {
    if (!user?.id) return {};
    
    const cached = localStorage.getItem(`domainPreviews_${user.id}`);
    if (!cached) return {};
    
    try {
      const parsed = JSON.parse(cached);
      
      // Validar estructura y extraer solo los valores de mastery
      if (typeof parsed === 'object' && parsed !== null) {
        const masteryMap = {};
        
        Object.entries(parsed).forEach(([id, data]) => {
          // Si es la estructura nueva (objeto con mastery)
          if (data && typeof data === 'object' && 'mastery' in data) {
            masteryMap[id] = data.mastery;
          }
          // Si es la estructura antigua (número directo)
          else if (typeof data === 'number') {
            masteryMap[id] = data;
          }
        });
        
        return masteryMap;
      }
    } catch {
      // Caché corrupto, limpiar y retornar vacío
      localStorage.removeItem(`domainPreviews_${user.id}`);
    }
    return {};
  });

  // =========================================================================
  // 🔄 FETCH SILENCIOSO CON VALIDACIÓN DE TTL
  // =========================================================================
  const fetchDomainPreviews = useCallback(async () => {
    // Incremental request id to prevent out-of-order responses from overwriting newer data
    const myRequestId = ++requestSeq.current;

    if (!materias || !user?.id) return;

    const filtered = materias.filter(m => {
      const ap = m.activeParciales;
      return ap && ap.length > 0 && ap.length < 3;
    });

    if (filtered.length === 0) {
      setDomainPreviews({});
      return;
    }

    // 1. Leer caché actual
    let cachedPreviews = {};
    const cached = localStorage.getItem(`domainPreviews_${user.id}`);
    if (cached) {
      try {
        cachedPreviews = JSON.parse(cached);
      } catch {
        cachedPreviews = {};
      }
    }

    // 2. Determinar qué materias necesitan fetch
    const needsFetch = filtered.filter(m => {
      const id = String(m._id || m.id);
      const cached = cachedPreviews[id];
      
      if (!cached) return true;
      
      // Validar TTL
      const cacheAge = Date.now() - (cached.timestamp || 0);
      if (cacheAge > DOMAIN_PREVIEWS_TTL_MS) return true;
      
      // Validar que los parciales coinciden
      const currentParciales = m.activeParciales || [];
      const cachedParciales = cached.parciales || [];
      
      if (currentParciales.length !== cachedParciales.length) return true;
      
      const currentSorted = [...currentParciales].sort();
      const cachedSorted = [...cachedParciales].sort();
      
      for (let i = 0; i < currentSorted.length; i++) {
        if (currentSorted[i] !== cachedSorted[i]) return true;
      }
      
      return false;
    });

    // 3. Si no necesita fetch, inicializar con caché y salir
    if (needsFetch.length === 0) {
      setDomainPreviews(prev => {
        const updated = {};
        filtered.forEach(m => {
          const id = String(m._id || m.id);
          if (cachedPreviews[id] && typeof cachedPreviews[id] === 'object') {
            updated[id] = cachedPreviews[id].mastery;
          }
        });
        
        // Solo actualizar si cambió algo
        if (JSON.stringify(prev) === JSON.stringify(updated)) return prev;
        return updated;
      });
      return;
    }

    // 4. Fetch silencioso en background
    if (abortController.current) abortController.current.abort();
    const controller = new AbortController();
    abortController.current = controller;

    const results = { ...cachedPreviews };
    let hasChanges = false;

    await Promise.all(needsFetch.map(async (m) => {
      try {
        const id = String(m._id || m.id);
        const res = await fetch(
          `${BACKEND_URL}/api/academic/materias/${id}/domain-preview?parciales=${m.activeParciales.join(',')}`,
          { signal: controller.signal }
        );
        
        if (res.ok) {
          const data = await res.json();
          results[id] = {
            mastery: data.mastery,
            parciales: data.parciales,
            timestamp: Date.now(),
            metrics: data.metrics
          };
          hasChanges = true;
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('[HomeSection] Error fetching domain preview:', error);
        }
      }
    }));

    // 5. Guardar en caché y actualizar state solo si cambió y esta es la última petición
    if (hasChanges && isMounted.current && requestSeq.current === myRequestId) {
      try {
        localStorage.setItem(`domainPreviews_${user.id}`, JSON.stringify(results));
      } catch (error) {
        console.error('[HomeSection] Error saving to localStorage:', error);
      }

      setDomainPreviews(prev => {
        const updated = {};
        filtered.forEach(m => {
          const id = String(m._id || m.id);
          if (results[id] && typeof results[id] === 'object') {
            updated[id] = results[id].mastery;
          }
        });
        
        // Solo actualizar si cambió algo
        if (JSON.stringify(prev) === JSON.stringify(updated)) return prev;
        return updated;
      });
    }

    // Limpiar controller si sigue siendo el actual
    if (abortController.current === controller) {
      abortController.current = null;
    }
  }, [materias, user?.id]);

  // =========================================================================
  // 🚀 EJECUTAR FETCH AL MONTAR Y CUANDO CAMBIEN LAS MATERIAS
  // =========================================================================
  useEffect(() => {
    isMounted.current = true;
    fetchDomainPreviews();
    
    return () => {
      isMounted.current = false;
      if (abortController.current) {
        abortController.current.abort();
        abortController.current = null;
      }
    };
  }, [fetchDomainPreviews]);

  // =========================================================================
  // MOTOR DE PROCESAMIENTO REACTIVO EN MEMORIA (0ms)
  // =========================================================================
  // Agrupar los mazos por materia para evitar filtros O(N*M) dentro del map
  const decksByMateria = useMemo(() => {
    if (!decks) return {};
    return decks.reduce((acc, deck) => {
      const materiaId = String(deck.materiaId || '');
      if (!acc[materiaId]) acc[materiaId] = [];
      acc[materiaId].push(deck);
      return acc;
    }, {});
  }, [decks]);

  // Huella simplificada de domainPreviews para evitar recomputos por referencia
  const domainPreviewsKey = useMemo(
    () => JSON.stringify(domainPreviews),
    [domainPreviews]
  );

  const { enrichedMaterias, unclassifiedDecks, globalStats } = useMemo(() => {
    if (!materias || !decks) {
      return { enrichedMaterias: [], unclassifiedDecks: [], globalStats: { totalCards: 0, globalMastery: 0 } };
    }

    const enriched = materias.map(materia => {
      const currentMateriaId = String(materia._id || materia.id || '');
      const materiaDecks = decksByMateria[currentMateriaId] || [];
      const totalCards = materiaDecks.reduce((acc, curr) => acc + (curr.cardCount || 0), 0);
      const uniqueTemasCount = materia.themesCount || new Set(materiaDecks.map(d => d.temaId).filter(Boolean)).size;

      const ap = materia.activeParciales || [1, 2, 3];
      const isFiltered = ap.length > 0 && ap.length < 3;
      
      // Usar domainPreviews si está disponible, sino fallback a analytics general
      const masteryPercentage = isFiltered && typeof domainPreviews[currentMateriaId] === 'number'
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
  }, [materias, decks, domainPreviewsKey]);

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

      {/* Vista Rápida */}
      {homeVisibility.quickView && (
        <QuickViewGrid 
          enrichedMaterias={enrichedMaterias}
          getKnowledgeAccent={getKnowledgeAccent}
          getParcialesBadge={getParcialesBadge}
          userId={user?.id}
          onMateriaClick={onNavigateToLibrary}
        />
      )}

      {/* Vista Detallada */}
      {homeVisibility.detailedView && (
        <DetailedMateriasGrid 
          enrichedMaterias={enrichedMaterias}
          getKnowledgeAccent={getKnowledgeAccent}
          getParcialesLabel={getParcialesLabel}
        />
      )}

      {/* Mazos Sueltos */}
      {homeVisibility.unclassifiedDecks && (
        <UnclassifiedDecksSection 
          unclassifiedDecks={unclassifiedDecks}
          onOpenReview={onOpenReview}
        />
      )}

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
