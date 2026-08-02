import { AlertTriangle, RefreshCw, WalletCards } from 'lucide-react';
import HomeWidgetShell from './HomeWidgetShell';

function formatAmount(value, currency = 'USD') {
  if (value === null || value === undefined) return '—';
  const prefix = currency === 'USD' ? '$' : `${currency} `;
  return `${prefix}${Number(value).toFixed(2)}`;
}

function formatSyncTime(value) {
  if (!value) return 'Aún no sincronizado';

  try {
    return `Actualizado ${new Intl.DateTimeFormat('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))}`;
  } catch {
    return 'Último dato guardado';
  }
}

function getModelLabel(model) {
  if (!model) return 'OpenRouter';
  const normalized = String(model).split('/').pop() || model;
  return normalized
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getUsagePercentage(info) {
  if (info?.limit === null || info?.limit === undefined || info.limit <= 0) return null;
  if (info.limit_remaining === null || info.limit_remaining === undefined) return null;

  const percentage = ((info.limit - info.limit_remaining) / info.limit) * 100;
  return Math.max(0, Math.min(100, Math.round(percentage)));
}

function RefreshButton({ isRefreshing, onRefresh }) {
  return (
    <button
      type="button"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onRefresh?.();
      }}
      disabled={isRefreshing}
      title="Actualizar saldo de OpenRouter"
      aria-label="Actualizar saldo de OpenRouter"
      className="rounded-xl p-2 text-zinc-400 transition-all hover:bg-zinc-100 hover:text-indigo-600 active:scale-95 disabled:cursor-wait disabled:opacity-60"
    >
      <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-indigo-500' : ''}`} />
    </button>
  );
}

function UsageStat({ label, value, currency }) {
  return (
    <div className="min-w-0 rounded-2xl border border-zinc-200/80 bg-zinc-50 px-2.5 py-2.5">
      <p className="truncate text-[9px] font-black uppercase tracking-[0.12em] text-zinc-400">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-zinc-900">{formatAmount(value, currency)}</p>
    </div>
  );
}

export default function OpenRouterBalanceWidget({
  openRouterBalance,
  onRefreshOpenRouterBalance,
}) {
  const snapshot = openRouterBalance?.snapshot || null;
  const info = snapshot?.info || null;
  const isRefreshing = Boolean(openRouterBalance?.isRefreshing);
  const refreshError = openRouterBalance?.error || snapshot?.syncError || '';
  const currency = info?.currency || 'USD';
  const usagePercentage = getUsagePercentage(info);
  const hasUnlimitedKey = info && info.limit === null && info.limit_remaining === null;

  return (
    <HomeWidgetShell
      title="Saldo de OpenRouter"
      description="Consumo de tu clave y fondos disponibles."
      icon={WalletCards}
      headerAction={(
        <RefreshButton
          isRefreshing={isRefreshing}
          onRefresh={onRefreshOpenRouterBalance || openRouterBalance?.refresh}
        />
      )}
      footerNote={snapshot ? formatSyncTime(snapshot.syncedAt) : 'Se sincroniza al entrar a la app.'}
    >
      {!info ? (
        <div className="h-full rounded-[28px] border border-dashed border-zinc-200 bg-zinc-50/70 px-6 text-center flex flex-col items-center justify-center gap-2">
          {isRefreshing ? (
            <RefreshCw className="h-7 w-7 animate-spin text-indigo-500" />
          ) : (
            <WalletCards className="h-7 w-7 text-zinc-400" />
          )}
          <p className="text-sm font-bold text-zinc-700">
            {isRefreshing ? 'Sincronizando saldo...' : 'Configura una clave de OpenRouter'}
          </p>
          <p className="max-w-[28ch] text-[11px] text-zinc-400">
            {refreshError || 'El saldo aparecerá aquí cuando guardes tu clave desde Ajustes.'}
          </p>
        </div>
      ) : (
        <div className="h-full flex flex-col gap-3">
          <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-slate-950 via-indigo-950 to-indigo-700 p-4 text-white shadow-[0_12px_26px_rgba(49,46,129,0.22)]">
            <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
            <div className="relative flex items-start justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-200">Disponible</p>
                <p className="mt-1 text-3xl font-black tracking-tight">
                  {info.limit_remaining === null
                    ? (hasUnlimitedKey ? 'Sin límite' : '—')
                    : formatAmount(info.limit_remaining, currency)}
                </p>
              </div>
              <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[9px] font-bold text-indigo-100">
                {getModelLabel(snapshot.model)}
              </span>
            </div>

            {usagePercentage !== null ? (
              <div className="relative mt-4">
                <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold text-indigo-100">
                  <span>{usagePercentage}% utilizado</span>
                  <span>{formatAmount(info.limit, currency)} de límite</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-white transition-all duration-500"
                    style={{ width: `${usagePercentage}%` }}
                  />
                </div>
              </div>
            ) : (
              <p className="relative mt-3 text-[10px] font-medium text-indigo-100">
                {info.is_free_tier ? 'Cuenta con nivel gratuito' : 'La clave no tiene un límite asignado'}
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <UsageStat label="Hoy" value={info.usage_daily} currency={currency} />
            <UsageStat label="Semana" value={info.usage_weekly} currency={currency} />
            <UsageStat label="Mes" value={info.usage_monthly} currency={currency} />
          </div>

          {snapshot.stale || refreshError ? (
            <div className="flex min-h-[24px] items-center gap-1.5 px-1 text-[10px] font-semibold text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{refreshError || 'Mostrando el último dato guardado.'}</span>
            </div>
          ) : null}
        </div>
      )}
    </HomeWidgetShell>
  );
}
