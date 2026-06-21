import { useState, useEffect } from 'react';
import { KeyRound, Loader2, Check } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export default function SettingsSection({ userId }) {
  const [apiKey, setApiKey] = useState('');
  const [masked, setMasked] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/user/${userId}`);
        if (res.ok) {
          const data = await res.json();
          setHasKey(data.hasApiKey);
          setMasked(data.apiKeyMasked || '');
        }
      } catch {
        /* ignore */
      }
    })();
  }, [userId]);

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
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="settings-section">
      <h2 className="text-2xl font-bold text-slate-900">Ajustes</h2>
      <p className="text-slate-500 mt-1">Administra tu clave de API de IA.</p>

      <form
        onSubmit={handleSave}
        className="mt-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm max-w-xl"
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
            className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-2.5 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
            data-testid="api-key-input"
          />
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Se guarda de forma segura en el servidor y nunca se muestra completa de nuevo.
        </p>

        <button
          type="submit"
          disabled={saving || !apiKey.trim()}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium px-5 py-2.5"
          data-testid="api-key-save-button"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Guardar clave
        </button>

        {saved && <p className="mt-3 text-sm text-green-600" data-testid="settings-saved">Clave guardada.</p>}
        {error && <p className="mt-3 text-sm text-red-600" data-testid="settings-error">{error}</p>}
      </form>
    </div>
  );
}
