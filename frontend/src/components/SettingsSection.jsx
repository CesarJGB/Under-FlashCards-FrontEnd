// FILE: frontend/src/components/SettingsSection.cambio.de.provedor.jsx
import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  KeyRound,
  Loader2,
  Check,
  Wallet,
  RefreshCw,
  Layout,
  Eye,
  EyeOff,
  BarChart3,
  AlertTriangle,
  Trash2,
} from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const OPENROUTER_PROVIDER = 'openrouter';
const LEGACY_DEEPSEEK_PROVIDER = 'deepseek';

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// Soporta tanto la respuesta normalizada futura del backend como la forma
// antigua de DeepSeek mientras termina la migración.
function normalizeBalance(data) {
  const info = data?.info || data?.data || null;
  if (!info || typeof info !== 'object' || Array.isArray(info)) return null;

  return {
    remaining: toFiniteNumber(
      info.limit_remaining ?? info.remaining_balance ?? info.total_balance
    ),
    limit: toFiniteNumber(info.limit ?? info.total_limit),
    usage: toFiniteNumber(info.usage ?? info.used_balance),
    toppedUp: toFiniteNumber(info.topped_up_balance),
    granted: toFiniteNumber(info.granted_balance),
    currency: typeof info.currency === 'string' && info.currency.trim()
      ? info.currency.trim()
      : 'USD',
    resetAt: info.limit_reset_at || null,
  };
}

function formatAmount(value) {
  return value === null ? '—' : value.toFixed(2);
}

async function getResponseError(response, fallback) {
  try {
    const data = await response.json();
    return typeof data?.error === 'string' && data.error.trim()
      ? data.error
      : fallback;
  } catch {
    return fallback;
  }
}

export default function SettingsSection({ userId, section, onBack }) {
  const showHomeSettings = section !== 'ai';
  const showAiSettings = section !== 'home';
  const [apiKey, setApiKey] = useState('');
  const [masked, setMasked] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [apiProvider, setApiProvider] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState('');
  const [deleteError, setDeleteError] = useState('');

  // 🪙 ESTADOS DEL SALDO DE IA
  const [balance, setBalance] = useState(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [balanceError, setBalanceError] = useState('');

  // 👁️ ESTADOS DE VISIBILIDAD DEL HOME
  const [homeVisibility, setHomeVisibility] = useState({
    globalStats: false,
    quickView: false,
    detailedView: false,
    unclassifiedDecks: false,
  });
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [visibilitySaved, setVisibilitySaved] = useState(false);

  const loadBalance = useCallback(async () => {
    setLoadingBalance(true);
    setBalanceError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/user/${userId}/balance`);
      if (!res.ok) {
        throw new Error(await getResponseError(
          res,
          'No se pudo actualizar el saldo de OpenRouter.'
        ));
      }

      const data = await res.json();
      const normalizedBalance = normalizeBalance(data);
      if (data.hasBalance !== false && normalizedBalance) {
        setBalance(normalizedBalance);
      } else {
        setBalance(null);
      }
    } catch (balanceLoadError) {
      setBalanceError(
        balanceLoadError.message || 'No se pudo actualizar el saldo de OpenRouter.'
      );
    } finally {
      setLoadingBalance(false);
    }
  }, [userId]);

  // Cargar preferencias de visibilidad del home
  const loadHomeVisibility = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/users/${userId}/preferences`);
      if (res.ok) {
        const data = await res.json();
        if (data.homeSectionVisibility) {
          setHomeVisibility((prev) => ({ ...prev, ...data.homeSectionVisibility }));
        }
      }
    } catch (visibilityLoadError) {
      console.error('Error al cargar visibilidad del home:', visibilityLoadError);
    }
  }, [userId]);

  useEffect(() => {
    if (showAiSettings) {
      (async () => {
        try {
          const res = await fetch(`${BACKEND_URL}/api/user/${userId}`);
          if (!res.ok) return;

          const data = await res.json();
          const nextHasKey = Boolean(data.hasApiKey);
          // Las claves existentes sin aiApiProvider son DeepSeek legacy.
          const nextProvider = nextHasKey
            ? String(data.aiApiProvider || data.apiKeyProvider || LEGACY_DEEPSEEK_PROVIDER).toLowerCase()
            : null;

          setHasKey(nextHasKey);
          setApiProvider(nextProvider);
          setMasked(data.apiKeyMasked || '');

          if (nextHasKey && nextProvider === OPENROUTER_PROVIDER) {
            loadBalance();
          } else {
            setBalance(null);
            setBalanceError('');
          }
        } catch {
          /* ignore */
        }
      })();
    }

    if (showHomeSettings) loadHomeVisibility();
  }, [userId, loadBalance, loadHomeVisibility, showAiSettings, showHomeSettings]);

  const handleSave = async (e) => {
    e.preventDefault();
    const normalizedKey = apiKey.trim();
    if (!normalizedKey) return;

    setSaving(true);
    setSaved(false);
    setDeleted(false);
    setError('');
    setDeleteError('');

    try {
      const res = await fetch(`${BACKEND_URL}/api/user/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          aiApiKey: normalizedKey,
          aiApiProvider: OPENROUTER_PROVIDER,
        }),
      });

      if (!res.ok) {
        throw new Error(await getResponseError(res, 'No se pudo guardar la clave de OpenRouter.'));
      }

      const data = await res.json();
      const nextHasKey = typeof data.hasApiKey === 'boolean' ? data.hasApiKey : true;
      setHasKey(nextHasKey);
      setApiProvider(nextHasKey ? (data.aiApiProvider || OPENROUTER_PROVIDER) : null);
      setMasked(data.apiKeyMasked || '');
      setApiKey('');
      setSaved(true);

      if (nextHasKey) loadBalance();
    } catch (saveError) {
      setError(saveError.message || 'No se pudo guardar la clave de OpenRouter.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteApiKey = async () => {
    if (!hasKey || deleting) return;

    const providerLabel = apiProvider === LEGACY_DEEPSEEK_PROVIDER
      ? 'la clave antigua de DeepSeek'
      : 'la clave de IA guardada';
    if (
      typeof window !== 'undefined'
      && !window.confirm(`¿Quieres eliminar ${providerLabel}? Esta acción no se puede deshacer.`)
    ) {
      return;
    }

    setDeleting(true);
    setDeleted(false);
    setSaved(false);
    setError('');
    setDeleteError('');

    try {
      // La clave vacía conserva compatibilidad con PUT /user/settings actual.
      // El backend migrado la convierte internamente en clearAiApiKey().
      const res = await fetch(`${BACKEND_URL}/api/user/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          aiApiKey: '',
          aiApiProvider: null,
        }),
      });

      if (!res.ok) {
        throw new Error(await getResponseError(res, 'No se pudo eliminar la clave de IA.'));
      }

      setHasKey(false);
      setApiProvider(null);
      setMasked('');
      setApiKey('');
      setBalance(null);
      setBalanceError('');
      setDeleted(true);
    } catch (deleteRequestError) {
      setDeleteError(deleteRequestError.message || 'No se pudo eliminar la clave de IA.');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleVisibility = async (visibilitySection) => {
    const newVisibility = {
      ...homeVisibility,
      [visibilitySection]: !homeVisibility[visibilitySection],
    };

    setHomeVisibility(newVisibility);
    setSavingVisibility(true);
    setVisibilitySaved(false);

    try {
      const res = await fetch(`${BACKEND_URL}/api/users/${userId}/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homeSectionVisibility: newVisibility }),
      });

      if (!res.ok) throw new Error('Error al guardar');

      setVisibilitySaved(true);
      setTimeout(() => setVisibilitySaved(false), 2000);
    } catch (visibilitySaveError) {
      console.error('Error al actualizar visibilidad:', visibilitySaveError);
      // Revertir en caso de error
      setHomeVisibility(homeVisibility);
    } finally {
      setSavingVisibility(false);
    }
  };

  const hasLegacyDeepSeekKey = hasKey && apiProvider === LEGACY_DEEPSEEK_PROVIDER;

  return (
    <div data-testid="settings-section" className="animate-[fadeIn_0.15s_ease] max-w-xl space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft className="w-4 h-4" /> Volver al perfil
      </button>

      {/* 👁️ SECCIÓN DE VISIBILIDAD DEL HOME */}
      {showHomeSettings && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center">
              <Layout className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Secciones del Home</h3>
              <p className="text-xs text-slate-500 mt-0.5">Controla qué secciones se muestran en tu pantalla de inicio</p>
            </div>
          </div>

          <div className="space-y-3">
            {/* Resumen Global */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-950/60 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Resumen Global</p>
                  <p className="text-[10px] text-slate-500">Saludo y métricas generales del mapa</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Mostrar u ocultar Resumen Global"
                aria-pressed={homeVisibility.globalStats}
                onClick={() => handleToggleVisibility('globalStats')}
                disabled={savingVisibility}
                className="relative w-11 h-6 rounded-full transition-colors cursor-pointer disabled:opacity-50"
                style={{
                  backgroundColor: homeVisibility.globalStats ? '#4f46e5' : '#cbd5e1',
                }}
              >
                <div
                  className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform"
                  style={{
                    transform: homeVisibility.globalStats ? 'translateX(22px)' : 'translateX(2px)',
                  }}
                />
              </button>
            </div>

            {/* Vista Rápida */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center">
                  <Layout className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Vista Rápida</p>
                  <p className="text-[10px] text-slate-500">Grid compacto con círculos de progreso</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Mostrar u ocultar Vista Rápida"
                aria-pressed={homeVisibility.quickView}
                onClick={() => handleToggleVisibility('quickView')}
                disabled={savingVisibility}
                className="relative w-11 h-6 rounded-full transition-colors cursor-pointer disabled:opacity-50"
                style={{
                  backgroundColor: homeVisibility.quickView ? '#4f46e5' : '#cbd5e1',
                }}
              >
                <div
                  className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform"
                  style={{
                    transform: homeVisibility.quickView ? 'translateX(22px)' : 'translateX(2px)',
                  }}
                />
              </button>
            </div>

            {/* Vista Detallada */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center">
                  <Eye className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Vista Detallada</p>
                  <p className="text-[10px] text-slate-500">Cards con estadísticas completas</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Mostrar u ocultar Vista Detallada"
                aria-pressed={homeVisibility.detailedView}
                onClick={() => handleToggleVisibility('detailedView')}
                disabled={savingVisibility}
                className="relative w-11 h-6 rounded-full transition-colors cursor-pointer disabled:opacity-50"
                style={{
                  backgroundColor: homeVisibility.detailedView ? '#4f46e5' : '#cbd5e1',
                }}
              >
                <div
                  className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform"
                  style={{
                    transform: homeVisibility.detailedView ? 'translateX(22px)' : 'translateX(2px)',
                  }}
                />
              </button>
            </div>

            {/* Mazos Sueltos */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center">
                  <EyeOff className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Mazos Sueltos</p>
                  <p className="text-[10px] text-slate-500">Mazos fuera de la jerarquía</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Mostrar u ocultar Mazos Sueltos"
                aria-pressed={homeVisibility.unclassifiedDecks}
                onClick={() => handleToggleVisibility('unclassifiedDecks')}
                disabled={savingVisibility}
                className="relative w-11 h-6 rounded-full transition-colors cursor-pointer disabled:opacity-50"
                style={{
                  backgroundColor: homeVisibility.unclassifiedDecks ? '#4f46e5' : '#cbd5e1',
                }}
              >
                <div
                  className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform"
                  style={{
                    transform: homeVisibility.unclassifiedDecks ? 'translateX(22px)' : 'translateX(2px)',
                  }}
                />
              </button>
            </div>
          </div>

          {visibilitySaved && (
            <p className="mt-3 text-xs font-semibold text-green-600 bg-green-50 border border-green-100 px-3 py-1.5 rounded-xl animate-[fadeIn_0.1s_ease]">
              Configuración guardada
            </p>
          )}
        </div>
      )}

      {/* 🪙 TARJETA DE PRESUPUESTO DE OPENROUTER */}
      {showAiSettings && hasKey && apiProvider === OPENROUTER_PROVIDER && (
        <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm border border-slate-950 flex flex-col gap-3 relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-24 h-24 bg-white/5 rounded-full blur-xl pointer-events-none" />

          <div className="flex items-center justify-between z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-indigo-400">
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Fondos de consumo</p>
                <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mt-0.5">OpenRouter · DeepSeek V4 Flash</p>
              </div>
            </div>

            <button
              type="button"
              disabled={loadingBalance}
              onClick={loadBalance}
              title="Refrescar fondos"
              aria-label="Refrescar fondos de OpenRouter"
              className="p-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl transition-all active:scale-[0.95] cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingBalance ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
          </div>

          <div className="mt-1 z-10">
            {loadingBalance && !balance ? (
              <div className="h-9 flex items-center text-xs text-slate-400 font-medium gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" /> Sincronizando saldo...
              </div>
            ) : balance ? (
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black tracking-tight font-mono">
                  {balance.remaining === null
                    ? (balance.limit === null ? 'Sin límite' : '—')
                    : formatAmount(balance.remaining)}
                </span>
                {balance.remaining !== null && (
                  <span className="text-xs font-extrabold text-slate-400 uppercase">
                    {balance.currency}
                  </span>
                )}
              </div>
            ) : balanceError ? (
              <p className="text-xs text-red-400 font-medium">{balanceError}</p>
            ) : (
              <p className="text-xs text-slate-400 font-medium">Sin fondos registrados o cuenta sin límite.</p>
            )}
          </div>

          {balance && (
            <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-3 mt-1 text-[11px] text-slate-400 font-medium z-10">
              <div>
                Límite: <span className="text-white font-bold font-mono">
                  {balance.limit === null ? 'Sin límite' : `$${formatAmount(balance.limit)} ${balance.currency}`}
                </span>
              </div>
              <div>
                Uso: <span className="text-white font-bold font-mono">
                  {balance.usage === null ? '—' : `$${formatAmount(balance.usage)} ${balance.currency}`}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {showAiSettings && hasLegacyDeepSeekKey && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 shadow-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold">Tienes una clave antigua de DeepSeek</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-800">
              Esta clave no se usará con el nuevo proveedor. Elimínala y guarda una clave de OpenRouter.
            </p>
            <button
              type="button"
              onClick={handleDeleteApiKey}
              disabled={deleting}
              className="mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-3 text-xs font-bold text-amber-900 transition-colors hover:bg-amber-100 disabled:opacity-50"
              data-testid="legacy-api-key-delete-button"
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Eliminar clave antigua
            </button>
          </div>
        </div>
      )}

      {/* FORMULARIO DE CLAVE DE OPENROUTER */}
      {showAiSettings && (
        <form
          onSubmit={handleSave}
          className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm"
          data-testid="settings-form"
        >
          <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="openrouter-api-key">
            Clave de API de OpenRouter
          </label>
          <div className="relative">
            <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="openrouter-api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasKey ? `Guardada: ${masked}` : 'sk-or-v1-...'}
              autoComplete="new-password"
              autoCapitalize="none"
              spellCheck="false"
              className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-2.5 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 text-sm font-medium"
              data-testid="api-key-input"
            />
          </div>
          <p className="mt-2 text-xs text-slate-400 leading-relaxed">
            Se guarda de forma segura en el servidor. Las generaciones usarán DeepSeek V4 Flash mediante OpenRouter y su proveedor con mayor throughput.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={saving || deleting || !apiKey.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 transition-colors h-10 cursor-pointer shadow-3xs"
              data-testid="api-key-save-button"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {hasKey ? 'Reemplazar clave' : 'Guardar clave'}
            </button>

            {hasKey && (
              <button
                type="button"
                onClick={handleDeleteApiKey}
                disabled={saving || deleting}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:opacity-50 text-xs font-bold px-4 py-2.5 transition-colors h-10 cursor-pointer"
                data-testid="api-key-delete-button"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Eliminar clave
              </button>
            )}
          </div>

          {saved && (
            <p className="mt-3 text-xs font-semibold text-green-600 bg-green-50 border border-green-100 px-3 py-1.5 rounded-xl animate-[fadeIn_0.1s_ease]" data-testid="settings-saved">
              Clave de OpenRouter guardada.
            </p>
          )}
          {deleted && (
            <p className="mt-3 text-xs font-semibold text-green-600 bg-green-50 border border-green-100 px-3 py-1.5 rounded-xl animate-[fadeIn_0.1s_ease]" data-testid="settings-deleted">
              Clave eliminada.
            </p>
          )}
          {error && (
            <p className="mt-3 text-xs font-semibold text-red-600 bg-red-50 border border-red-100 px-3 py-1.5 rounded-xl animate-[fadeIn_0.1s_ease]" data-testid="settings-error">
              {error}
            </p>
          )}
          {deleteError && (
            <p className="mt-3 text-xs font-semibold text-red-600 bg-red-50 border border-red-100 px-3 py-1.5 rounded-xl animate-[fadeIn_0.1s_ease]" data-testid="settings-delete-error">
              {deleteError}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
