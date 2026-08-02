import { useCallback, useEffect, useRef, useState } from 'react';
import { getJSON, remove, setJSON } from '../../lib/safeLocalStorage';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const CACHE_KEY_PREFIX = 'openRouterBalance_';

// La Home se desmonta al cambiar de pestaña y vuelve a montarse al regresar.
// Este mapa evita repetir la consulta viva durante la misma sesión de la app.
// El snapshot permanece en localStorage para que también sobreviva a recargas.
const sessionSyncPromises = new Map();

function getCacheKey(userId) {
  return `${CACHE_KEY_PREFIX}${userId}`;
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeInfo(info) {
  if (!info || typeof info !== 'object' || Array.isArray(info)) return null;

  return {
    label: typeof info.label === 'string' ? info.label : null,
    limit: toFiniteNumber(info.limit),
    limit_remaining: toFiniteNumber(info.limit_remaining),
    limit_reset: typeof info.limit_reset === 'string' ? info.limit_reset : null,
    limit_reset_at: typeof info.limit_reset_at === 'string' ? info.limit_reset_at : null,
    usage: toFiniteNumber(info.usage),
    usage_daily: toFiniteNumber(info.usage_daily),
    usage_weekly: toFiniteNumber(info.usage_weekly),
    usage_monthly: toFiniteNumber(info.usage_monthly),
    byok_usage: toFiniteNumber(info.byok_usage),
    byok_usage_daily: toFiniteNumber(info.byok_usage_daily),
    byok_usage_weekly: toFiniteNumber(info.byok_usage_weekly),
    byok_usage_monthly: toFiniteNumber(info.byok_usage_monthly),
    include_byok_in_limit: info.include_byok_in_limit === true,
    is_free_tier: info.is_free_tier === true,
    currency: typeof info.currency === 'string' && info.currency.trim()
      ? info.currency.trim()
      : 'USD',
  };
}

function normalizeSnapshot(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const info = normalizeInfo(raw.info || raw.data);
  const syncedAt = raw.syncedAt || raw.cachedAt || raw.timestamp || null;

  return {
    hasBalance: raw.hasBalance === true || Boolean(info),
    isAvailable: raw.isAvailable !== false,
    cached: raw.cached === true,
    stale: raw.stale === true,
    syncError: typeof raw.syncError === 'string' && raw.syncError.trim()
      ? raw.syncError.trim()
      : '',
    syncedAt,
    model: typeof raw.model === 'string' && raw.model.trim()
      ? raw.model.trim()
      : 'deepseek/deepseek-v4-flash',
    info,
  };
}

function readCachedBalance(userId) {
  if (!userId) return null;
  return normalizeSnapshot(getJSON(getCacheKey(userId)));
}

export function clearOpenRouterBalanceCache(userId) {
  if (!userId) return;
  const normalizedUserId = String(userId);
  remove(getCacheKey(normalizedUserId));
  sessionSyncPromises.delete(normalizedUserId);
}

async function getResponsePayload(response) {
  const responseText = await response.text();
  if (!responseText.trim()) return null;

  try {
    return JSON.parse(responseText);
  } catch {
    return null;
  }
}

export default function useOpenRouterBalance({ userId }) {
  const normalizedUserId = userId ? String(userId) : '';
  const [snapshot, setSnapshot] = useState(() => readCachedBalance(normalizedUserId));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const isMounted = useRef(false);
  const activeRequest = useRef(null);

  const requestBalance = useCallback(async ({ force = true, showProgress = true } = {}) => {
    if (!normalizedUserId) return null;

    if (activeRequest.current) {
      activeRequest.current.abort();
    }

    const controller = typeof AbortController === 'function'
      ? new AbortController()
      : null;
    activeRequest.current = controller;

    if (showProgress && isMounted.current) setIsRefreshing(true);

    try {
      const query = force ? '?refresh=1' : '';
      const response = await fetch(
        `${BACKEND_URL}/api/user/${normalizedUserId}/balance${query}`,
        {
          signal: controller?.signal,
          cache: 'no-store',
        }
      );
      const payload = await getResponsePayload(response);

      if (!response.ok) {
        throw new Error(
          typeof payload?.error === 'string' && payload.error.trim()
            ? payload.error
            : 'No se pudo sincronizar el saldo de OpenRouter.'
        );
      }

      const nextSnapshot = normalizeSnapshot(payload) || {
        hasBalance: false,
        isAvailable: false,
        cached: false,
        stale: false,
        syncError: '',
        syncedAt: null,
        model: 'deepseek/deepseek-v4-flash',
        info: null,
      };

      setJSON(getCacheKey(normalizedUserId), nextSnapshot);

      if (isMounted.current) {
        setSnapshot(nextSnapshot);
        setError('');
      }

      return nextSnapshot;
    } catch (requestError) {
      if (requestError?.name === 'AbortError') throw requestError;

      if (isMounted.current) {
        setError(requestError?.message || 'No se pudo sincronizar el saldo de OpenRouter.');
      }

      throw requestError;
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
      if (showProgress && isMounted.current) setIsRefreshing(false);
    }
  }, [normalizedUserId]);

  useEffect(() => {
    isMounted.current = true;

    if (!normalizedUserId) {
      setSnapshot(null);
      setError('');
      setIsRefreshing(false);
      return () => {
        isMounted.current = false;
      };
    }

    const cached = readCachedBalance(normalizedUserId);
    if (cached) setSnapshot(cached);
    setError('');
    setIsRefreshing(!cached);

    let syncPromise = sessionSyncPromises.get(normalizedUserId);

    if (!syncPromise) {
      syncPromise = requestBalance({ force: true, showProgress: false });
      sessionSyncPromises.set(normalizedUserId, syncPromise);

      syncPromise.catch(() => {
        // La UI conserva el snapshot local. Si la sesión vuelve a montar el
        // widget después de un fallo, podrá reintentar la sincronización.
        if (sessionSyncPromises.get(normalizedUserId) === syncPromise) {
          sessionSyncPromises.delete(normalizedUserId);
        }
      });
    }

    syncPromise
      .then((nextSnapshot) => {
        if (isMounted.current && nextSnapshot) setSnapshot(nextSnapshot);
      })
      .catch(() => {
        // El error ya se conserva en el estado del hook si el componente sigue montado.
      })
      .finally(() => {
        if (isMounted.current) setIsRefreshing(false);
      });

    return () => {
      isMounted.current = false;
    };
  }, [normalizedUserId, requestBalance]);

  useEffect(() => {
    if (!normalizedUserId || typeof window === 'undefined') return undefined;

    const handleInvalidation = (event) => {
      if (String(event?.detail?.userId) !== normalizedUserId) return;
      clearOpenRouterBalanceCache(normalizedUserId);
      setSnapshot(null);
      setError('');
    };

    window.addEventListener('openRouterBalance:invalidate', handleInvalidation);
    return () => window.removeEventListener('openRouterBalance:invalidate', handleInvalidation);
  }, [normalizedUserId]);

  const refresh = useCallback(() => {
    return requestBalance({ force: true, showProgress: true }).catch((requestError) => {
      if (requestError?.name === 'AbortError') return null;
      return null;
    });
  }, [requestBalance]);

  return {
    snapshot,
    isRefreshing,
    error,
    refresh,
  };
}
