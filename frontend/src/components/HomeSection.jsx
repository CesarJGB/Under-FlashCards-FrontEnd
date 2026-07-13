import React, { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { ArrowRight, BarChart3, ChevronUp, Clock3, Sparkles, TrendingUp } from 'lucide-react';
import RadarDebugPanel from './RadarDebugPanel';
import HomeHeader from './home/HomeHeader';
import WidgetCarousel from './home/WidgetCarousel';
import GlobalStatsHeader from './home/GlobalStatsHeader';
import QuickViewGrid from './home/QuickViewGrid';
import DetailedMateriasGrid from './home/DetailedMateriasGrid';
import UnclassifiedDecksSection from './home/UnclassifiedDecksSection';
import WidgetCarouselExpanded from './home/WidgetCarouselExpanded';
import { getJSON, setJSON, remove } from '../lib/safeLocalStorage';
import useImmersiveScrollGuard from '../hooks/useImmersiveScrollGuard';
import useBottomGap from '../hooks/useBottomGap';
import useQuickViewMaterias from './home/useQuickViewMaterias';
import { DEFAULT_WIDGET_ORDER, normalizeWidgetOrder, serializeWidgetOrder } from './home/homeWidgetRegistry';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const DOMAIN_PREVIEWS_TTL_MS = 15 * 60 * 1000; // 15 minutos

function getHomeWidgetOrderCacheKey(userId) {
  return `homeWidgetOrder_${userId}`;
}

function getCachedHomeWidgetOrder(userId) {
  if (!userId) return DEFAULT_WIDGET_ORDER;
  return normalizeWidgetOrder(getJSON(getHomeWidgetOrderCacheKey(userId)));
}

function rotateWidgetOrder(order, offset) {
  if (!Array.isArray(order) || order.length === 0) return [];

  const normalizedOffset = ((offset % order.length) + order.length) % order.length;
  if (normalizedOffset === 0) return order;

  return [...order.slice(normalizedOffset), ...order.slice(0, normalizedOffset)];
}

const ADAPTIVE_PREVIEW_HEIGHTS = {
  compact: 30,
  comfortable: 136,
  expanded: 196
};

const ADAPTIVE_PREVIEW_CLEARANCE = {
  compact: { top: 4, bottom: 12 },
  comfortable: { top: 10, bottom: 28 },
  expanded: { top: 12, bottom: 34 }
};

const ADAPTIVE_PREVIEW_VISUAL_BUFFER = 10;

function getAdaptivePreviewSlotPadding(variant) {
  return ADAPTIVE_PREVIEW_CLEARANCE[variant] || { top: 0, bottom: 0 };
}

function resolveAdaptivePreviewVariant(gap) {
  if (gap >= ADAPTIVE_PREVIEW_HEIGHTS.expanded + ADAPTIVE_PREVIEW_CLEARANCE.expanded.top + ADAPTIVE_PREVIEW_CLEARANCE.expanded.bottom) {
    return 'expanded';
  }

  if (gap >= ADAPTIVE_PREVIEW_HEIGHTS.comfortable + ADAPTIVE_PREVIEW_CLEARANCE.comfortable.top + ADAPTIVE_PREVIEW_CLEARANCE.comfortable.bottom) {
    return 'comfortable';
  }

  if (gap >= ADAPTIVE_PREVIEW_HEIGHTS.compact + ADAPTIVE_PREVIEW_CLEARANCE.compact.top + ADAPTIVE_PREVIEW_CLEARANCE.compact.bottom) {
    return 'compact';
  }

  return 'none';
}

function HomeAdaptivePreview({ variant, gap }) {
  if (!variant || variant === 'none') return null;

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={() => {}}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3.5 py-1.5 text-[11px] font-bold text-slate-600 shadow-[0_10px_24px_rgba(15,23,42,0.08)] hover:bg-white transition-colors cursor-pointer"
      >
        Más opciones
        <ChevronUp className="w-4 h-4 text-indigo-500" />
      </button>
    );
  }

  const previewHeight = ADAPTIVE_PREVIEW_HEIGHTS[variant] || 0;
  const isExpanded = variant === 'expanded';

  return (
    <section
      className="rounded-[28px] border border-slate-200 bg-white/95 shadow-[0_14px_34px_rgba(15,23,42,0.08)] overflow-hidden"
      style={{ height: previewHeight }}
    >
      <div className="h-full flex flex-col bg-gradient-to-br from-white via-slate-50 to-indigo-50/70 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-[18px] h-[18px]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-500">Preview adaptable</p>
              <h3 className="text-base font-bold text-slate-900 truncate">Bloque adicional en el hueco libre</h3>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="px-2.5 py-1 rounded-full bg-white/90 border border-slate-200 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              {variant}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-[10px] font-bold text-indigo-600">
              {gap}px
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/85 border border-slate-200 px-3 py-3">
            <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-wide">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              Dominio sugerido
            </div>
            <p className="mt-2 text-2xl font-black text-slate-900">78%</p>
            <p className="text-[11px] text-slate-500 mt-1">Mini resumen de rendimiento o racha.</p>
          </div>

          <div className="rounded-2xl bg-slate-900 text-white px-3 py-3">
            <div className="flex items-center gap-2 text-indigo-200 text-[10px] font-bold uppercase tracking-wide">
              <Clock3 className="w-3.5 h-3.5" />
              Próxima sesión
            </div>
            <p className="mt-2 text-sm font-bold">Repaso corto de 12 min</p>
            <p className="text-[11px] text-slate-300 mt-1">Ideal para cerrar el día sin abrir una pantalla nueva.</p>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-4 grid grid-cols-[1.4fr_1fr] gap-3 flex-1 min-h-0">
            <div className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-3 min-h-0">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                <BarChart3 className="w-3.5 h-3.5 text-indigo-500" />
                Ideas para el definitivo
              </div>
              <div className="mt-3 space-y-2 text-[11px] text-slate-600">
                <div className="rounded-xl bg-slate-50 px-3 py-2">Racha de estudio con feedback del día</div>
                <div className="rounded-xl bg-slate-50 px-3 py-2">Mini gráfico de dominio global o por materia</div>
                <div className="rounded-xl bg-slate-50 px-3 py-2">Próxima sesión recomendada según urgencia</div>
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/70 px-3 py-3 min-h-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-500">Espacio ganado</p>
              <p className="mt-2 text-3xl font-black text-slate-900 leading-none">{gap}</p>
              <p className="text-[11px] text-slate-500 mt-2">El panel crece solo cuando realmente sobra aire antes del nav fijo.</p>
            </div>
          </div>
        )}

        <div className="mt-auto pt-3 flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500 leading-snug max-w-[34ch]">
            {isExpanded
              ? 'Versión amplia para explorar cuánto contenido secundario puede vivir antes del nav.'
              : 'Versión compacta intermedia para estudiar densidad y legibilidad cuando hay espacio medio.'}
          </p>

          <button
            type="button"
            onClick={() => {}}
            className="shrink-0 inline-flex items-center gap-2 rounded-full bg-slate-900 text-white px-4 py-2 text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Ver idea
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
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
  onOpenProfile,
  bottomNavRef
}) {
  const [homeVisibility, setHomeVisibility] = useState({
    globalStats: false,
    quickView: false,
    detailedView: false,
    unclassifiedDecks: false
  });

  // Estados para la librería expandida y el ordenamiento de los widgets
  const [showWidgetLibrary, setShowWidgetLibrary] = useState(false);
  const [preferredWidgetOrder, setPreferredWidgetOrder] = useState(() => getCachedHomeWidgetOrder(user?.id));
  const [widgetOffset, setWidgetOffset] = useState(0);
  const [hasLoadedPreferences, setHasLoadedPreferences] = useState(false);

  const isMounted = useRef(true);
  const abortController = useRef(null);
  const requestSeq = useRef(0);
  const lastSyncedWidgetOrder = useRef(JSON.stringify(DEFAULT_WIDGET_ORDER));
  const widgetOrderTouched = useRef(false);
  const contentEndRef = useRef(null);

  useImmersiveScrollGuard(!showWidgetLibrary, 'home-section');

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
    const normalizedOrder = normalizeWidgetOrder(nextOrder);

    widgetOrderTouched.current = true;
    setPreferredWidgetOrder(normalizedOrder);

    if (user?.id) {
      setJSON(getHomeWidgetOrderCacheKey(user.id), normalizedOrder);
    }

    setWidgetOffset(0);
  }, [user?.id]);

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

    if (!widgetOrderTouched.current) {
      setPreferredWidgetOrder(getCachedHomeWidgetOrder(user.id));
      setWidgetOffset(0);
    }

    const loadPreferences = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/users/${user.id}/preferences`);
        if (res.ok) {
          const data = await res.json();
          if (data.homeSectionVisibility) {
            setHomeVisibility((prev) => ({ ...prev, ...data.homeSectionVisibility }));
          }

          const serverWidgetOrder = normalizeWidgetOrder(data.homeWidgetOrder);
          setJSON(getHomeWidgetOrderCacheKey(user.id), serverWidgetOrder);
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
          body: JSON.stringify({ homeWidgetOrder: serializeWidgetOrder(preferredWidgetOrder) }),
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

  const quickView = useQuickViewMaterias({
    userId: user?.id,
    enrichedMaterias
  });

  const { gap: bottomGap, isReady: isBottomGapReady } = useBottomGap({
    contentEndRef,
    navRef: bottomNavRef,
    isPaused: showWidgetLibrary
  });

  const usableBottomGap = Math.max(0, bottomGap - ADAPTIVE_PREVIEW_VISUAL_BUFFER);
  const adaptivePreviewVariant = isBottomGapReady ? resolveAdaptivePreviewVariant(usableBottomGap) : 'none';
  const showAdaptivePreview = adaptivePreviewVariant !== 'none' && !showWidgetLibrary;
  const adaptivePreviewSlotPadding = getAdaptivePreviewSlotPadding(adaptivePreviewVariant);

  const widgetContext = useMemo(() => ({
    user,
    globalStats,
    enrichedMaterias,
    unclassifiedDecks,
    quickView,
    getKnowledgeAccent,
    getParcialesBadge,
    onNavigateToLibrary,
    onOpenReview
  }), [
    user,
    globalStats,
    enrichedMaterias,
    unclassifiedDecks,
    quickView,
    getKnowledgeAccent,
    getParcialesBadge,
    onNavigateToLibrary,
    onOpenReview
  ]);

  return (
    <>
      <div
        className="w-full animate-[fadeIn_0.15s_ease]"
        data-bottom-gap={bottomGap}
        data-bottom-gap-ready={isBottomGapReady ? 'true' : 'false'}
        data-bottom-gap-tier={adaptivePreviewVariant}
        style={{ '--home-bottom-gap': `${bottomGap}px` }}
      >

        <div className="space-y-8">

          {/* Encabezado de usuario */}
          <HomeHeader user={user} onOpenProfile={onOpenProfile} />

          {/* Carrusel de widgets */}
          <WidgetCarousel
            onViewAll={() => setShowWidgetLibrary(true)}
            order={visibleWidgetOrder}
            onShift={handleCarouselShift}
            widgetContext={widgetContext}
          />

          {/* Resumen Global */}
          {homeVisibility.globalStats && (
            <GlobalStatsHeader
              user={user}
              globalStats={globalStats}
            />
          )}

          {/* Vista Rápida */}
          {homeVisibility.quickView && (
            <QuickViewGrid
              enrichedMaterias={enrichedMaterias}
              visibleMaterias={quickView.visibleMaterias}
              selectedMaterias={quickView.selectedMaterias}
              isInitialLoad={quickView.isInitialLoad}
              onToggleMateria={quickView.toggleMateria}
              onSelectAll={quickView.selectAll}
              onClearAll={quickView.clearAll}
              getKnowledgeAccent={getKnowledgeAccent}
              getParcialesBadge={getParcialesBadge}
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

        <div ref={contentEndRef} aria-hidden="true" className="h-0 w-full pointer-events-none" />

        {showAdaptivePreview && (
          <div
            className="h-full flex items-center justify-center"
            style={{
              height: bottomGap,
              paddingTop: adaptivePreviewSlotPadding.top,
              paddingBottom: adaptivePreviewSlotPadding.bottom + ADAPTIVE_PREVIEW_VISUAL_BUFFER
            }}
          >
            <HomeAdaptivePreview variant={adaptivePreviewVariant} gap={usableBottomGap} />
          </div>
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
