import React, { useState, useEffect, useRef, useMemo } from 'react';
import { RotateCw, CheckCircle, XCircle, ArrowLeft, Loader2, RefreshCw, BarChart3, X } from 'lucide-react';
import CardFace, { getCardBackgroundStyle } from './CardFace';
import FlipCard from './FlipCard';
import { parseCardStyles } from '../lib/utils';
import { buildContinuousBatch, buildNormalBatch, applyLocalAnswer, getCardId } from '../lib/batchBuilder';
import { getJSON, setJSON } from '../lib/safeLocalStorage';
import useImmersiveScrollGuard from '../hooks/useImmersiveScrollGuard';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

// =========================================================================
// CONFIGURACIÓN POR MODO
// =========================================================================
const MODE_CONFIG = {
  continuous: {
    buildBatch: buildContinuousBatch,
    loadingText: 'Cargando el mazo...',
    progressLabel: 'Bucle Activo',
    summaryTitle: 'Resumen del Bucle Activo',
    batchLabel: 'Lotes completados',
    cardStyle: 'flip',
    incorrectLabel: 'No la recordé',
    correctLabel: 'La dominé',
  },
  normal: {
    buildBatch: buildNormalBatch,
    loadingText: 'Cargando el mazo...',
    progressLabel: 'Mazo',
    summaryTitle: 'Resumen del Repaso',
    batchLabel: 'Vueltas completas al mazo',
    cardStyle: 'study',
    incorrectLabel: 'Necesito verla de nuevo',
    correctLabel: 'Ya me la sé',
  },
};

const FlipCardSection = React.memo(function FlipCardSection({ currentCard, parsedStyles, bgStyle, hasBg, isFlipped, onFlip, setIsZoomed }) {
  const front = useMemo(() => (
    <div
      style={bgStyle}
      className="relative w-full h-full border border-slate-200 p-6 flex flex-col justify-between bg-white"
    >
      {hasBg && <span className="absolute inset-0 bg-black/55" />}
      <span className={`relative z-10 text-[10px] font-bold tracking-widest uppercase ${hasBg ? 'text-white/70' : 'text-amber-500'}`}>Pregunta</span>
      <div data-immersive-allow-scroll="true" className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 overflow-y-auto">
        <CardFace card={currentCard} side="question" dark={hasBg} parsedStyles={parsedStyles} onExpandImage={() => setIsZoomed(true)} />
      </div>
      <div className={`relative z-10 text-[10px] font-semibold text-center flex items-center justify-center gap-1.5 uppercase tracking-wider ${hasBg ? 'text-white/60' : 'text-slate-400'}`}>
        <RefreshCw className="w-3 h-3 animate-[spin_4s_linear_infinite]" /> Toca la tarjeta para voltear
      </div>
    </div>
  ), [currentCard, parsedStyles, bgStyle, hasBg, setIsZoomed]);

  const back = useMemo(() => (
    <div
      style={hasBg ? bgStyle : undefined}
      className={`relative w-full h-full p-6 flex flex-col justify-between text-white border border-slate-800 ${hasBg ? '' : 'bg-slate-950'}`}
    >
      {hasBg && <span className="absolute inset-0 bg-black/55" />}
      <span className="relative z-10 text-[10px] font-bold text-indigo-400 tracking-widest uppercase">Respuesta Correcta</span>
      <div data-immersive-allow-scroll="true" className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 overflow-y-auto">
        <CardFace card={currentCard} side="answer" dark={true} parsedStyles={parsedStyles} onExpandImage={() => setIsZoomed(true)} />
      </div>
      <div className="relative z-10 text-[10px] font-medium text-center text-slate-500 uppercase tracking-wider">
        Califica tu nivel de retención abajo
      </div>
    </div>
  ), [currentCard, parsedStyles, bgStyle, hasBg, setIsZoomed]);

  return (
    <div className="mb-6">
      <FlipCard isFlipped={isFlipped} onFlip={onFlip} front={front} back={back} />
    </div>
  );
});

export default function SessionPlayer({ deckId, userId, onExit, mode = 'continuous' }) {
  const config = MODE_CONFIG[mode] || MODE_CONFIG.continuous;

  useImmersiveScrollGuard(true, `SessionPlayer-${mode}`);

  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessionSummary, setSessionSummary] = useState(null);
  const [closing, setClosing] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  const startTimeRef = useRef(null);
  const sessionIdRef = useRef(null);
  const sessionClosedRef = useRef(false);
  const controllersRef = useRef([]);
  const sessionStartPromiseRef = useRef(null);
  const pendingReviewsRef = useRef([]);
  const pendingBatchNotificationsRef = useRef([]);
  const pendingSessionReviewsRef = useRef([]);
  const allCardsRef = useRef([]); // mazo completo, cargado una sola vez; se actualiza localmente tras cada respuesta

  const currentCard = cards[currentIndex];
  const parsedStyles = useMemo(() => currentCard ? parseCardStyles(currentCard.fontSize) : null, [currentCard]);
  const { style: bgStyle, hasBg } = useMemo(() => getCardBackgroundStyle(currentCard, parsedStyles), [currentCard, parsedStyles]);

  // =========================================================================
  // CICLO DE VIDA DE LA SESIÓN DE ESTUDIO
  // =========================================================================
  // Helper para centralizar fetches con AbortController
  const makeFetch = (url, opts = {}) => {
    const controller = new AbortController();
    controllersRef.current.push(controller);
    const signal = controller.signal;
    const optsWithSignal = { ...opts, signal };
    return fetch(url, optsWithSignal)
      .finally(() => {
        controllersRef.current = controllersRef.current.filter(c => c !== controller);
      });
  };

  // Telemetría: sendBeacon fallback + cola local persistida vía safeLocalStorage
  const sendReview = (payload) => {
    // Enrich payload with deckId y mode para asegurar que toda review quede autocontenida.
    const enrichedPayload = { ...payload, deckId, mode };

    if (!enrichedPayload.sessionId) {
      pendingSessionReviewsRef.current.push(enrichedPayload);
      return Promise.resolve(true);
    }

    const body = JSON.stringify(enrichedPayload);
    // Preferir sendBeacon cuando esté disponible (mejor para unload/navigation)
    try {
      if (navigator && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([body], { type: 'application/json' });
        const targetDeck = enrichedPayload.deckId || deckId;
        const ok = navigator.sendBeacon(`${BACKEND_URL}/api/decks/${targetDeck}/reviews`, blob);
        if (ok) return Promise.resolve(true);
      }
    } catch (e) {
      console.warn('[SessionPlayer] sendBeacon failed, falling back to fetch', e);
    }

    // Fallback: persistir en memoria y en safeLocalStorage y emitir con fetch async
    try {
      pendingReviewsRef.current.push(enrichedPayload);
      setJSON(`pending_reviews_${userId}`, pendingReviewsRef.current);
    } catch (e) {
      console.warn('[SessionPlayer] Could not persist pending review', e);
    }

    const targetDeck = enrichedPayload.deckId || deckId;
    return makeFetch(`${BACKEND_URL}/api/decks/${targetDeck}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    }).then(res => {
      if (!res || !res.ok) throw new Error('Failed to send review');
      // remover la primera ocurrencia del payload en la cola
      try {
        const idx = pendingReviewsRef.current.findIndex(p => JSON.stringify(p) === body);
        if (idx !== -1) {
          pendingReviewsRef.current.splice(idx, 1);
          setJSON(`pending_reviews_${userId}`, pendingReviewsRef.current);
        }
      } catch (e) { /* ignore */ }
      return true;
    }).catch(err => {
      console.error('[SessionPlayer] Error sending review via fetch:', err);
      return false;
    });
  };

  const flushPendingSessionReviews = () => {
    if (!sessionIdRef.current || pendingSessionReviewsRef.current.length === 0) return;

    const queuedReviews = [...pendingSessionReviewsRef.current];
    pendingSessionReviewsRef.current = [];

    queuedReviews.forEach((payload) => {
      sendReview({ ...payload, sessionId: sessionIdRef.current }).catch(() => { /* handled inside sendReview */ });
    });
  };

  const flushPendingReviews = async () => {
    // cargar cola persistida
    const persisted = getJSON(`pending_reviews_${userId}`) || [];
    pendingReviewsRef.current = pendingReviewsRef.current.length ? pendingReviewsRef.current : persisted;

    const toSend = [...pendingReviewsRef.current];
    for (const payload of toSend) {
      try {
        const targetDeck = payload.deckId || deckId;
        const res = await makeFetch(`${BACKEND_URL}/api/decks/${targetDeck}/reviews`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res && res.ok) {
          // eliminar todas las ocurrencias que coincidan con el payload serializado
          pendingReviewsRef.current = pendingReviewsRef.current.filter(p => JSON.stringify(p) !== JSON.stringify(payload));
          setJSON(`pending_reviews_${userId}`, pendingReviewsRef.current);
        }
      } catch (e) {
        if (e.name === 'AbortError') break;
        console.error('[SessionPlayer] flushPendingReviews error:', e);
      }
    }
  };
  const startSession = async () => {
    try {
      // Guardamos la promesa para potencial coordinación desde cleanup
      sessionStartPromiseRef.current = makeFetch(`${BACKEND_URL}/api/decks/${deckId}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, mode })
      });

      const response = await sessionStartPromiseRef.current;
      if (!response || !response.ok) throw new Error('No se pudo iniciar la sesión.');
      const data = await response.json();
      sessionIdRef.current = data.session?.id || null;

      flushPendingSessionReviews();

      // Si había notificaciones pendientes de lote, flusharlas ahora
      if (pendingBatchNotificationsRef.current.length > 0 && sessionIdRef.current) {
        try {
          await makeFetch(`${BACKEND_URL}/api/sessions/${sessionIdRef.current}/batch-completed`, { method: 'PATCH' });
          pendingBatchNotificationsRef.current = [];
        } catch (e) { /* ignore */ }
      }
    } catch (err) {
      if (err.name === 'AbortError') return; // request was cancelled during unmount
      console.error('Error al iniciar sesión de estudio:', err);
      sessionIdRef.current = null;
    }
  };

  const closeSession = async (showSummary = false) => {
    if (!sessionIdRef.current || sessionClosedRef.current) return;
    sessionClosedRef.current = true;

    try {
      if (showSummary) {
        setClosing(true);
        await makeFetch(`${BACKEND_URL}/api/users/${userId}/queue-status`).catch(
          err => console.error('Error al esperar la cola de cascada:', err)
        );
      }

      const response = await makeFetch(`${BACKEND_URL}/api/sessions/${sessionIdRef.current}/close`, {
        method: 'PATCH'
      });
      if (response && response.ok) {
        const data = await response.json();
        if (showSummary) setSessionSummary(data.session);
      }
    } catch (err) {
      console.error('Error al cerrar sesión de estudio:', err);
    } finally {
      if (showSummary) setClosing(false);
    }
  };

  const notifyBatchCompleted = () => {
    if (!sessionIdRef.current) {
      // encolar la notificación para reintentar cuando tengamos sessionId
      pendingBatchNotificationsRef.current.push(true);
      return;
    }

    makeFetch(`${BACKEND_URL}/api/sessions/${sessionIdRef.current}/batch-completed`, {
      method: 'PATCH'
    }).catch(err => console.error('Error al actualizar lote de sesión:', err));
  };

  // Carga del mazo completo: se llama UNA SOLA VEZ al montar. Todo lote
  // posterior se arma en memoria con config.buildBatch, sin red.
  const loadDeck = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await makeFetch(`${BACKEND_URL}/api/decks/${deckId}/all-cards?userId=${userId}`);
      if (!response || !response.ok) throw new Error('No se pudo cargar el mazo.');

      const data = await response.json();
      if (!data.cards || data.cards.length === 0) {
        throw new Error('Este mazo no tiene tarjetas para repasar.');
      }

      allCardsRef.current = data.cards;
      startNewBatch();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const lastCardIdRef = useRef(null);

  const startNewBatch = () => {
    let batch = config.buildBatch(allCardsRef.current, { excludeCardId: lastCardIdRef.current });
    if (!batch || batch.length === 0) {
      // fallback: usar todo el mazo si existe
      batch = allCardsRef.current && allCardsRef.current.length ? [...allCardsRef.current] : [];
    }
    if (!batch || batch.length === 0) {
      // no hay tarjetas -> mostrar error y cerrar sesión seguro
      setError('No hay tarjetas disponibles para repasar.');
      // Intentar cerrar la sesión de forma segura
      closeSession(true);
      return;
    }

    setCards(batch);
    setCurrentIndex(0);
    setIsFlipped(false);
    startTimeRef.current = performance.now();
  };

  useEffect(() => {
    sessionIdRef.current = null;
    sessionClosedRef.current = false;
    sessionStartPromiseRef.current = null;
    pendingBatchNotificationsRef.current = [];
    pendingSessionReviewsRef.current = [];

    // cargar cola persistente de reviews
    try {
      pendingReviewsRef.current = getJSON(`pending_reviews_${userId}`) || [];
    } catch (e) { pendingReviewsRef.current = []; }

    startSession();
    loadDeck();

    return () => {
      // Abortar requests en curso para evitar setState post-unmount
      controllersRef.current.forEach(c => c.abort());
      controllersRef.current = [];

      // Intentar flush de telemetría en background con timeout de 2s
      (async () => {
        try {
          await Promise.race([flushPendingReviews(), new Promise(r => setTimeout(r, 2000))]);
        } catch (e) {
          console.error('[SessionPlayer] Error flushing pending reviews on unmount', e);
        }

        // Intentar cerrar la sesión de forma limpia
        try { await closeSession(false); } catch (e) { /* ignore */ }
      })();
    };
  }, [deckId, userId, mode]);

  useEffect(() => {
    if (cards.length > 0 && !loading) {
      startTimeRef.current = performance.now();
      setIsFlipped(false);
      setIsZoomed(false);
    }
  }, [currentIndex, cards, loading]);

  const handleFlip = () => {
    if (config.cardStyle === 'flip') setIsFlipped(!isFlipped);
  };

  const handleAnswer = (wasCorrect) => {
    const endTime = performance.now();
    const responseTimeMs = startTimeRef.current ? Math.round(endTime - startTimeRef.current) : 0;
    const currentCard = cards[currentIndex];
    const cardId = getCardId(currentCard);

    // 🔥 Disparo Optimista hacia el Ledger y Motor en Cascada (No bloquea la UI)
    // Telemetría optimista: usar sendBeacon si es posible + persistir en cola si falla
    sendReview({
      cardId,
      userId,
      wasCorrect,
      responseTimeMs,
      sessionId: sessionIdRef.current,
      mode
    }).catch(() => { /* handled inside sendReview */ });

    // Actualizamos la copia local de la tarjeta (mismo delta que aplica el
    // backend) para que el próximo lote ya priorice con datos frescos,
    // sin esperar ningún round-trip de red.
    allCardsRef.current = applyLocalAnswer(allCardsRef.current, cardId, wasCorrect);

    lastCardIdRef.current = cardId;

    if (currentIndex < cards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      notifyBatchCompleted();
      startNewBatch();
    }
  };

  const handleExit = () => {
    closeSession(true);
  };

  // =========================================================================
  // PANTALLA DE CIERRE
  // =========================================================================
  if (closing) {
    return (
      <div className="flex flex-col items-center justify-center h-80 animate-[fadeIn_0.1s_ease]">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
        <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Consolidando tu progreso...</p>
      </div>
    );
  }

  // =========================================================================
  // PANTALLA DE RESUMEN
  // =========================================================================
  if (sessionSummary) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center animate-[fadeIn_0.15s_ease]">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-5">
          <BarChart3 className="w-7 h-7 text-indigo-600" />
        </div>
        <h3 className="text-lg font-extrabold text-slate-800 mb-1">Sesión completada</h3>
        <p className="text-xs text-slate-400 mb-6 uppercase tracking-wider font-semibold">{config.summaryTitle}</p>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
            <p className="text-2xl font-extrabold text-slate-800">{sessionSummary.cardsAnswered}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mt-1">Tarjetas</p>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
            <p className="text-2xl font-extrabold text-slate-800">{sessionSummary.batchesCompleted}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mt-1">{config.batchLabel}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
            <p className="text-2xl font-extrabold text-emerald-600">{sessionSummary.correctCount}</p>
            <p className="text-[10px] text-emerald-500 uppercase tracking-wider font-bold mt-1">Correctas</p>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
            <p className="text-2xl font-extrabold text-red-500">{sessionSummary.incorrectCount}</p>
            <p className="text-[10px] text-red-400 uppercase tracking-wider font-bold mt-1">Errores</p>
          </div>
        </div>

        <p className="text-xs text-slate-400 mb-6">
          Precisión: <span className="font-bold text-slate-600">{Math.round(sessionSummary.accuracyRate * 100)}%</span>
          {' · '}
          Tiempo promedio: <span className="font-bold text-slate-600">{sessionSummary.avgResponseTimeMs}ms</span>
        </p>

        <button
          onClick={onExit}
          className="w-full bg-slate-900 text-white py-3 rounded-2xl font-bold text-sm hover:bg-slate-800 transition-colors active:scale-[0.98]"
        >
          Volver al Mazo
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-80 animate-[fadeIn_0.1s_ease]">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
        <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">{config.loadingText}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-100 rounded-2xl text-center max-w-md mx-auto my-12">
        <p className="text-red-800 text-sm font-semibold mb-4">{error}</p>
        <button 
          onClick={handleExit}
          className="bg-white border border-red-200 text-red-700 px-4 py-2 rounded-xl text-xs font-bold shadow-xs hover:bg-red-100 transition-colors"
        >
          Regresar al Mazo
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-2 py-4 animate-[fadeIn_0.15s_ease]">
      <div className="flex justify-between items-center mb-6">
        <button 
          onClick={handleExit}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors uppercase tracking-wider"
        >
          <ArrowLeft className="w-4 h-4 stroke-[2.5]" /> Salir de la sesión
        </button>
        <span className="text-[10px] bg-slate-900 text-slate-100 px-3 py-1 rounded-full font-extrabold uppercase tracking-widest shadow-xs">
          {config.progressLabel}: {currentIndex + 1} / {cards.length}
        </span>
      </div>

      {config.cardStyle === 'flip' ? (
        <FlipCardSection
          currentCard={currentCard}
          parsedStyles={parsedStyles}
          bgStyle={bgStyle}
          hasBg={hasBg}
          isFlipped={isFlipped}
          onFlip={handleFlip}
          setIsZoomed={setIsZoomed}
        />
      ) : (
        <div className="h-72 w-full mb-6 border border-slate-200 rounded-3xl shadow-sm flex flex-col overflow-hidden">
          <div style={bgStyle} className="relative flex-1 flex flex-col items-center justify-center px-6 py-4 border-b border-slate-100 overflow-hidden">
            {hasBg && <span className="absolute inset-0 bg-black/55" />}
            <span className={`relative z-10 text-[10px] font-bold tracking-widest uppercase mb-2 ${hasBg ? 'text-white/70' : 'text-amber-500'}`}>Pregunta</span>
            <div data-immersive-allow-scroll="true" className="relative z-10 flex flex-col items-center overflow-y-auto max-h-full">
              <CardFace card={currentCard} side="question" dark={hasBg} parsedStyles={parsedStyles} onExpandImage={() => setIsZoomed(true)} />
            </div>
          </div>
          <div
            style={hasBg ? bgStyle : undefined}
            className={`relative flex-1 flex flex-col items-center justify-center px-6 py-4 overflow-hidden ${hasBg ? '' : 'bg-slate-950'}`}
          >
            {hasBg && <span className="absolute inset-0 bg-black/55" />}
            <span className="relative z-10 text-[10px] font-bold text-indigo-400 tracking-widest uppercase mb-2">Respuesta</span>
            <div data-immersive-allow-scroll="true" className="relative z-10 flex flex-col items-center overflow-y-auto max-h-full">
              <CardFace card={currentCard} side="answer" dark={true} parsedStyles={parsedStyles} onExpandImage={() => setIsZoomed(true)} />
            </div>
          </div>
        </div>
      )}

      <div className="h-16">
        {(config.cardStyle === 'study' || isFlipped) && (
          <div className="grid grid-cols-2 gap-4 animate-[fadeIn_0.12s_ease]">
            <button
              onClick={(e) => { e.stopPropagation(); handleAnswer(false); }}
              className="flex items-center justify-center gap-2 bg-red-50 border border-red-200 text-red-600 rounded-2xl font-bold text-sm hover:bg-red-100/80 transition-all active:scale-[0.97]"
            >
              <XCircle className="w-4 h-4 stroke-[2.5]" /> {config.incorrectLabel}
            </button>
            
            <button
              onClick={(e) => { e.stopPropagation(); handleAnswer(true); }}
              className="flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-2xl font-bold text-sm hover:bg-emerald-700 shadow-sm hover:shadow-md hover:shadow-emerald-900/10 transition-all active:scale-[0.97]"
            >
              <CheckCircle className="w-4 h-4 stroke-[2.5]" /> {config.correctLabel}
            </button>
          </div>
        )}
      </div>

      {isZoomed && currentCard?.contentImage && (
        <div
          onClick={() => setIsZoomed(false)}
          className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-[fadeIn_0.15s_ease]"
        >
          <button
            type="button"
            onClick={() => setIsZoomed(false)}
            className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors border border-white/10"
          >
            <X className="w-5 h-5" />
          </button>

          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-3xl w-full flex flex-col items-center animate-[scaleIn_0.15s_ease-out]"
          >
            <img
              src={currentCard.contentImage}
              alt="Detalle ampliado"
              className="max-h-[82vh] max-w-full object-contain rounded-2xl border-2 border-white/10 shadow-2xl bg-slate-900/40 p-1.5"
            />
            <p className="text-white/60 text-xs font-semibold mt-3 bg-black/40 px-3 py-1 rounded-full backdrop-blur-xs select-none">
              Modo Detalle • Clic afuera para regresar
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
