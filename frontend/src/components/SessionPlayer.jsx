import React, { useState, useEffect, useRef } from 'react';
import { RotateCw, CheckCircle, XCircle, ArrowLeft, Loader2, RefreshCw, BarChart3, X } from 'lucide-react';
import CardFace, { getCardBackgroundStyle } from './CardFace';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

// =========================================================================
// CONFIGURACIÓN POR MODO
// =========================================================================
// Cada modo define solo lo que cambia entre sí: qué endpoint trae la cola,
// y los textos de UI. Todo el ciclo de vida (sesión, telemetría, resumen,
// flush de cascada) es idéntico para ambos y vive en el cuerpo del componente.
const MODE_CONFIG = {
  continuous: {
    queueEndpoint: (deckId, userId) => `/api/decks/${deckId}/continuous-session?userId=${userId}`,
    loadingText: 'Estructurando cola de prioridad matemática...',
    progressLabel: 'Bucle Activo',
    summaryTitle: 'Resumen del Bucle Activo',
    batchLabel: 'Lotes completados',
    cardStyle: 'flip', // pregunta sola, voltear para ver respuesta, calificar al vuelo
    incorrectLabel: 'No la recordé',
    correctLabel: 'La dominé',
  },
  normal: {
    queueEndpoint: (deckId, userId) => `/api/decks/${deckId}/normal-session?userId=${userId}`,
    loadingText: 'Preparando el mazo...',
    progressLabel: 'Mazo',
    summaryTitle: 'Resumen del Repaso',
    batchLabel: 'Vueltas completas al mazo',
    cardStyle: 'study', // pregunta y respuesta juntas, sin flip; calificar después de estudiar
    incorrectLabel: 'Necesito verla de nuevo',
    correctLabel: 'Ya me la sé',
  },
};

export default function SessionPlayer({ deckId, userId, onExit, mode = 'continuous' }) {
  const config = MODE_CONFIG[mode] || MODE_CONFIG.continuous;

  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessionSummary, setSessionSummary] = useState(null); // resumen a mostrar al salir
  const [closing, setClosing] = useState(false); // true mientras se espera el flush de la cascada antes de cerrar
  const [isZoomed, setIsZoomed] = useState(false); // true mientras se muestra la imagen de la tarjeta en pantalla completa

  const startTimeRef = useRef(null);
  const sessionIdRef = useRef(null); // sessionId vive en ref: evita stale closures en handleAnswer
  const sessionClosedRef = useRef(false); // evita doble-cierre (botón + cleanup de useEffect)

  // =========================================================================
  // CICLO DE VIDA DE LA SESIÓN DE ESTUDIO (idéntico para ambos modos)
  // =========================================================================
  const startSession = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/decks/${deckId}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      if (!response.ok) throw new Error('No se pudo iniciar la sesión.');

      const data = await response.json();
      sessionIdRef.current = data.session?.id || null;
    } catch (err) {
      console.error('Error al iniciar sesión de estudio:', err);
      sessionIdRef.current = null;
    }
  };

  // showSummary: true cuando el cierre es explícito (botón "Salir"), para mostrar
  // la pantalla de resumen. En el cleanup silencioso (desmontaje) no aplica.
  const closeSession = async (showSummary = false) => {
    if (!sessionIdRef.current || sessionClosedRef.current) return;
    sessionClosedRef.current = true;

    try {
      // Si vamos a mostrarle un resumen al usuario, primero esperamos a que
      // termine de procesarse cualquier cascada pendiente de este usuario,
      // para que el mastery que vea después en el deck coincida exactamente
      // con lo que ya pasó al momento de cerrar esta sesión.
      if (showSummary) {
        setClosing(true);
        await fetch(`${BACKEND_URL}/api/users/${userId}/queue-status`).catch(
          err => console.error('Error al esperar la cola de cascada:', err)
        );
      }

      const response = await fetch(`${BACKEND_URL}/api/sessions/${sessionIdRef.current}/close`, {
        method: 'PATCH'
      });
      if (response.ok) {
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
    if (!sessionIdRef.current) return;
    fetch(`${BACKEND_URL}/api/sessions/${sessionIdRef.current}/batch-completed`, {
      method: 'PATCH'
    }).catch(err => console.error('Error al actualizar lote de sesión:', err));
  };

  // Único punto que cambia entre modos: la URL de la cola.
  const fetchQueue = async (isRefresh = false) => {
    try {
      if (isRefresh) setLoading(true);
      setError('');

      const response = await fetch(`${BACKEND_URL}${config.queueEndpoint(deckId, userId)}`);
      if (!response.ok) throw new Error('No se pudo estructurar la cola de tarjetas.');

      const data = await response.json();
      if (!data.cards || data.cards.length === 0) {
        throw new Error('Este mazo no tiene tarjetas para repasar.');
      }

      setCards(data.cards);
      setCurrentIndex(0);
      setIsFlipped(false);
      startTimeRef.current = performance.now();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    startSession();
    fetchQueue(true);

    // Al desmontar el componente (ej. navegación sin tocar "Salir"), cerramos
    // la sesión de forma silenciosa, sin mostrar el resumen.
    return () => {
      closeSession(false);
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

  const handleAnswer = async (wasCorrect) => {
    const endTime = performance.now();
    const responseTimeMs = Math.round(endTime - startTimeRef.current);
    const currentCard = cards[currentIndex];

    // 🔥 Disparo Optimista hacia el Ledger y Motor en Cascada (No bloquea la UI)
    fetch(`${BACKEND_URL}/api/decks/${deckId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cardId: currentCard.id || currentCard._id,
        userId,
        wasCorrect,
        responseTimeMs,
        sessionId: sessionIdRef.current
      })
    }).catch(err => console.error("Error síncrono de telemetría:", err));

    // Flujo del bucle (idéntico en ambos modos: agotada la cola, se recarga)
    if (currentIndex < cards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      notifyBatchCompleted();
      await fetchQueue(false);
    }
  };

  const handleExit = () => {
    closeSession(true); // muestra el resumen al salir explícitamente
  };

  // =========================================================================
  // PANTALLA DE CIERRE (mientras se espera el flush de la cascada pendiente)
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
  // PANTALLA DE RESUMEN (se muestra después de cerrar sesión con el botón)
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

  const currentCard = cards[currentIndex];
  const { style: bgStyle, hasBg } = getCardBackgroundStyle(currentCard);

  return (
    <div className="max-w-2xl mx-auto px-2 py-4 animate-[fadeIn_0.15s_ease]">
      {/* Navbar Minimalista Premium de Sesión */}
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

      {/* Contenedor de la tarjeta: flip 3D (continuo) o pregunta+respuesta juntas (estudio) */}
      {config.cardStyle === 'flip' ? (
        <div 
          className="[perspective:1000px] h-72 w-full mb-6 cursor-pointer select-none" 
          onClick={handleFlip}
        >
          <div className={`relative w-full h-full duration-500 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
            
            {/* CARA PREGUNTA — lleva el fondo decorativo (bgImage/bgColor) de la tarjeta */}
            <div
              style={bgStyle}
              className="absolute inset-0 [backface-visibility:hidden] border border-slate-200 rounded-3xl p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all"
            >
              {hasBg && <span className="absolute inset-0 bg-black/55 rounded-3xl" />}
              <span className={`relative z-10 text-[10px] font-bold tracking-widest uppercase ${hasBg ? 'text-white/70' : 'text-amber-500'}`}>Pregunta</span>
              <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 overflow-y-auto">
                <CardFace card={currentCard} side="question" dark={hasBg} onExpandImage={() => setIsZoomed(true)} />
              </div>
              <div className={`relative z-10 text-[10px] font-semibold text-center flex items-center justify-center gap-1.5 uppercase tracking-wider ${hasBg ? 'text-white/60' : 'text-slate-400'}`}>
                <RefreshCw className="w-3 h-3 animate-[spin_4s_linear_infinite]" /> Toca la tarjeta para voltear
              </div>
            </div>

            {/* CARA RESPUESTA — mismo fondo decorativo que la pregunta; fallback oscuro si no hay */}
            <div
              style={hasBg ? bgStyle : undefined}
              className={`absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] text-white rounded-3xl p-6 flex flex-col justify-between shadow-xl border border-slate-800 ${hasBg ? '' : 'bg-slate-950'}`}
            >
              {hasBg && <span className="absolute inset-0 bg-black/55 rounded-3xl" />}
              <span className="relative z-10 text-[10px] font-bold text-indigo-400 tracking-widest uppercase">Respuesta Correcta</span>
              <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 overflow-y-auto">
                <CardFace card={currentCard} side="answer" dark={true} onExpandImage={() => setIsZoomed(true)} />
              </div>
              <div className="relative z-10 text-[10px] font-medium text-center text-slate-500 uppercase tracking-wider">
                Califica tu nivel de retención abajo
              </div>
            </div>

          </div>
        </div>
      ) : (
        // MODO ESTUDIO: pregunta y respuesta visibles juntas, sin flip.
        // Ambos bloques llevan el mismo fondo decorativo de la tarjeta (si tiene).
        <div className="h-72 w-full mb-6 border border-slate-200 rounded-3xl shadow-sm flex flex-col overflow-hidden">
          <div style={bgStyle} className="relative flex-1 flex flex-col items-center justify-center px-6 py-4 border-b border-slate-100 overflow-hidden">
            {hasBg && <span className="absolute inset-0 bg-black/55" />}
            <span className={`relative z-10 text-[10px] font-bold tracking-widest uppercase mb-2 ${hasBg ? 'text-white/70' : 'text-amber-500'}`}>Pregunta</span>
            <div className="relative z-10 flex flex-col items-center overflow-y-auto max-h-full">
              <CardFace card={currentCard} side="question" dark={hasBg} onExpandImage={() => setIsZoomed(true)} />
            </div>
          </div>
          <div
            style={hasBg ? bgStyle : undefined}
            className={`relative flex-1 flex flex-col items-center justify-center px-6 py-4 overflow-hidden ${hasBg ? '' : 'bg-slate-950'}`}
          >
            {hasBg && <span className="absolute inset-0 bg-black/55" />}
            <span className="relative z-10 text-[10px] font-bold text-indigo-400 tracking-widest uppercase mb-2">Respuesta</span>
            <div className="relative z-10 flex flex-col items-center overflow-y-auto max-h-full">
              <CardFace card={currentCard} side="answer" dark={true} onExpandImage={() => setIsZoomed(true)} />
            </div>
          </div>
        </div>
      )}

      {/* Botonera de Feedback */}
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
