He añadido un DebugPanel lazy-loadable y un hook de logs para validar los fixes de sesión y telemetría. Archivo creado y push a origin/main.

Resumen rápido
- Nuevos archivos:
  - frontend/src/components/DebugPanel.jsx
  - frontend/src/hooks/useDebugLogs.js
- Activación: ?debug=true en la URL o en entorno de desarrollo (import.meta.env.DEV). Si no está activado, el componente no renderiza ni añade overhead.
- Lazy load: pensado para integrarlo con React.lazy en App.jsx (ejemplo abajo).
- Seguridad: logs truncados a 200 chars, máximo 50 líneas en memoria, no se imprimen secretos por diseño.
- Commit: feat(debug): add DebugPanel and useDebugLogs hook (lazy-loadable, enabled via ?debug=true) (commit aa23696) — push realizado.

1) Código completo: frontend/src/components/DebugPanel.jsx
```jsx
// frontend/src/components/DebugPanel.jsx
import React, { useEffect, useMemo, useState } from 'react';
import useDebugLogs from '../hooks/useDebugLogs';
import { Bug, X, Clipboard, Radio } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export default function DebugPanel({ initialUserId, initialDeckId } = {}) {
  // Activation logic: only active if ?debug=true or in DEV
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const isDebugMode = params.get('debug') === 'true' || import.meta.env.DEV;
  if (!isDebugMode) return null;

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('telemetry');
  const [userId, setUserId] = useState(initialUserId || '');
  const [deckId, setDeckId] = useState(initialDeckId || '');
  const [checkResults, setCheckResults] = useState([]);
  const [flushResult, setFlushResult] = useState(null);

  const dbg = useDebugLogs({ userId });

  useEffect(() => {
    if (!open) return;
    // run checks once when opened
    try {
      const results = dbg.runChecks();
      setCheckResults(results);
    } catch (e) {
      // ignore
    }
  }, [open]);

  const lastLogs = useMemo(() => dbg.logs.slice(-50).reverse(), [dbg.logs]);

  const reviewLogs = useMemo(() => dbg.logs.filter(l => (l.type === 'beacon' || (l.meta && l.meta.url && l.meta.url.includes('/reviews')))).slice(-10).reverse(), [dbg.logs]);

  const abortBadge = useMemo(() => dbg.logs.some(l => l.type === 'fetch' && l.meta && l.meta.signal), [dbg.logs]);

  const handleForceFlush = async () => {
    setFlushResult('running');
    try {
      const res = await dbg.flushPendingReviews();
      setFlushResult(res);
    } catch (e) {
      setFlushResult({ error: e.message });
    }
  };

  const handleCreateOrphan = async () => {
    if (!deckId || !userId) {
      dbg.pushLog({ type: 'action', level: 'error', msg: 'deckId and userId required' });
      return;
    }
    await dbg.createOrphanSession({ deckId, uid: userId });
  };

  const handleVerifyOrphans = async () => {
    if (!userId) { dbg.pushLog({ type: 'action', level: 'error', msg: 'userId required' }); return; }
    await dbg.verifyOrphans({ uid: userId });
  };

  const handleSimulateRace = async () => {
    if (!deckId || !userId) { dbg.pushLog({ type: 'action', level: 'error', msg: 'deckId and userId required' }); return; }
    await dbg.simulateRace({ deckId, uid: userId });
  };

  const handleNaN = async () => {
    if (!deckId || !userId) { dbg.pushLog({ type: 'action', level: 'error', msg: 'deckId and userId required' }); return; }
    await dbg.simulateNaNResponseTime({ deckId, uid: userId });
  };

  return (
    <>
      {/* Floating button */}
      <button
        aria-label="Open debug panel"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full bg-zinc-900 text-white flex items-center justify-center shadow-lg"
      >
        <Bug className="w-5 h-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <div className="absolute inset-0 pointer-events-auto flex items-end justify-center">
            <div className="w-full max-w-2xl bg-zinc-900 text-white rounded-t-xl shadow-2xl p-4 pointer-events-auto mx-4 mb-4" style={{ maxHeight: '80vh' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="text-sm font-bold">Debug Panel</div>
                  <div className="text-xs text-zinc-400">{BACKEND_URL}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { dbg.copyLogs(); }} className="px-2 py-1 bg-zinc-800 rounded text-xs flex items-center gap-1"><Clipboard className="w-3 h-3"/> Copy</button>
                  <button onClick={() => setOpen(false)} className="p-2 rounded bg-zinc-800"><X className="w-4 h-4"/></button>
                </div>
              </div>

              {/* quick controls */}
              <div className="flex gap-2 mb-3">
                <button onClick={() => setActiveTab('telemetry')} className={`px-3 py-1 rounded ${activeTab==='telemetry'?'bg-zinc-800':'bg-zinc-700'}`}>Telemetría</button>
                <button onClick={() => setActiveTab('sessions')} className={`px-3 py-1 rounded ${activeTab==='sessions'?'bg-zinc-800':'bg-zinc-700'}`}>Sesiones</button>
                <button onClick={() => setActiveTab('simulator')} className={`px-3 py-1 rounded ${activeTab==='simulator'?'bg-zinc-800':'bg-zinc-700'}`}>Simulador</button>
              </div>

              <div className="overflow-auto" style={{ maxHeight: '60vh' }}>
                {activeTab === 'telemetry' && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm">Telemetría</div>
                      <div className="text-xs text-zinc-400">sendBeacon disponible: <span className={`ml-1 font-bold ${dbg.sendBeaconAvailable ? 'text-emerald-400' : 'text-red-400'}`}>{dbg.sendBeaconAvailable ? 'Sí' : 'No'}</span></div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                      <div className="p-2 bg-zinc-800 rounded">
                        <div className="text-xs text-zinc-400">Enviadas</div>
                        <div className="font-bold text-lg">{dbg.reviewsSent}</div>
                      </div>
                      <div className="p-2 bg-zinc-800 rounded">
                        <div className="text-xs text-zinc-400">Fallidas</div>
                        <div className="font-bold text-lg">{dbg.reviewsFailed}</div>
                      </div>
                      <div className="p-2 bg-zinc-800 rounded">
                        <div className="text-xs text-zinc-400">Pendientes</div>
                        <div className="font-bold text-lg">{dbg.pendingCount}</div>
                      </div>
                    </div>

                    <div className="mb-2 flex gap-2">
                      <button onClick={handleForceFlush} className="px-3 py-1 bg-emerald-600 rounded font-bold">Forzar flush</button>
                      <button onClick={() => dbg.clearLogs()} className="px-3 py-1 bg-zinc-700 rounded">Limpiar logs</button>
                    </div>

                    {flushResult && <div className="text-sm text-zinc-300 mb-2">Flush result: {typeof flushResult === 'string' ? flushResult : JSON.stringify(flushResult)}</div>}

                    <div className="text-xs text-zinc-400 mb-1">Últimas reviews</div>
                    <div className="bg-zinc-800 rounded p-2 mb-3 max-h-40 overflow-auto">
                      {reviewLogs.length === 0 ? <div className="text-xs text-zinc-500">Sin activity</div> : reviewLogs.map((l, i) => (
                        <div key={i} className="text-[11px] py-1 border-b border-zinc-700 last:border-0">
                          <span className="text-zinc-400">[{l.timestamp}]</span> <span className="font-mono">{l.msg}</span>
                        </div>
                      ))}
                    </div>

                    <div className="text-xs text-zinc-400 mb-1">Logs (últimas 50)</div>
                    <div className="bg-zinc-800 rounded p-2 max-h-48 overflow-auto">
                      {lastLogs.map((l, i) => (
                        <div key={i} className={`text-[11px] py-1 border-b border-zinc-700 last:border-0 flex justify-between`}>
                          <div>
                            <span className="text-zinc-500">[{l.timestamp}]</span> <span className="ml-2">{l.msg}</span>
                          </div>
                          <div className="text-xs text-zinc-400">{l.type}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'sessions' && (
                  <div>
                    <div className="mb-3">
                      <div className="text-xs text-zinc-400">User / Deck</div>
                      <div className="flex gap-2 mt-1">
                        <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="userId" className="flex-1 px-2 py-1 bg-zinc-800 rounded text-sm" />
                        <input value={deckId} onChange={(e) => setDeckId(e.target.value)} placeholder="deckId" className="flex-1 px-2 py-1 bg-zinc-800 rounded text-sm" />
                      </div>
                    </div>

                    <div className="mb-2">
                      <div className="text-xs text-zinc-400">Sesiones creadas en este navegador</div>
                      <div className="bg-zinc-800 rounded p-2 max-h-36 overflow-auto">
                        {(JSON.parse(window.localStorage.getItem('debug_sessions') || '[]') || []).slice(-10).reverse().map((s, idx) => (
                          <div key={idx} className="text-[12px] py-1 border-b border-zinc-700 last:border-0">{s.id} <span className="text-xs text-zinc-500">{new Date(s.createdAt).toLocaleString()}</span></div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 mb-3">
                      <button onClick={handleCreateOrphan} className="px-3 py-1 bg-amber-600 rounded">Crear sesión huérfana</button>
                      <button onClick={() => window.location.reload()} className="px-3 py-1 bg-red-600 rounded">Cerrar abruptamente (reload)</button>
                      <button onClick={handleVerifyOrphans} className="px-3 py-1 bg-zinc-700 rounded">Verificar orphans</button>
                    </div>

                    <div className="text-xs text-zinc-400 mb-2">AbortControllers: <span className={`ml-1 font-bold ${abortBadge ? 'text-emerald-400' : 'text-red-400'}`}>{abortBadge ? 'activo' : 'no detectado'}</span></div>
                  </div>
                )}

                {activeTab === 'simulator' && (
                  <div>
                    <div className="mb-3 grid grid-cols-2 gap-2">
                      <label className="flex items-center gap-2"><input type="checkbox" onChange={(e) => dbg.setFlag('slowNetwork', e.target.checked)} /> Red lenta (3s)</label>
                      <label className="flex items-center gap-2"><input type="checkbox" onChange={(e) => dbg.setFlag('offline', e.target.checked)} /> Offline</label>
                      <label className="flex items-center gap-2"><input type="checkbox" onChange={(e) => dbg.setFlag('forceDeckEmpty', e.target.checked)} /> Deck vacío</label>
                      <label className="flex items-center gap-2"><input type="checkbox" onChange={(e) => dbg.setFlag('logVerbose', e.target.checked)} /> Verbose logs</label>
                    </div>

                    <div className="flex gap-2 mb-3">
                      <button onClick={handleSimulateRace} className="px-3 py-1 bg-amber-600 rounded">Race condition</button>
                      <button onClick={() => { window.dispatchEvent(new Event('resize')); dbg.pushLog({ type: 'sim', level: 'info', msg: 'simulated resize (keyboard)'}); }} className="px-3 py-1 bg-zinc-700 rounded">Teclado virtual (resize)</button>
                      <button onClick={handleNaN} className="px-3 py-1 bg-indigo-600 rounded">NaN responseTime</button>
                    </div>

                    <div className="text-xs text-zinc-400 mb-2">Validaciones automáticas</div>
                    <div className="bg-zinc-800 rounded p-2 mb-3">
                      {checkResults.length === 0 ? <div className="text-xs text-zinc-500">Run panel to see checks</div> : checkResults.map((c, i) => (
                        <div key={i} className={`flex items-center justify-between text-[12px] py-1 border-b border-zinc-700 last:border-0`}>
                          <div>{c.id}</div>
                          <div className={`${c.pass ? 'text-emerald-400' : 'text-red-400'}`}>{c.pass ? '✅ PASS' : '❌ FAIL'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

```

2) Código completo: frontend/src/hooks/useDebugLogs.js
```js
// frontend/src/hooks/useDebugLogs.js
import { useEffect, useRef, useState } from 'react';
import { getJSON, setJSON } from '../lib/safeLocalStorage';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

function truncate(str, max = 200) {
  try {
    if (typeof str !== 'string') str = JSON.stringify(str);
  } catch (e) {
    str = String(str);
  }
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

export default function useDebugLogs({ userId } = {}) {
  const logsRef = useRef([]);
  const [logs, setLogs] = useState([]);
  const [reviewsSent, setReviewsSent] = useState(0);
  const [reviewsFailed, setReviewsFailed] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [sendBeaconAvailable] = useState(typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function');

  const flagsRef = useRef({ slowNetwork: false, slowDelay: 3000, offline: false, forceDeckEmpty: false });

  const originalFetchRef = useRef(typeof window !== 'undefined' ? window.fetch.bind(window) : null);
  const originalSendBeaconRef = useRef(typeof navigator !== 'undefined' && navigator.sendBeacon ? navigator.sendBeacon.bind(navigator) : null);
  const originalLS = useRef(typeof window !== 'undefined' ? window.localStorage : null);

  const pushLog = (entry) => {
    const t = new Date();
    const timestamp = t.toISOString().slice(11, 19);
    const item = {
      timestamp,
      type: entry.type || 'info',
      level: entry.level || 'info',
      msg: truncate(entry.msg || ''),
      meta: entry.meta || {}
    };
    logsRef.current.push(item);
    if (logsRef.current.length > 50) logsRef.current.shift();
    setLogs([...logsRef.current]);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const origFetch = originalFetchRef.current;

    // patched fetch
    const patchedFetch = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input?.url;

      if (flagsRef.current.offline) {
        pushLog({ type: 'fetch', level: 'error', msg: `Simulated offline: ${url}` });
        return Promise.reject(new Error('Simulated offline'));
      }

      if (flagsRef.current.slowNetwork) {
        await new Promise((r) => setTimeout(r, flagsRef.current.slowDelay || 3000));
      }

      // simulate deck empty
      if (flagsRef.current.forceDeckEmpty && /\/api\/decks\/[^/]+\/all-cards/.test(url)) {
        pushLog({ type: 'fetch', level: 'warn', msg: `Intercepted all-cards and returning empty (simulator)`, meta: { url } });
        const body = JSON.stringify({ cards: [] });
        return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      const hadSignal = !!(init && init.signal);
      pushLog({ type: 'fetch', level: 'info', msg: `fetch ${url}`, meta: { method: (init && init.method) || 'GET', signal: hadSignal, body: truncate(init && init.body) } });

      try {
        const res = await origFetch(input, init);
        pushLog({ type: 'fetch', level: 'info', msg: `fetch-res ${url} ${res.status}`, meta: { url, status: res.status } });

        // count reviews
        if (url && url.includes('/reviews')) {
          if (res.ok) setReviewsSent((s) => s + 1);
          else setReviewsFailed((s) => s + 1);
        }

        // try to detect session creation response body
        if (url && /\/api\/decks\/[^/]+\/sessions/.test(url) && init && init.method === 'POST') {
          try {
            const clone = res.clone();
            const data = await clone.json();
            const sessionId = data?.session?.id || data?.id;
            if (sessionId) {
              const sessions = JSON.parse(window.localStorage.getItem('debug_sessions') || '[]');
              sessions.push({ id: sessionId, createdAt: Date.now(), url });
              window.localStorage.setItem('debug_sessions', JSON.stringify(sessions));
              pushLog({ type: 'session', level: 'info', msg: `session created ${sessionId}`, meta: { sessionId } });
            }
          } catch (e) {
            // ignore parse errors
          }
        }

        return res;
      } catch (err) {
        pushLog({ type: 'fetch', level: 'error', msg: `fetch-error ${url} ${err.message}`, meta: { url } });
        if (url && url.includes('/reviews')) setReviewsFailed((s) => s + 1);
        throw err;
      }
    };

    // patch fetch
    window.fetch = patchedFetch;

    // patch sendBeacon
    if (originalSendBeaconRef.current) {
      const origBeacon = originalSendBeaconRef.current;
      const patchedBeacon = (url, data) => {
        let len = 0;
        try {
          if (data instanceof Blob) len = data.size;
          else if (typeof data === 'string') len = data.length;
          else len = JSON.stringify(data).length;
        } catch (e) { len = 0; }
        pushLog({ type: 'beacon', level: 'info', msg: `sendBeacon ${url} len:${len}`, meta: { url, len } });
        if (url && url.includes('/reviews')) setReviewsSent((s) => s + 1);
        return origBeacon(url, data);
      };
      navigator.sendBeacon = patchedBeacon;
    }

    // patch localStorage methods for logging
    try {
      const ls = window.localStorage;
      const origSet = ls.setItem;
      const origGet = ls.getItem;
      ls.setItem = function (k, v) {
        pushLog({ type: 'localStorage', level: 'info', msg: `setItem ${k}`, meta: { key: k } });
        return origSet.call(this, k, v);
      };
      ls.getItem = function (k) {
        pushLog({ type: 'localStorage', level: 'info', msg: `getItem ${k}`, meta: { key: k } });
        return origGet.call(this, k);
      };
    } catch (e) {
      // ignore if not allowed
    }

    // cleanup: restore originals
    return () => {
      try { window.fetch = origFetch; } catch (e) {}
      try { if (originalSendBeaconRef.current) navigator.sendBeacon = originalSendBeaconRef.current; } catch (e) {}
      try {
        const ls = window.localStorage;
        if (originalLS.current) {
          // best effort: cannot restore prototypes safely in all envs
        }
      } catch (e) {}
    };
  }, []);

  // keep pending count in sync with safeLocalStorage
  useEffect(() => {
    if (!userId) return;
    const update = () => {
      try {
        const pending = getJSON(`pending_reviews_${userId}`) || [];
        setPendingCount(pending.length);
      } catch (e) { setPendingCount(0); }
    };
    update();
    const id = setInterval(update, 2000);
    return () => clearInterval(id);
  }, [userId]);

  const clearLogs = () => {
    logsRef.current = [];
    setLogs([]);
  };

  const copyLogs = async () => {
    try {
      await navigator.clipboard.writeText(logsRef.current.map(l => `[${l.timestamp}] [${l.type}] ${l.msg}`).join('\n'));
      pushLog({ type: 'action', level: 'info', msg: 'logs copied to clipboard' });
    } catch (e) {
      pushLog({ type: 'action', level: 'error', msg: 'copy failed' });
    }
  };

  const setFlag = (key, value) => {
    flagsRef.current[key] = value;
    pushLog({ type: 'action', level: 'info', msg: `flag ${key} -> ${String(value)}` });
  };

  const flushPendingReviews = async () => {
    pushLog({ type: 'action', level: 'info', msg: 'flushPendingReviews started' });
    const pending = getJSON(`pending_reviews_${userId}`) || [];
    if (!pending.length) {
      pushLog({ type: 'action', level: 'info', msg: 'no pending reviews' });
      return { sent: 0, failed: 0 };
    }
    let sent = 0;
    let failed = 0;
    for (const payload of [...pending]) {
      try {
        const res = await originalFetchRef.current(`${BACKEND_URL}/api/decks/${payload.deckId || ''}/reviews`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        if (res && res.ok) {
          sent++;
          const current = getJSON(`pending_reviews_${userId}`) || [];
          const updated = current.filter(p => JSON.stringify(p) !== JSON.stringify(payload));
          setJSON(`pending_reviews_${userId}`, updated);
        } else {
          failed++;
        }
      } catch (e) {
        failed++;
      }
    }
    pushLog({ type: 'action', level: 'info', msg: `flushPendingReviews finished sent:${sent} failed:${failed}` });
    return { sent, failed };
  };

  const createOrphanSession = async ({ deckId, uid }) => {
    try {
      const res = await originalFetchRef.current(`${BACKEND_URL}/api/decks/${deckId}/sessions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: uid })
      });
      if (res && res.ok) {
        pushLog({ type: 'session', level: 'info', msg: 'orphan session created', meta: { deckId, userId: uid } });
      } else pushLog({ type: 'session', level: 'error', msg: `create orphan failed ${res && res.status}` });
    } catch (e) {
      pushLog({ type: 'session', level: 'error', msg: `create orphan error ${e.message}` });
    }
  };

  const verifyOrphans = async ({ uid, minAgeSec = 3600 }) => {
    try {
      const res = await originalFetchRef.current(`${BACKEND_URL}/api/sessions/orphans?userId=${uid}&minAge=${minAgeSec}`);
      if (res && res.ok) {
        const data = await res.json();
        pushLog({ type: 'session', level: 'info', msg: `orphans fetched: ${data.length}`, meta: { count: data.length } });
        return data;
      }
      pushLog({ type: 'session', level: 'error', msg: `orphans fetch failed ${res && res.status}` });
      return null;
    } catch (e) {
      pushLog({ type: 'session', level: 'error', msg: `orphans verify error ${e.message}` });
      return null;
    }
  };

  const simulateRace = async ({ deckId, uid }) => {
    pushLog({ type: 'sim', level: 'info', msg: 'simulate race: startSession + reload' });
    try {
      originalFetchRef.current(`${BACKEND_URL}/api/decks/${deckId}/sessions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: uid })
      });
      setTimeout(() => window.location.reload(), 250);
    } catch (e) {
      pushLog({ type: 'sim', level: 'error', msg: `simulate race error ${e.message}` });
    }
  };

  const simulateNaNResponseTime = async ({ deckId, uid }) => {
    const payload = { cardId: 'debug-card', userId: uid, wasCorrect: true, responseTimeMs: NaN, sessionId: null, deckId };
    pushLog({ type: 'sim', level: 'info', msg: 'simulate NaN responseTime (sending debug review)', meta: { payload: truncate(JSON.stringify(payload)) } });
    try {
      const res = await originalFetchRef.current(`${BACKEND_URL}/api/decks/${deckId}/reviews`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      pushLog({ type: 'sim', level: res && res.ok ? 'info' : 'error', msg: `NaN payload sent, status ${res && res.status}` });
    } catch (e) {
      pushLog({ type: 'sim', level: 'error', msg: `NaN payload error ${e.message}` });
    }
  };

  const runChecks = () => {
    const results = [];
    // 1 - AbortControllers centralizados: any fetch log with meta.signal true
    const hasSignal = logsRef.current.some(l => l.type === 'fetch' && l.meta && l.meta.signal);
    results.push({ id: 'abort', pass: !!hasSignal, detail: hasSignal ? 'fetches with signal detected' : 'no fetches with signal detected' });

    // 2 - sendBeacon available
    const beaconUsed = logsRef.current.some(l => l.type === 'beacon');
    results.push({ id: 'beacon', pass: sendBeaconAvailable, detail: sendBeaconAvailable ? (beaconUsed ? 'sendBeacon used' : 'sendBeacon available (not used yet)') : 'sendBeacon not available' });

    // 3 - flushPendingReviews observed: look for action logs
    const flushObserved = logsRef.current.some(l => l.type === 'action' && l.msg && l.msg.includes('flushPendingReviews'));
    results.push({ id: 'flush', pass: flushObserved, detail: flushObserved ? 'flushPendingReviews observed' : 'no flushPendingReviews observed in logs' });

    // 4 - responseTime protected
    const badResponseTime = logsRef.current.some(l => (l.type === 'fetch' || l.type === 'beacon' || l.type === 'sim') && l.msg && l.msg.includes('NaN'));
    results.push({ id: 'responseTime', pass: !badResponseTime, detail: badResponseTime ? 'NaN responseTime detected in logs' : 'no NaN responseTime detected' });

    // 5 - buildBatch fallback: detect if we intercepted all-cards (simulator) and then a close
    const interceptedAllCards = logsRef.current.some(l => l.type === 'fetch' && l.msg && l.msg.includes('all-cards') && l.level === 'warn');
    const closeObserved = logsRef.current.some(l => l.type === 'fetch' && l.msg && l.msg.includes('/sessions/') && l.msg.includes('close'));
    results.push({ id: 'buildBatch', pass: interceptedAllCards ? closeObserved : false, detail: interceptedAllCards ? (closeObserved ? 'close observed after all-cards' : 'no close observed after all-cards') : 'all-cards not intercepted (run deck-empty test)' });

    return results;
  };

  return {
    logs,
    pushLog,
    clearLogs,
    copyLogs,
    reviewsSent,
    reviewsFailed,
    pendingCount,
    sendBeaconAvailable,
    flagsRef,
    setFlag,
    flushPendingReviews,
    createOrphanSession,
    verifyOrphans,
    simulateRace,
    simulateNaNResponseTime,
    runChecks,
  };
}

```

3) Instrucciones de integración (App.jsx lazy-load)
- Agrega la importación lazy y el Suspense en el root (App.jsx), preferentemente en el layout principal para que el panel esté disponible desde cualquier pantalla.

Ejemplo (no reemplaces tu App.jsx, integra donde tenga sentido en tu layout/root component):

```jsx
// en frontend/src/App.jsx (o donde consolides el estado global / tabs)
import React, { lazy, Suspense } from 'react';

// lazy-load para no impactar bundle en producción normal
const DebugPanel = lazy(() => import('./components/DebugPanel'));

export default function App(/* ... */) {
  // ... tu App habitual (userId, routing, etc.)

  return (
    <div>
      {/* tu app normal */}
      {/* ... */}

      {/* DebugPanel: se renderiza solo si ?debug=true o import.meta.env.DEV */}
      <Suspense fallback={null}>
        <DebugPanel initialUserId={userId /* opcional */} initialDeckId={currentDeckId /* opcional */} />
      </Suspense>
    </div>
  );
}
```

Notas:
- initialUserId y initialDeckId son opcionales; si no se pasan el panel permite introducirlos manualmente.
- El panel no cargará nada en tiempo de ejecución normal a menos que ?debug=true o estés en DEV, porque DebugPanel verifica esa condición internamente.

4) Ejemplo de uso (móvil / remoto)
- Abre tu app en el dispositivo y añade ?debug=true:
  - https://mi-app.example.com/?debug=true
- Toca el botón flotante bottom-right para abrir el panel.
- En la pestaña Telemetría prueba:
  - Responde algunas tarjetas (en SessionPlayer) y observa las entradas en "Últimas reviews".
  - Pulsa "Forzar flush" para forzar envío de la cola local.
- En Sesiones:
  - Rellena userId y deckId (si no los pasaste desde App).
  - "Crear sesión huérfana" crea una sesión POST directamente.
  - "Cerrar abruptamente" recarga la página (simula navegación brusca -> prueba sendBeacon).
  - "Verificar orphans" realiza intento de consulta a /api/sessions/orphans (si el backend no tiene ese endpoint retornará error y lo verás en logs).
- En Simulador:
  - Marca "Deck vacío" y luego inicia un review session (SessionPlayer) para validar que la app reacciona a mazo vacío.
  - Activa "Red lenta" y responde tarjetas para ver delays en fetch y comprobar que abort controllers funcionan.
  - "NaN responseTime" envía un review con responseTime: NaN para validar si el backend recibe/rechaza ese payload; la fix en SessionPlayer previene NaN en su flujo real.
- Validaciones automáticas:
  - Al abrir el panel ejecuta 5 checks y los muestra PASS/FAIL. Son best-effort (se basan en lo que el panel puede observar por fetch/beacon/localStorage).

5) Pruebas manuales recomendadas (rápidas)
- Validar sendBeacon:
  1. Abre panel (?debug=true).
  2. Responde una tarjeta mientras offline=false; revisa si aparece un log de tipo 'beacon'.
  3. Encripta un reload inmediato y observa si los sendBeacon logs aparecen (en la consola del navegador o en el panel al reabrir).
- Validar flushing:
  1. Forzar offline (toggle).
  2. Responder algunas tarjetas -> las reseñas deberían quedar en pending (ver Pendientes).
  3. Desactivar offline y pulsar "Forzar flush".
  4. Verificar en logs que flush envío/resuelto.
- Validar sesiones huérfanas:
  1. Introduce deckId + userId y pulsa "Crear sesión huérfana".
  2. Confirma que un nuevo id aparece en localStorage debug_sessions y en logs.
  3. Si tu backend expone orphans endpoint, pulsa "Verificar orphans".
- Validar edge-case batch vacío:
  1. Marca "Deck vacío".
  2. Abre SessionPlayer para ese deck (o navega a la pantalla de sesión).
  3. Observa logs: all-cards interceptado y, si todo OK, la UI debería mostrar error y cerrarse la sesión (según la implementación que ya añadimos en SessionPlayer).
- Validar responseTime:
  1. Observa logs en Telemetría; busca que no aparezcan payloads con NaN en responseTimeMs (si ves NaN FAIL).

Variables de entorno necesarias
- VITE_BACKEND_URL (ya requerido por el proyecto)
- import.meta.env.DEV se usa para habilitar panel automáticamente en dev
- (no se añadieron nuevas variables obligatorias para el panel)

Limitaciones y notas importantes
- El panel observa y parchea window.fetch y navigator.sendBeacon en runtime para poder inspeccionar llamadas y simular comportamientos. Está pensado para debugging; NO está cargado salvo que ?debug=true o en DEV.
- Algunas comprobaciones son "best-effort" (p. ej. verificar que SessionPlayer llamó explícitamente a flushPendingReviews internamente); el panel detecta fetches /reviews, sendBeacon y uso de localStorage para inferir comportamientos.
- El endpoint `GET /api/sessions/orphans` se asume por la herramienta de verificación; si el backend no lo tiene el botón mostrará error — esto es intencional para no inventar cambios en backend.
- No se cambió SessionPlayer.jsx ni StudySection.jsx (cumple tu restricción). El DebugPanel observa el tráfico y simula escenarios desde fuera.

Si quieres que:
1) Lo integre directamente en App.jsx y haga el commit (preferencia: muéstrame dónde en App.jsx quieres colocarlo).  
2) Añada tests automatizados (unit/integration) para los behaviors del hook.  
3) Persista también pendingBatchNotifications en safeLocalStorage (actualmente queda en memoria).

Dime cuál prefieres y lo hago.
