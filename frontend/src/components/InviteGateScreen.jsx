import { useState } from 'react';
import { LogOut, Sparkles } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export default function InviteGateScreen({ credential, userEmail, onRedeemed, onCancel }) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    const normalizedCode = code.trim();
    if (!normalizedCode || submitting) return;

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/redeem-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential, code: normalizedCode }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Código inválido.');
      onRedeemed();
    } catch (requestError) {
      setError(requestError.message || 'No se pudo validar el código.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-center text-xl font-bold text-slate-900">Código de invitación</h1>
          <p className="mt-2 text-center text-sm text-slate-500">
            {userEmail} necesita un código para entrar. Pídeselo a quien te invitó.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="Código de invitación"
            autoCapitalize="characters"
            autoComplete="one-time-code"
            spellCheck="false"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-center font-mono text-lg tracking-widest uppercase"
            aria-label="Código de invitación"
          />

          {error && <p className="text-center text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !code.trim()}
            className="w-full rounded-xl bg-slate-900 py-3 font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? 'Verificando...' : 'Entrar'}
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="flex w-full items-center justify-center gap-2 py-2 text-sm font-medium text-slate-500"
          >
            <LogOut className="h-4 w-4" /> Usar otra cuenta
          </button>
        </form>
      </div>
    </div>
  );
}
