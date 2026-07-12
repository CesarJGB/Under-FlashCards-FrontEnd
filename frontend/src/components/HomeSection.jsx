import React, { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import RadarDebugPanel from './RadarDebugPanel';
import HomeHeader from './home/HomeHeader';
import WidgetCarousel from './home/WidgetCarousel';
import GlobalStatsHeader from './home/GlobalStatsHeader';
import QuickViewGrid from './home/QuickViewGrid';
import DetailedMateriasGrid from './home/DetailedMateriasGrid';
import UnclassifiedDecksSection from './home/UnclassifiedDecksSection';
import WidgetCarouselExpanded from './home/WidgetCarouselExpanded';
import { getJSON, setJSON, remove } from '../lib/safeLocalStorage';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const DOMAIN_PREVIEWS_TTL_MS = 15 * 60 * 1000; // 15 minutos
const DEFAULT_WIDGET_ORDER = [0, 1, 2, 3];

function normalizeWidgetOrder(order) {
  if (!Array.isArray(order)) return DEFAULT_WIDGET_ORDER;

  const allowedIds = new Set(DEFAULT_WIDGET_ORDER);
  const uniqueIds = [];

  order.forEach((id) => {
    if (!allowedIds.has(id)) return;
    if (uniqueIds.includes(id)) return;
    uniqueIds.push(id);
  });

  const missingIds = DEFAULT_WIDGET_ORDER.filter((id) => !uniqueIds.includes(id));
  return [...uniqueIds, ...missingIds];
}

function rotateWidgetOrder(order, offset) {
  if (!Array.isArray(order) || order.length === 0) return [];

  const normalizedOffset = ((offset % order.length) + order.length) % order.length;
  if (normalizedOffset === 0) return order;

  return [...order.slice(normalizedOffset), ...order.slice(0, normalizedOffset)];
}

export default function HomeSection({ 
  user,          
  decks,         
  materias,      
  onOpenReview,  
  onNavigateToLibrary,
  onLogout,
  loadDecks,     
  loadMaterias,
  onOpenProfile
}) {
  const [homeVisibility, setHomeVisibility] = useState({
    quickView: true,
    detailedView: false,
    unclassifiedDecks: false
  });

  // Estados para la librería expandida y el ordenamiento de los widgets
  const [showWidgetLibrary, setShowWidgetLibrary] = useState(false);
  const [preferredWidgetOrder, setPreferredWidgetOrder] = useState(DEFAULT_WIDGET_ORDER);
  const [widgetOffset, setWidgetOffset] = useState(0);
  const [hasLoadedPreferences, setHasLoadedPreferences] = useState(false);

  const isMounted = useRef(true);
  const abortController = useRef(null);
  const requestSeq = useRef(0);
  const lastSyncedWidgetOrder = useRef(JSON.stringify(DEFAULT_WIDGET_ORDER));
  const widgetOrderTouched = useRef(false);

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

  const handleWidgetOrderChange = useCallback((nextOrder) => {
    widgetOrderTouched.current = true;
    setPreferredWidgetOrder(normalizeWidgetOrder(nextOrder));
    setWidgetOffset(0);
  }, []);

  const handleCarouselShift = useCallback((direction) => {
    setWidgetOffset((prev) => {
      const totalWidgets = preferredWidgetOrder.length;
      if (totalWidgets <= 1) return 0;

      return direction > 0
        ? (prev + 1) % totalWidgets
        : (prev - 1 + totalWidgets) % totalWidgets;
    });
  }, [preferredWidgetOrder.length]);

  const visibleWidgetOrder = useMemo(
    () => rotateWidgetOrder(preferredWidgetOrder, widgetOffset),
    [preferredWidgetOrder, widgetOffset]
  );

  const preferredWidgetOrderKey = useMemo(
    () => JSON.stringify(preferredWidgetOrder),
    [preferredWidgetOrder]
  );

  // Cargar preferencias del home
  useEffect(() => {
    if (!user?.id) return;

    setHasLoadedPreferences(false);

    const loadPreferences = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/users/${user.id}/preferences`);
        if (res.ok) {
          const data = await res.json();
          if (data.homeSectionVisibility) {
            setHomeVisibility(data.homeSectionVisibility);
          }

          const serverWidgetOrder = normalizeWidgetOrder(data.homeWidgetOrder);
          lastSyncedWidgetOrder.current = JSON.stringify(serverWidgetOrder);

          if (!widgetOrderTouched.current) {
            setPreferredWidgetOrder(serverWidgetOrder);
            setWidgetOffset(0);
          }
        }
      } catch (error) {
        console.error('Error al cargar preferencias del home:', error);
      } finally {
        setHasLoadedPreferences(true);
      }
    };

    loadPreferences();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !hasLoadedPreferences) return;
    if (preferredWidgetOrderKey === lastSyncedWidgetOrder.current) return;

    const controller = new AbortController();
    const syncTimeout = window.setTimeout(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/users/${user.id}/preferences`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ homeWidgetOrder: preferredWidgetOrder }),
          signal: controller.signal
        });

        if (!res.ok) throw new Error('Error al sincronizar el orden de widgets');

        lastSyncedWidgetOrder.current = preferredWidgetOrderKey;
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error al guardar orden de widgets:', error);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(syncTimeout);
      controller.abort();
    };
  }, [hasLoadedPreferences, preferredWidgetOrder, preferredWidgetOrderKey, user?.id]);

  // =========================================================================
  // 🎯 INICIALIZACIÓN SINCRÓNICA DESDE CACHÉ (sin fase intermedia)
  // =========================================================================
  const [domainPreviews, setDomainPreviews] = useState(() => {
    if (!user?.id) return {};
    
    const parsed = getJSON(`domainPreviews_${user.id}`);
    if (!parsed) return {};
    
    try {
      if (typeof parsed === 'object' && parsed !== null) {
        const masteryMap = {};
        
        Object.entries(parsed).forEach(([id, data]) => {
          if (data && typeof data === 'object' && 'mastery' in data) {
            masteryMap[id] = data.mastery;
          }
          else if (typeof data === 'number') {
            masteryMap[id] = data;
          }
        });
        
        return masteryMap;
      }
    } catch {
      remove(`domainPreviews_${user.id}`);
    }
    return {};
  });

  // =========================================================================
  // 🔄 FETCH SILENCIOSO CON VALIDACIÓN DE TTL
  // =========================================================================
  const fetchDomainPreviews = useCallback(async () => {
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

    let cachedPreviews = getJSON(`domainPreviews_${user.id}`) || {};

    const needsFetch = filtered.filter(m => {
      const id = String(m._id || m.id);
      const cached = cachedPreviews[id];
      
      if (!cached) return true;
      
      const cacheAge = Date.now() - (cached.timestamp || 0);
      if (cacheAge > DOMAIN_PREVIEWS_TTL_MS) return true;
      
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

    if (needsFetch.length === 0) {
      setDomainPreviews(prev => {
        const updated = {};
        filtered.forEach(m => {
          const id = String(m._id || m.id);
          if (cachedPreviews[id] && typeof cachedPreviews[id] === 'object') {
            updated[id] = cachedPreviews[id].mastery;
          }
        });
        
        if (JSON.stringify(prev) === JSON.stringify(updated)) return prev;
        return updated;
      });
      return;
    }

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

    if (hasChanges && isMounted.current && requestSeq.current === myRequestId) {
      try {
        setJSON(`domainPreviews_${user.id}`, results);
      } catch (error) {
        console.error('[HomeSection] Error saving to localStorage via safeLocalStorage:', error);
      }

      setDomainPreviews(prev => {
        const updated = {};
        filtered.forEach(m => {
          const id = String(m._id || m.id);
          if (results[id] && typeof results[id] === 'object') {
            updated[id] = results[id].mastery;
          }
        });
        
        if (JSON.stringify(prev) === JSON.stringify(updated)) return prev;
        return updated;
      });
    }

    if (abortController.current === controller) {
      abortController.current = null;
    }
  }, [materias, user?.id]);

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
  const decksByMateria = useMemo(() => {
    if (!decks) return {};
    return decks.reduce((acc, deck) => {
      const materiaId = String(deck.materiaId || '');
      if (!acc[materiaId]) acc[materiaId] = [];
      acc[materiaId].push(deck);
      return acc;
    }, {});
  }, [decks]);

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
    <>
      <div className="w-full space-y-8 animate-[fadeIn_0.15s_ease]">

        {/* Encabezado de usuario */}
        <HomeHeader user={user} onOpenProfile={onOpenProfile} />

        {/* Carrusel de widgets */}
        <WidgetCarousel
          onViewAll={() => setShowWidgetLibrary(true)}
          order={visibleWidgetOrder}
          onShift={handleCarouselShift}
        />

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

      {showWidgetLibrary && (
        <WidgetCarouselExpanded
          order={preferredWidgetOrder}
          onReorder={handleWidgetOrderChange}
          onClose={() => setShowWidgetLibrary(false)}
        />
      )}
    </>
  );
}
