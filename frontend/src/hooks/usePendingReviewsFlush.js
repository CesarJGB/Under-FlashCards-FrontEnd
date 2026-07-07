import { useEffect, useRef } from 'react';
import { getJSON, setJSON } from '../lib/safeLocalStorage';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export default function usePendingReviewsFlush(userId, pushLog) {
  const isFlushingRef = useRef(false);

  const flushPendingReviews = async () => {
    if (!userId || isFlushingRef.current) return { sent: 0, failed: 0 };

    let pending = getJSON(`pending_reviews_${userId}`) || [];
    if (!pending || pending.length === 0) {
      if (pushLog) pushLog({ type: 'flush', level: 'info', msg: 'no pending reviews' });
      return { sent: 0, failed: 0 };
    }

    isFlushingRef.current = true;
    if (pushLog) pushLog({ type: 'flush', level: 'info', msg: `Starting global flush: ${pending.length} pending reviews` });
    console.log(`[flush] Starting global flush: ${pending.length} pending reviews`);

    let sent = 0;
    let failed = 0;

    for (const payload of [...pending]) {
      try {
        const deckId = payload.deckId;
        if (!deckId) {
          failed++;
          if (pushLog) pushLog({ type: 'flush', level: 'error', msg: 'Payload missing deckId, skipping', meta: { payload } });
          console.warn('[flush] Payload missing deckId, skipping', payload);
          continue;
        }

        const res = await fetch(`${BACKEND_URL}/api/decks/${deckId}/reviews`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res && res.ok) {
          sent++;
          // remove from queue
          const current = getJSON(`pending_reviews_${userId}`) || [];
          const updated = current.filter(p => JSON.stringify(p) !== JSON.stringify(payload));
          setJSON(`pending_reviews_${userId}`, updated);
        } else {
          failed++;
          const statusText = res ? `${res.status} ${res.statusText}` : 'no response';
          if (pushLog) pushLog({ type: 'flush', level: 'error', msg: `Failed to send review: ${statusText}`, meta: { payload, status: res?.status } });
          console.warn('[flush] Failed to send review', statusText, payload);
        }
      } catch (e) {
        failed++;
        if (pushLog) pushLog({ type: 'flush', level: 'error', msg: `Exception sending review: ${e.message}`, meta: { payload } });
        console.error('[flush] Exception sending review', e);
      }
    }

    isFlushingRef.current = false;
    if (pushLog) pushLog({ type: 'flush', level: 'info', msg: `Finished global flush: sent=${sent} failed=${failed}` });
    console.log(`[flush] Finished: sent=${sent}, failed=${failed}`);
    return { sent, failed };
  };

  useEffect(() => {
    if (!userId) return;
    const t = setTimeout(() => {
      flushPendingReviews();
    }, 2000);
    return () => clearTimeout(t);
  }, [userId]);

  useEffect(() => {
    const onOnline = () => {
      if (pushLog) pushLog({ type: 'flush', level: 'info', msg: 'Network online, triggering global flush' });
      flushPendingReviews();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [userId]);

  return { flushPendingReviews };
}
