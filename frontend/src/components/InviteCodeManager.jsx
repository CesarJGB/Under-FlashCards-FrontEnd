import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Plus, RotateCcw, Trash2 } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export default function InviteCodeManager({ authToken, onBack }) {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [label, setLabel] = useState('');

  const authHeaders = useCallback(() => (
    authToken ? { Authorization: `Bearer ${authToken}` } : {}
  ), [authToken]);

  const loadInvites = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/invite-codes`, {
        headers: authHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Error al cargar códigos.');
      setInvites(data.invites || []);
    } catch (requestError) {
      setError(requestError.message || 'Error al cargar códigos.');
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  const handleGenerate = async () => {
    if (generating) return;
    setGenerating(true);
    setError('');
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/invite-codes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ label: label.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Error al generar código.');
      setLabel('');
      await loadInvites();
    } catch (requestError) {
      setError(requestError.message || 'Error al generar código.');
    } finally {
      setGenerating(false);
    }
  };

  const updateInvite = async (id, action, confirmationMessage) => {
    if (confirmationMessage && !window.confirm(confirmationMessage)) return;
    setError('');
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/invite-codes/${id}/${action}`, {
        method: 'PATCH',
        headers: authHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudo actualizar el código.');
      await loadInvites();
    } catch (requestError) {
      setError(requestError.message || 'No se pudo actualizar el código.');
    }
  };

  const unused = invites.filter((invite) => invite.status === 'unused');
  const active = invites.filter((invite) => invite.status === 'active');
  const revoked = invites.filter((invite) => invite.status === 'revoked');

  const inviteRow = (invite, action, Icon, title, className, confirmationMessage) => (
    <div
      key={invite._id}
      className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2"
    >
      <div className="min-w-0">
        <p className="font-mono text-sm font-semibold text-slate-900">{invite.code}</p>
        {invite.redeemedByEmail && (
          <p className="truncate text-xs text-slate-500">{invite.redeemedByEmail}</p>
        )}
        {invite.label && <p className="truncate text-xs text-slate-400">{invite.label}</p>}
      </div>
      {action && (
        <button
          type="button"
          onClick={() => updateInvite(invite._id, action, confirmationMessage)}
          title={title}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${className}`}
        >
          <Icon className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  return (
    <div className="w-full">
      <div className="flex h-full flex-col p-6">
        <button
          type="button"
          onClick={onBack}
          className="mb-6 inline-flex self-start items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a Perfil
        </button>

        <h1 className="mb-6 text-center text-2xl font-bold text-slate-900">Códigos de invitación</h1>

        {error && (
          <div className="mb-4 w-full rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mb-6 flex w-full gap-2">
          <input
            type="text"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleGenerate();
            }}
            placeholder="Nota opcional (ej. Juan - grupo X)"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Generar
          </button>
        </div>

        {loading ? (
          <p className="text-center text-sm text-slate-500">Cargando...</p>
        ) : (
          <div className="w-full space-y-6 overflow-y-auto">
            <section>
              <h3 className="mb-2 text-sm font-semibold text-slate-500">Canjeados ({active.length})</h3>
              <div className="space-y-2">
                {active.length === 0 && <p className="text-sm text-slate-400">Ninguno todavía.</p>}
                {active.map((invite) => inviteRow(
                  invite,
                  'revoke',
                  Trash2,
                  'Quitar acceso',
                  'bg-red-50 text-red-600 hover:bg-red-100',
                  '¿Quitar acceso a este código? La persona no podrá entrar hasta que lo reactives.',
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-slate-500">Sin canjear ({unused.length})</h3>
              <div className="space-y-2">
                {unused.length === 0 && <p className="text-sm text-slate-400">Ninguno pendiente.</p>}
                {unused.map((invite) => inviteRow(invite, null, null, null, null, null))}
              </div>
            </section>

            {revoked.length > 0 && (
              <section>
                <h3 className="mb-2 text-sm font-semibold text-slate-500">Revocados ({revoked.length})</h3>
                <div className="space-y-2">
                  {revoked.map((invite) => inviteRow(
                    invite,
                    'reactivate',
                    RotateCcw,
                    'Reactivar acceso',
                    'bg-emerald-50 text-emerald-600 hover:bg-emerald-100',
                    '¿Reactivar el acceso de este código?',
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
