// FILE: frontend/src/components/RadarDebugPanel.jsx
import { useState } from 'react';
import { Terminal, ShieldAlert, Zap, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export default function RadarDebugPanel({ userId, decks, loadDecks, loadMaterias }) {
  const [isOpen, setIsOpen] = useState(false);
  const [deckId, setDeckId] = useState('');
  const [cardId, setCardId] = useState('');
  const [wasCorrect, setWasCorrect] = useState(true);
  const [responseTime, setResponseTime] = useState(1500);
  const [loading, setLoading] = useState(false);
  const [serverConsole, setServerConsole] = useState(null);

  const handleFireTelemetry = async (e) => {
    e.preventDefault();
    if (!deckId || !cardId) return alert('Por favor, selecciona un mazo e introduce un Card ID válido.');

    setLoading(true);
    setServerConsole(null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/decks/${deckId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId,
          userId,
          wasCorrect,
          responseTimeMs: Number(responseTime)
        })
      });

      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Error en el servidor');

      setServerConsole({ status: 'SUCCESS', ...data });
      
      // 🔥 REACCIÓN EN CADENA: Forzamos el refresco global de la caché del cliente
      await Promise.all([loadDecks(true), loadMaterias(true)]);

    } catch (err) {
      setServerConsole({ status: 'CRITICAL_ERROR', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 md:bottom-6 z-50 bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-amber-500/30 font-mono text-xs px-3 py-2 rounded-xl shadow-lg flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
      >
        <Terminal className="w-3.5 h-3.5 animate-pulse" /> Radar Engine Debugger
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 bg-zinc-950 border border-zinc-800 text-zinc-300 rounded-2xl shadow-2xl overflow-hidden font-mono text-[11px] animate-[slideUp_0.15s_ease-out]">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-amber-400">
          <Zap className="w-3.5 h-3.5 fill-amber-400/20" />
          <span className="font-bold tracking-tight">TELEMETRY INJECTOR v1.0</span>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-zinc-500 hover:text-white transition-colors cursor-pointer">✕</button>
      </div>

      {/* Formulario */}
      <form onSubmit={handleFireTelemetry} className="p-3 space-y-3">
        {/* Selector de Mazos Vivos */}
        <div>
          <label className="block text-zinc-500 mb-1 text-[10px] font-bold uppercase tracking-wide">1. Mazo Objetivo (Target Deck)</label>
          <select 
            value={deckId} 
            onChange={(e) => setDeckId(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-1.5 text-zinc-200 focus:outline-none focus:border-zinc-700"
          >
            <option value="">-- Selecciona un Mazo --</option>
            {decks.map(d => (
              <option key={d.id} value={d.id}>{d.title} ({d.analytics?.masteryPercentage}% D.)</option>
            ))}
          </select>
        </div>

        {/* Input Manual de Card ID (Copia uno de tu DB o Consola) */}
        <div>
          <label className="block text-zinc-500 mb-1 text-[10px] font-bold uppercase tracking-wide">2. ID de la Tarjeta (Card Object ID)</label>
          <input 
            type="text" 
            required
            placeholder="Pega el ObjectId de la Flashcard..."
            value={cardId}
            onChange={(e) => setCardId(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-1.5 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
          />
        </div>

        {/* Estado de Respuesta */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setWasCorrect(true)}
            className={`py-1.5 rounded-lg border font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
              wasCorrect ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> CORRECTO
          </button>
          <button
            type="button"
            onClick={() => setWasCorrect(false)}
            className={`py-1.5 rounded-lg border font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
              !wasCorrect ? 'bg-rose-950/40 border-rose-500 text-rose-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" /> ERROR
          </button>
        </div>

        {/* Simulador de Latencia/Tiempo de Respuesta */}
        <div>
          <div className="flex justify-between text-zinc-500 text-[10px] font-bold uppercase tracking-wide mb-1">
            <span>3. Tiempo de Respuesta</span>
            <span className="text-zinc-300">{(responseTime / 1000).toFixed(1)}s</span>
          </div>
          <input 
            type="range" 
            min="1000" 
            max="13000" 
            step="500"
            value={responseTime} 
            onChange={(e) => setResponseTime(e.target.value)}
            className="w-full accent-amber-500 bg-zinc-800 rounded-lg appearance-none h-1 cursor-pointer"
          />
        </div>

        {/* Botón de Impacto */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 text-zinc-950 font-black py-2 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
        >
          {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'INYECTAR REPASO EN CASCADA'}
        </button>
      </form>

      {/* Consola de Servidor (Salida Analítica) */}
      {serverConsole && (
        <div className="bg-black/40 border-t border-zinc-800 p-2.5 max-h-36 overflow-y-auto font-mono text-[10px] space-y-1">
          {serverConsole.status === 'SUCCESS' ? (
            <>
              <div className="text-emerald-400 font-bold">✓ HTTP 201: LEDGER_OK</div>
              <div className="text-zinc-500">Mazo recalculado con éxito:</div>
              <div className="grid grid-cols-2 gap-x-2 text-zinc-400">
                <span>• Dominio Mazo:</span> <span className="text-zinc-200 font-bold">{serverConsole.updatedDeckMetrics.masteryPercentage}%</span>
                <span>• Fluidez Prom:</span> <span className="text-zinc-200">{(serverConsole.updatedDeckMetrics.avgResponseTime / 1000).toFixed(2)}s</span>
                <span>• Log ID:</span> <span className="text-zinc-500 truncate">{serverConsole.log.id}</span>
              </div>
              <div className="text-amber-400 font-bold mt-1 text-[9px]">➔ UI Actualizada a 0ms</div>
            </>
          ) : (
            <>
              <div className="text-rose-500 font-bold flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> CRITICAL_FAIL</div>
              <div className="text-rose-400/80">{serverConsole.message}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
