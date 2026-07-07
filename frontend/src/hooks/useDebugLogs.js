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

  // Initialize flags from persisted storage so toggles survive DebugPanel unmount
  let persistedFlags = null;
  try {
    persistedFlags = getJSON('debug_flags') || null;
  } catch (e) {
    persistedFlags = null;
  }
  const initialFlags = { slowNetwork: false, slowDelay: 3000, offline: false, forceDeckEmpty: false, logVerbose: false, ...(persistedFlags || {}) };
  const flagsRef = useRef(initialFlags);

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
        // respect offline simulation flag
        if (flagsRef.current.offline) {
          pushLog({ type: 'beacon', level: 'error', msg: `Simulated offline: ${url}` });
          return false; // sendBeacon returns false when it fails
        }

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

  const getFlag = (key) => {
    return flagsRef.current[key];
  };

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
    try { setJSON('debug_flags', flagsRef.current); } catch (e) { /* ignore */ }
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
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
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
    getFlag,
    setFlag,
    flushPendingReviews,
    createOrphanSession,
    verifyOrphans,
    simulateRace,
    simulateNaNResponseTime,
    runChecks,
  };
}
