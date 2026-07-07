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
  const [createOrphanResult, setCreateOrphanResult] = useState(null);
  const [verifyOrphansResult, setVerifyOrphansResult] = useState(null);

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
    const res = await dbg.createOrphanSession({ deckId, uid: userId });
    setCreateOrphanResult(res);
    if (res && res.ok) {
      dbg.pushLog({ type: 'action', level: 'info', msg: `createOrphanSession succeeded: ${res.status}` });
    } else {
      dbg.pushLog({ type: 'action', level: 'error', msg: `createOrphanSession failed`, meta: res });
    }
  };

  const handleVerifyOrphans = async () => {
    if (!userId) { dbg.pushLog({ type: 'action', level: 'error', msg: 'userId required' }); return; }
    const res = await dbg.verifyOrphans({ uid: userId });
    setVerifyOrphansResult(res);
    if (res && res.ok) dbg.pushLog({ type: 'action', level: 'info', msg: `verifyOrphans succeeded`, meta: { count: res.data?.length } });
    else dbg.pushLog({ type: 'action', level: 'error', msg: `verifyOrphans failed`, meta: res });
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
                      <button onClick={() => dbg.inspectPendingQueue()} className="px-3 py-1 bg-indigo-600 rounded">Inspeccionar cola</button>
                      <button onClick={() => dbg.clearLogs()} className="px-3 py-1 bg-zinc-700 rounded">Limpiar logs</button>
                    </div>

                    {flushResult && (
                      <div className="text-sm text-zinc-300 mb-2 p-2 bg-zinc-800 rounded">
                        <div>Flush result: sent={flushResult.sent || 0}, failed={flushResult.failed || 0}</div>
                        {flushResult.errors && flushResult.errors.length > 0 && (
                          <div className="text-xs text-red-400 mt-1">First error: {JSON.stringify(flushResult.errors[0], null, 2)}</div>
                        )}
                      </div>
                    )}

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

                    {createOrphanResult && (
                      <div className="mb-2 p-2 bg-zinc-800 rounded text-sm text-zinc-200">
                        <div className="font-bold">Create orphan result</div>
                        <pre className="whitespace-pre-wrap text-xs mt-1">{JSON.stringify(createOrphanResult, null, 2)}</pre>
                      </div>
                    )}

                    {verifyOrphansResult && (
                      <div className="mb-2 p-2 bg-zinc-800 rounded text-sm text-zinc-200">
                        <div className="font-bold">Verify orphans result</div>
                        <pre className="whitespace-pre-wrap text-xs mt-1">{JSON.stringify(verifyOrphansResult, null, 2)}</pre>
                      </div>
                    )}

                    <div className="text-xs text-zinc-400 mb-2">AbortControllers: <span className={`ml-1 font-bold ${abortBadge ? 'text-emerald-400' : 'text-red-400'}`}>{abortBadge ? 'activo' : 'no detectado'}</span></div>
                  </div>
                )}

                {activeTab === 'simulator' && (
                  <div>
                    <div className="mb-3 grid grid-cols-2 gap-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          defaultChecked={!!dbg.getFlag?.('slowNetwork')}
                          onChange={(e) => dbg.setFlag('slowNetwork', e.target.checked)}
                        />
                        Red lenta (3s)
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          defaultChecked={!!dbg.getFlag?.('offline')}
                          onChange={(e) => dbg.setFlag('offline', e.target.checked)}
                        />
                        Offline
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          defaultChecked={!!dbg.getFlag?.('forceDeckEmpty')}
                          onChange={(e) => dbg.setFlag('forceDeckEmpty', e.target.checked)}
                        />
                        Deck vacío
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          defaultChecked={!!dbg.getFlag?.('logVerbose')}
                          onChange={(e) => dbg.setFlag('logVerbose', e.target.checked)}
                        />
                        Verbose logs
                      </label>
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
