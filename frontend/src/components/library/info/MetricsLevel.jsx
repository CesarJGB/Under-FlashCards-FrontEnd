import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Brain,
  Clock3,
  Gauge,
  Layers3,
  Loader2,
  Sparkles,
  Target
} from 'lucide-react';
import { getJSON, setJSON } from '../../../lib/safeLocalStorage';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const AVAILABLE_PARCIALES = [1, 2, 3];
const METRICS_PREVIEWS_TTL_MS = 15 * 60 * 1000;
const METRICS_TEMAS_TTL_MS = 15 * 60 * 1000;
const METRICS_HISTORY_DAYS = 14;

function sanitizeParciales(parciales) {
  if (!Array.isArray(parciales)) return [];

  return [...new Set(
    parciales
      .map(Number)
      .filter((value) => AVAILABLE_PARCIALES.includes(value))
  )].sort((a, b) => a - b);
}

function normalizeParciales(parciales, fallback = AVAILABLE_PARCIALES) {
  const normalized = sanitizeParciales(parciales);
  if (normalized.length > 0) return normalized;

  const normalizedFallback = sanitizeParciales(fallback);
  if (normalizedFallback.length > 0) return normalizedFallback;

  return [...AVAILABLE_PARCIALES];
}

function areSameParciales(left = [], right = []) {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (Number(left[index]) !== Number(right[index])) return false;
  }
  return true;
}

function normalizeStudyMetricsFilters(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};

  return Object.entries(input).reduce((acc, [materiaId, parciales]) => {
    const normalized = sanitizeParciales(parciales);
    if (materiaId && normalized.length > 0) {
      acc[materiaId] = normalized;
    }
    return acc;
  }, {});
}

function getMetricsFiltersStorageKey(userId) {
  return `metricsFilters_${userId}`;
}

function getMetricsPreviewsStorageKey(userId) {
  return `metricsPreviews_${userId}`;
}

function getMetricsTemasStorageKey(userId) {
  return `metricsTemas_${userId}`;
}

function getStoredMetricsFilters(userId) {
  if (!userId) return {};
  return normalizeStudyMetricsFilters(getJSON(getMetricsFiltersStorageKey(userId)));
}

function getStoredParciales(userId, materiaId, fallback) {
  if (!materiaId) return normalizeParciales(fallback);

  const storedFilters = getStoredMetricsFilters(userId);
  if (storedFilters[materiaId]) {
    return normalizeParciales(storedFilters[materiaId], fallback);
  }

  return normalizeParciales(fallback);
}

function saveStoredMetricsFilters(userId, nextFilters) {
  if (!userId) return nextFilters;
  const normalized = normalizeStudyMetricsFilters(nextFilters);
  setJSON(getMetricsFiltersStorageKey(userId), normalized);
  return normalized;
}

function saveStoredParciales(userId, materiaId, parciales) {
  if (!userId || !materiaId) return {};

  const currentFilters = getStoredMetricsFilters(userId);
  const nextFilters = {
    ...currentFilters,
    [materiaId]: normalizeParciales(parciales)
  };

  return saveStoredMetricsFilters(userId, nextFilters);
}

function buildMetricsPreviewEntryKey(materiaId, parciales) {
  return `${materiaId}::${normalizeParciales(parciales).join('-')}`;
}

function getStoredPreviewEntry(userId, materiaId, parciales) {
  if (!userId || !materiaId) return null;

  const cache = getJSON(getMetricsPreviewsStorageKey(userId));
  if (!cache || typeof cache !== 'object' || Array.isArray(cache)) return null;

  return cache[buildMetricsPreviewEntryKey(materiaId, parciales)] || null;
}

function saveStoredPreviewEntry(userId, materiaId, parciales, preview) {
  if (!userId || !materiaId || !preview) return;

  const storageKey = getMetricsPreviewsStorageKey(userId);
  const currentCache = getJSON(storageKey);
  const safeCache = currentCache && typeof currentCache === 'object' && !Array.isArray(currentCache)
    ? currentCache
    : {};

  const entryKey = buildMetricsPreviewEntryKey(materiaId, parciales);
  const normalizedParciales = normalizeParciales(parciales);
  const nextCache = {
    ...safeCache,
    [entryKey]: {
      parciales: normalizedParciales,
      preview,
      timestamp: Date.now()
    }
  };

  setJSON(storageKey, nextCache);
}

function isFreshPreviewEntry(entry) {
  if (!entry?.timestamp) return false;
  return Date.now() - Number(entry.timestamp) <= METRICS_PREVIEWS_TTL_MS;
}

function getStoredTemasEntry(userId, materiaId) {
  if (!userId || !materiaId) return null;

  const cache = getJSON(getMetricsTemasStorageKey(userId));
  if (!cache || typeof cache !== 'object' || Array.isArray(cache)) return null;

  return cache[materiaId] || null;
}

function hasStoredTemas(entry) {
  return Array.isArray(entry?.temas);
}

function saveStoredTemasEntry(userId, materiaId, temas) {
  if (!userId || !materiaId || !Array.isArray(temas)) return;

  const storageKey = getMetricsTemasStorageKey(userId);
  const currentCache = getJSON(storageKey);
  const safeCache = currentCache && typeof currentCache === 'object' && !Array.isArray(currentCache)
    ? currentCache
    : {};

  setJSON(storageKey, {
    ...safeCache,
    [materiaId]: {
      temas,
      timestamp: Date.now()
    }
  });
}

function isFreshTemasEntry(entry) {
  if (!entry?.timestamp) return false;
  return Date.now() - Number(entry.timestamp) <= METRICS_TEMAS_TTL_MS;
}

function formatMs(value) {
  const ms = Number(value) || 0;
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.round(ms)} ms`;
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function formatDecimal(value) {
  return Number(value || 0).toFixed(2);
}

function formatShortDate(value) {
  if (!value) return '';
  return String(value).slice(5).replace('-', '/');
}

function MetricCard({ title, value, hint, icon: Icon, accent = 'indigo' }) {
  const accents = {
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300',
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300',
    sky: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300'
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accents[accent] || accents.indigo}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 font-bold">{title}</p>
      <p className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-slate-50">{value}</p>
      <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{hint}</p>
    </div>
  );
}

function MetricBar({ label, value, tone = 'indigo', detail }) {
  const tones = {
    indigo: 'from-indigo-500 via-violet-500 to-fuchsia-500',
    emerald: 'from-emerald-500 via-teal-500 to-cyan-500',
    amber: 'from-amber-500 via-orange-500 to-rose-500',
    sky: 'from-sky-500 via-cyan-500 to-blue-500'
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
        <span>{label}</span>
        <span className="shrink-0">{detail || `${Math.round(value)}%`}</span>
      </div>
      <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${tones[tone] || tones.indigo} transition-all duration-500`}
          style={{ width: `${clampPercent(value)}%` }}
        />
      </div>
    </div>
  );
}

function HistorySeriesCard({ title, accent = 'indigo', summary, points = [] }) {
  const tones = {
    indigo: 'from-indigo-500 to-violet-500',
    emerald: 'from-emerald-500 to-teal-500',
    amber: 'from-amber-500 to-orange-500',
    purple: 'from-purple-500 to-fuchsia-500',
    sky: 'from-sky-500 to-cyan-500'
  };

  const maxReviews = Math.max(1, ...points.map((point) => point.reviews || 0));

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-black tracking-tight text-slate-950 dark:text-slate-50">{title}</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">Ultimos {METRICS_HISTORY_DAYS} dias registrados en ReviewLog.</p>
        </div>
        <div className="text-right text-sm font-semibold text-slate-700 dark:text-slate-200">
          <div>{summary?.totalReviews ?? 0} repasos</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Precision {Math.round((summary?.accuracyRate ?? 0) * 100)}%</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 px-3 py-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold">Repasos</p>
          <p className="mt-1 text-lg font-black text-slate-900 dark:text-slate-50">{summary?.totalReviews ?? 0}</p>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 px-3 py-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold">Precision</p>
          <p className="mt-1 text-lg font-black text-slate-900 dark:text-slate-50">{Math.round((summary?.accuracyRate ?? 0) * 100)}%</p>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 px-3 py-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold">Velocidad</p>
          <p className="mt-1 text-lg font-black text-slate-900 dark:text-slate-50">{formatMs(summary?.avgResponseTimeMs ?? 0)}</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          <span>Actividad diaria</span>
          <span>Altura = repasos · opacidad = precision</span>
        </div>

        <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1 items-end h-28">
          {points.map((point) => {
            const height = point.reviews > 0
              ? Math.max(12, (point.reviews / maxReviews) * 100)
              : 8;
            const opacity = point.reviews > 0
              ? Math.max(0.25, point.accuracyRate || 0)
              : 0.14;

            return (
              <div
                key={`${title}-${point.date}`}
                className="flex items-end h-full"
                title={`${point.date} · ${point.reviews} repasos · precision ${Math.round((point.accuracyRate || 0) * 100)}% · velocidad ${formatMs(point.avgResponseTimeMs || 0)}`}
              >
                <div
                  className={`w-full rounded-t-md bg-gradient-to-t ${tones[accent] || tones.indigo}`}
                  style={{ height: `${height}%`, opacity }}
                />
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          <span>{formatShortDate(points[0]?.date)}</span>
          <span>{formatShortDate(points[points.length - 1]?.date)}</span>
        </div>
      </div>
    </div>
  );
}

export default function MetricsLevel({ materia, userId, onBack }) {
  const materiaId = materia?._id || materia?.id;
  const fallbackParciales = useMemo(
    () => normalizeParciales(materia?.activeParciales, AVAILABLE_PARCIALES),
    [materia?.activeParciales]
  );
  const fallbackParcialesKey = fallbackParciales.join(',');
  const [selectedParciales, setSelectedParciales] = useState(() => getStoredParciales(userId, materiaId, fallbackParciales));
  const [preview, setPreview] = useState(() => {
    const initialParciales = getStoredParciales(userId, materiaId, fallbackParciales);
    return getStoredPreviewEntry(userId, materiaId, initialParciales)?.preview || null;
  });
  const [temas, setTemas] = useState(() => getStoredTemasEntry(userId, materiaId)?.temas || []);
  const [history, setHistory] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(() => !getStoredPreviewEntry(userId, materiaId, getStoredParciales(userId, materiaId, fallbackParciales))?.preview);
  const [loadingTemas, setLoadingTemas] = useState(() => !hasStoredTemas(getStoredTemasEntry(userId, materiaId)));
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [previewError, setPreviewError] = useState('');
  const [temasError, setTemasError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const parcialesKey = selectedParciales.join(',');

  useEffect(() => {
    const nextParciales = getStoredParciales(userId, materiaId, fallbackParciales);
    setSelectedParciales((prev) => (areSameParciales(prev, nextParciales) ? prev : nextParciales));

    const cachedPreview = getStoredPreviewEntry(userId, materiaId, nextParciales)?.preview || null;
    setPreview(cachedPreview);
    setLoadingPreview(!cachedPreview);

    const cachedTemasEntry = getStoredTemasEntry(userId, materiaId);
    const cachedTemas = hasStoredTemas(cachedTemasEntry) ? cachedTemasEntry.temas : [];
    setTemas(cachedTemas);
    setLoadingTemas(!hasStoredTemas(cachedTemasEntry));
    setTemasError('');
  }, [userId, materiaId, fallbackParcialesKey]);

  useEffect(() => {
    if (!userId || !materiaId) return undefined;

    let cancelled = false;

    const syncPreferences = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/users/${userId}/preferences`);
        const body = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(body.error || 'No se pudieron cargar las preferencias de métricas.');
        }

        const serverFilters = normalizeStudyMetricsFilters(body.studyMetricsFilters);
        const localFilters = getStoredMetricsFilters(userId);
        const mergedFilters = { ...serverFilters, ...localFilters };
        saveStoredMetricsFilters(userId, mergedFilters);

        const serverParciales = serverFilters[materiaId];
        const localParciales = localFilters[materiaId];

        if (localParciales?.length) {
          if (!serverParciales || !areSameParciales(serverParciales, localParciales)) {
            await fetch(`${BACKEND_URL}/api/users/${userId}/preferences`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ studyMetricsFilters: { ...serverFilters, [materiaId]: localParciales } })
            });
          }
          return;
        }

        if (serverParciales?.length && !cancelled) {
          setSelectedParciales((prev) => (areSameParciales(prev, serverParciales) ? prev : serverParciales));
        }
      } catch (error) {
        console.error('[MetricsLevel] Error syncing studyMetricsFilters:', error);
      }
    };

    syncPreferences();

    return () => {
      cancelled = true;
    };
  }, [userId, materiaId]);

  useEffect(() => {
    if (!materiaId) return;

    const controller = new AbortController();
    const cachedTemasEntry = getStoredTemasEntry(userId, materiaId);
    const cachedTemas = hasStoredTemas(cachedTemasEntry) ? cachedTemasEntry.temas : null;

    if (cachedTemas) {
      setTemas(cachedTemas);
      setLoadingTemas(false);
      setTemasError('');
    } else {
      setTemas([]);
      setLoadingTemas(true);
    }

    if (cachedTemasEntry && isFreshTemasEntry(cachedTemasEntry)) {
      return () => controller.abort();
    }

    const loadTemas = async () => {
      if (!cachedTemas) setLoadingTemas(true);
      setTemasError('');

      try {
        const res = await fetch(`${BACKEND_URL}/api/academic/temas/${materiaId}`, { signal: controller.signal });
        const body = await res.json().catch(() => ([]));

        if (!res.ok) {
          throw new Error(body.error || 'No se pudieron cargar los temas de la materia.');
        }

        const nextTemas = Array.isArray(body) ? body : [];
        setTemas(nextTemas);
        saveStoredTemasEntry(userId, materiaId, nextTemas);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setTemasError(err.message || 'No se pudieron cargar los temas de la materia.');
          if (!cachedTemas) {
            setTemas([]);
          }
        }
      } finally {
        if (!controller.signal.aborted) setLoadingTemas(false);
      }
    };

    loadTemas();
    return () => controller.abort();
  }, [userId, materiaId]);

  useEffect(() => {
    if (!materiaId || !selectedParciales.length) return;

    const controller = new AbortController();
    const cachedEntry = getStoredPreviewEntry(userId, materiaId, selectedParciales);
    const cachedPreview = cachedEntry?.preview || null;

    if (cachedPreview) {
      setPreview(cachedPreview);
      setLoadingPreview(false);
      setPreviewError('');
    } else {
      setPreview(null);
      setLoadingPreview(true);
    }

    if (cachedEntry && isFreshPreviewEntry(cachedEntry)) {
      return () => controller.abort();
    }

    const loadPreview = async () => {
      if (!cachedPreview) setLoadingPreview(true);
      setPreviewError('');

      try {
        const query = selectedParciales.join(',');
        const res = await fetch(`${BACKEND_URL}/api/academic/materias/${materiaId}/domain-preview?parciales=${query}`, {
          signal: controller.signal
        });
        const body = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(body.error || 'No se pudieron calcular las métricas filtradas.');
        }

        setPreview(body);
        saveStoredPreviewEntry(userId, materiaId, selectedParciales, body);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setPreviewError(err.message || 'No se pudieron calcular las métricas filtradas.');
          if (!cachedPreview) {
            setPreview(null);
          }
        }
      } finally {
        if (!controller.signal.aborted) setLoadingPreview(false);
      }
    };

    loadPreview();
    return () => controller.abort();
  }, [userId, materiaId, parcialesKey]);

  useEffect(() => {
    if (!materiaId || !selectedParciales.length) return undefined;

    const controller = new AbortController();

    const loadHistory = async () => {
      setLoadingHistory(true);
      setHistoryError('');

      try {
        const query = selectedParciales.join(',');
        const res = await fetch(`${BACKEND_URL}/api/academic/materias/${materiaId}/metrics-history?parciales=${query}&days=${METRICS_HISTORY_DAYS}`, {
          signal: controller.signal
        });
        const body = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(body.error || 'No se pudo cargar el histórico de métricas.');
        }

        setHistory(body);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setHistoryError(err.message || 'No se pudo cargar el histórico de métricas.');
          setHistory(null);
        }
      } finally {
        if (!controller.signal.aborted) setLoadingHistory(false);
      }
    };

    loadHistory();

    return () => controller.abort();
  }, [materiaId, parcialesKey]);

  const persistSelectedParciales = async (nextParciales) => {
    if (!materiaId) return;

    const nextFilters = saveStoredParciales(userId, materiaId, nextParciales);
    if (!userId) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/users/${userId}/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studyMetricsFilters: nextFilters })
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(body.error || 'No se pudieron guardar las preferencias de métricas.');
      }

      if (body.studyMetricsFilters) {
        saveStoredMetricsFilters(userId, body.studyMetricsFilters);
      }
    } catch (error) {
      console.error('[MetricsLevel] Error saving studyMetricsFilters:', error);
    }
  };

  const toggleParcial = (parcial) => {
    setSelectedParciales((prev) => {
      const exists = prev.includes(parcial);
      let nextSelection;

      if (exists) {
        if (prev.length === 1) return prev;
        nextSelection = prev.filter((item) => item !== parcial);
      } else {
        nextSelection = [...prev, parcial].sort((a, b) => a - b);
      }

      void persistSelectedParciales(nextSelection);
      return nextSelection;
    });
  };

  const filteredTemas = useMemo(
    () => temas.filter((tema) => selectedParciales.includes(Number(tema.parcialNumber))),
    [temas, selectedParciales]
  );

  const metrics = preview?.metrics || null;

  const metricCards = useMemo(() => {
    if (!metrics) return [];

    return [
      {
        title: 'Dominio actual',
        value: `${metrics.mastery ?? 0}%`,
        hint: 'Dominio consolidado de los parciales seleccionados.',
        icon: Target,
        accent: 'indigo'
      },
      {
        title: 'Precisión',
        value: `${Math.round((metrics.accuracy ?? 0) * 100)}%`,
        hint: 'Tasa de acierto actual estimada.',
        icon: Activity,
        accent: 'emerald'
      },
      {
        title: 'Velocidad media',
        value: formatMs(metrics.speed),
        hint: 'Tiempo medio de respuesta del bloque filtrado.',
        icon: Clock3,
        accent: 'amber'
      },
      {
        title: 'Repasos',
        value: `${metrics.reviews ?? 0}`,
        hint: 'Volumen total de repasos acumulados.',
        icon: Layers3,
        accent: 'purple'
      },
      {
        title: 'Confianza',
        value: `${formatDecimal(metrics.confidence)}/5`,
        hint: 'Estabilidad media estimada del conocimiento.',
        icon: Brain,
        accent: 'sky'
      },
      {
        title: 'Dificultad',
        value: `${Math.round((metrics.difficulty ?? 0) * 100)}%`,
        hint: 'Fricción detectada en las respuestas actuales.',
        icon: Gauge,
        accent: 'rose'
      }
    ];
  }, [metrics]);

  const partialBreakdown = useMemo(() => {
    return selectedParciales.map((parcial) => {
      const temasParcial = filteredTemas.filter((tema) => Number(tema.parcialNumber) === parcial);
      const temasCount = temasParcial.length;
      const avgMastery = temasCount > 0
        ? Math.round(temasParcial.reduce((acc, tema) => acc + (tema.analytics?.masteryPercentage ?? 0), 0) / temasCount)
        : 0;
      const totalReviews = temasParcial.reduce((acc, tema) => acc + (tema.analytics?.totalReviewsCount ?? 0), 0);
      const avgResponseTime = temasCount > 0
        ? Math.round(temasParcial.reduce((acc, tema) => acc + (tema.analytics?.avgResponseTime ?? 0), 0) / temasCount)
        : 0;

      return {
        parcial,
        temasCount,
        avgMastery,
        totalReviews,
        avgResponseTime
      };
    });
  }, [filteredTemas, selectedParciales]);

  const topTemas = useMemo(() => {
    return [...filteredTemas]
      .sort((a, b) => {
        const parcialDiff = Number(a.parcialNumber) - Number(b.parcialNumber);
        if (parcialDiff !== 0) return parcialDiff;
        return (b.analytics?.masteryPercentage ?? 0) - (a.analytics?.masteryPercentage ?? 0);
      });
  }, [filteredTemas]);

  const historyCards = useMemo(() => {
    if (!history) return [];

    const accentByParcial = {
      1: 'indigo',
      2: 'emerald',
      3: 'amber'
    };

    const cards = [];

    if (selectedParciales.length > 1 && history.total) {
      cards.push({
        key: 'history-total',
        title: 'Bloque combinado',
        accent: 'purple',
        summary: history.total,
        points: history.total.points || []
      });
    }

    (history.series || []).forEach((item) => {
      cards.push({
        key: `history-parcial-${item.parcial}`,
        title: `Parcial ${item.parcial}`,
        accent: accentByParcial[item.parcial] || 'sky',
        summary: item,
        points: item.points || []
      });
    });

    return cards;
  }, [history, selectedParciales]);

  const hasHistoryData = useMemo(
    () => historyCards.some((card) => (card.summary?.totalReviews || 0) > 0),
    [historyCards]
  );

  return (
    <div className="animate-[fadeIn_0.15s_ease] pt-2">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-medium cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Volver
            </button>

            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-100 dark:border-purple-900/40 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-xs font-bold uppercase tracking-wider">
                <BarChart3 className="w-3.5 h-3.5" />
                Métricas actuales
              </div>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950 dark:text-slate-50">Lectura por parcial de {materia?.name || 'la materia'}</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-3xl leading-relaxed">
                Ajusta los parciales incluidos para recalcular el estado actual del dominio, ver el comportamiento agregado y comparar temas dentro del bloque seleccionado.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-4 lg:max-w-sm space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-50">Parciales incluidos</p>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                {selectedParciales.length} seleccionados
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_PARCIALES.map((parcial) => {
                const active = selectedParciales.includes(parcial);
                return (
                  <button
                    key={parcial}
                    type="button"
                    onClick={() => toggleParcial(parcial)}
                    className={`px-3 py-2 rounded-xl text-sm font-semibold border transition-colors cursor-pointer ${
                      active
                        ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    Parcial {parcial}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Puedes combinar uno o varios parciales. Siempre debe quedar al menos uno activo para conservar el cálculo comparativo.
            </p>
          </div>
        </div>

        {previewError && (
          <div className="rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/20 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
            {previewError}
          </div>
        )}

        {loadingPreview ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-purple-500 mb-3" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Calculando métricas filtradas...</p>
          </div>
        ) : metrics ? (
          <>
            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {metricCards.map((card) => (
                <MetricCard key={card.title} {...card} />
              ))}
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-4">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
                <div>
                  <h3 className="text-lg font-black tracking-tight text-slate-950 dark:text-slate-50">Lectura agregada</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Vista rápida de los componentes más útiles del bloque seleccionado.</p>
                </div>

                <MetricBar label="Dominio" value={metrics.mastery ?? 0} tone="indigo" />
                <MetricBar label="Precisión" value={(metrics.accuracy ?? 0) * 100} tone="emerald" />
                <MetricBar label="Confianza" value={((metrics.confidence ?? 0) / 5) * 100} tone="sky" detail={`${formatDecimal(metrics.confidence)}/5`} />
                <MetricBar label="Dificultad detectada" value={(metrics.difficulty ?? 0) * 100} tone="amber" />

                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  <span className="font-bold text-slate-900 dark:text-slate-50">Índice técnico:</span> {formatDecimal(metrics.knowledgeScore)}.
                  {' '}Sirve como señal compacta para comparar cómo de sólido está el bloque seleccionado frente al volumen real de repasos.
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
                <div>
                  <h3 className="text-lg font-black tracking-tight text-slate-950 dark:text-slate-50">Comparativa por parcial</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Promedio de dominio y volumen por parcial dentro del filtro actual.</p>
                </div>

                <div className="space-y-3">
                  {partialBreakdown.map((item) => (
                    <div key={item.parcial} className="rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-slate-50">Parcial {item.parcial}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{item.temasCount} tema{item.temasCount === 1 ? '' : 's'} incluidos</p>
                        </div>
                        <div className="text-right text-sm font-semibold text-slate-700 dark:text-slate-200">
                          <div>{item.totalReviews} repasos</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">Velocidad media {formatMs(item.avgResponseTime)}</div>
                        </div>
                      </div>

                      <MetricBar label="Dominio medio" value={item.avgMastery} tone="indigo" detail={`${item.avgMastery}%`} />
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black tracking-tight text-slate-950 dark:text-slate-50">Serie temporal por parcial</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Actividad reciente basada en ReviewLog, separada por parciales y lista para crecer a análisis más finos.</p>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  <Sparkles className="w-3.5 h-3.5" />
                  Ultimos {METRICS_HISTORY_DAYS} dias
                </div>
              </div>

              {historyError && (
                <div className="rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/20 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
                  {historyError}
                </div>
              )}

              {loadingHistory ? (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-8 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-purple-500 mb-3" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Cargando serie temporal...</p>
                </div>
              ) : historyCards.length > 0 && hasHistoryData ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {historyCards.map((card) => (
                    <HistorySeriesCard
                      key={card.key}
                      title={card.title}
                      accent={card.accent}
                      summary={card.summary}
                      points={card.points}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                  Aun no hay suficiente historial de repaso para dibujar la serie temporal de este bloque.
                </div>
              )}
            </section>
          </>
        ) : null}

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-950 dark:text-slate-50">Temas incluidos</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Desglose rápido por tema para detectar qué parte del parcial está más fuerte o más rezagada.</p>
            </div>
            {loadingTemas ? (
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Cargando temas...
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                <Sparkles className="w-3.5 h-3.5" />
                {filteredTemas.length} tema{filteredTemas.length === 1 ? '' : 's'} visibles
              </div>
            )}
          </div>

          {temasError && (
            <div className="rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/20 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
              {temasError}
            </div>
          )}

          {!loadingTemas && !temasError && topTemas.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              No hay temas disponibles dentro de los parciales seleccionados.
            </div>
          )}

          <div className="space-y-3">
            {topTemas.map((tema) => {
              const mastery = tema.analytics?.masteryPercentage ?? 0;
              const reviews = tema.analytics?.totalReviewsCount ?? 0;
              const avgResponse = tema.analytics?.avgResponseTime ?? 0;

              return (
                <div key={tema._id || tema.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-50 truncate">{tema.name}</p>
                        <span className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                          Parcial {tema.parcialNumber}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {reviews} repasos acumulados · velocidad media {formatMs(avgResponse)} · índice {formatDecimal(tema.analytics?.velocityIndex ?? 0)}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-lg font-black text-slate-950 dark:text-slate-50">{mastery}%</div>
                      <div className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold">Dominio</div>
                    </div>
                  </div>

                  <div className="mt-3">
                    <MetricBar label="Avance del tema" value={mastery} tone="emerald" detail={`${mastery}%`} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
