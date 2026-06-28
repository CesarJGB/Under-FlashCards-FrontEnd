// ARCHIVO: frontend/src/components/SettingsSection.jsx
import { useState, useEffect, useCallback } from 'react';
import { KeyRound, Loader2, Check, Wallet, RefreshCw } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export default function SettingsSection({ userId }) {
  const [apiKey, setApiKey] = useState('');
  const [masked, setMasked] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // 🪙 ESTADOS DEL SALDO DE IA
  const [balance, setBalance] = useState(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [balanceError, setBalanceError] = useState('');

  // Encapsulamos la consulta en useCallback para poder re-llamarla con un botón de refresh
  const loadBalance = useCallback(async () => {
    setLoadingBalance(true);
    setBalanceError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/user/${userId}/balance`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.hasBalance && data.info) {
        setBalance(data.info);
      } else {
        setBalance(null);
      }
    } catch {
      setBalanceError('No se pudo actualizar el presupuesto de la IA.');
    } finally {
      setLoadingBalance(false);
    }
  }, [userId]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/user/${userId}`);
        if (res.ok) {
          const data = await res.json();
          setHasKey(data.hasApiKey);
          setMasked(data.apiKeyMasked || '');
          
          // Si el usuario ya tiene una clave en el sistema, jalamos el saldo de inmediato
          if (data.hasApiKey) {
            loadBalance();
          }
        }
      } catch {
        /* ignore */
      }
    })();
  }, [userId, loadBalance]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/user/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, aiApiKey: apiKey }),
      });
      if (!res.ok) throw new Error('No se pudo guardar la clave.');
      const data = await res.json();
      setHasKey(data.hasApiKey);
      setMasked(data.apiKeyMasked || '');
      setApiKey('');
      setSaved(true);
      
      // Consultar balance justo después de actualizar/guardar una nueva clave exitosamente
      loadBalance();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="settings-section" className="animate-[fadeIn_0.15s_ease] max-w-xl">
      <h2 className="text-2xl font-bold text-slate-900">Ajustes</h2>
      <p className="text-slate-500 mt-1">Administra tu clave de API de IA y verifica tu consumo.</p>

      {/* 🪙 TARJETA DE PRESUPUESTO DE DEEPSEEK */}
      {hasKey && (
        <div className="mt-6 bg-slate-900 text-white rounded-2xl p-5 shadow-sm border border-slate-950 flex flex-col gap-3 relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-24 h-24 bg-white/5 rounded-full blur-xl pointer-events-none" />
          
          <div className="flex items-center justify-between z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-indigo-400">
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Fondos de Consumo Inteligente</p>
                <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mt-0.5">Proveedor: DeepSeek AI</p>
              </div>
            </div>

            <button 
              type="button"
              disabled={loadingBalance}
              onClick={loadBalance}
              title="Refrescar fondos"
              className="p-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl transition-all active:scale-[0.95] cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingBalance ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
          </div>

          <div className="mt-1 z-10">
            {loadingBalance && !balance ? (
              <div className="h-9 flex items-center text-xs text-slate-400 font-medium gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" /> Sincronizando cartera...
              </div>
            ) : balance ? (
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black tracking-tight font-mono">
                  {parseFloat(balance.total_balance).toFixed(2)}
                </span>
                <span className="text-xs font-extrabold text-slate-400 uppercase">
                  {balance.currency}
                </span>
              </div>
            ) : balanceError ? (
              <p className="text-xs text-red-400 font-medium">{balanceError}</p>
            ) : (
              <p className="text-xs text-slate-400 font-medium">Sin fondos registrados o cuenta gratuita.</p>
            )}
          </div>

          {balance && (
            <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-3 mt-1 text-[11px] text-slate-400 font-medium z-10">
              <div>Recargado: <span className="text-white font-bold font-mono">${parseFloat(balance.topped_up_balance).toFixed(2)}</span></div>
              <div>Regalo/Bono: <span className="text-white font-bold font-mono">${parseFloat(balance.granted_balance).toFixed(2)}</span></div>
            </div>
          )}
        </div>
      )}

      {/* FORMULARIO CLÁSICO DE LLAVE */}
      <form
        onSubmit={handleSave}
        className="mt-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm"
        data-testid="settings-form"
      >
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Clave de API de IA</label>
        <div className="relative">
          <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={hasKey ? `Guardada: ${masked}` : 'sk-...'}
            className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-2.5 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 text-sm font-medium"
            data-testid="api-key-input"
          />
        </div>
        <p className="mt-2 text-xs text-slate-400 leading-relaxed">
          Se guarda de forma segura en el servidor y nunca se muestra completa de nuevo. Al actualizarla, se refrescará tu saldo automáticamente.
        </p>

        <button
          type="submit"
          disabled={saving || !apiKey.trim()}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 transition-colors h-10 cursor-pointer shadow-3xs"
          data-testid="api-key-save-button"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Guardar clave
        </button>

        {saved && <p className="mt-3 text-xs font-semibold text-green-600 bg-green-50 border border-green-100 px-3 py-1.5 rounded-xl animate-[fadeIn_0.1s_ease]" data-testid="settings-saved">Clave guardada.</p>}
        {error && <p className="mt-3 text-xs font-semibold text-red-600 bg-red-50 border border-red-100 px-3 py-1.5 rounded-xl animate-[fadeIn_0.1s_ease]" data-testid="settings-error">{error}</p>}
      </form>
    </div>
  );
}
