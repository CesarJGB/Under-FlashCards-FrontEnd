import React, { useState, useEffect, useRef } from 'react';
import { RotateCw, CheckCircle, XCircle, ArrowLeft, Loader2, RefreshCw } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export default function ContinuousSessionPlayer({ deckId, userId, onExit }) {
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const startTimeRef = useRef(null);

  const fetchQueue = async (isRefresh = false) => {
    try {
      if (isRefresh) setLoading(true);
      setError('');
      
      const response = await fetch(`${BACKEND_URL}/api/decks/${deckId}/continuous-session?userId=${userId}`);
      if (!response.ok) throw new Error('No se pudo estructurar la cola inteligente.');
      
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
    fetchQueue(true);
  }, [deckId, userId]);

  useEffect(() => {
    if (cards.length > 0 && !loading) {
      startTimeRef.current = performance.now();
      setIsFlipped(false);
    }
  }, [currentIndex, cards, loading]);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
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
        responseTimeMs
      })
    }).catch(err => console.error("Error síncrono de telemetría:", err));

    // Flujo del Bucle Continuo
    if (currentIndex < cards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Fin del lote: recalculamos la cola en caliente con los nuevos pesos del servidor
      await fetchQueue(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-80 animate-[fadeIn_0.1s_ease]">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
        <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Estructurando cola de prioridad matemática...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-100 rounded-2xl text-center max-w-md mx-auto my-12">
        <p className="text-red-800 text-sm font-semibold mb-4">{error}</p>
        <button 
          onClick={onExit}
          className="bg-white border border-red-200 text-red-700 px-4 py-2 rounded-xl text-xs font-bold shadow-xs hover:bg-red-100 transition-colors"
        >
          Regresar al Mazo
        </button>
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  return (
    <div className="max-w-2xl mx-auto px-2 py-4 animate-[fadeIn_0.15s_ease]">
      {/* Navbar Minimalista Premium de Sesión */}
      <div className="flex justify-between items-center mb-6">
        <button 
          onClick={onExit}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors uppercase tracking-wider"
        >
          <ArrowLeft className="w-4 h-4 stroke-[2.5]" /> Salir de la sesión
        </button>
        <span className="text-[10px] bg-slate-900 text-slate-100 px-3 py-1 rounded-full font-extrabold uppercase tracking-widest shadow-xs">
          Bucle Activo: {currentIndex + 1} / {cards.length}
        </span>
      </div>

      {/* Contenedor Efecto 3D Flip Card */}
      <div 
        className="[perspective:1000px] h-72 w-full mb-6 cursor-pointer select-none" 
        onClick={handleFlip}
      >
        <div className={`relative w-full h-full duration-500 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
          
          {/* CARA PREGUNTA */}
          <div className="absolute inset-0 [backface-visibility:hidden] bg-white border border-slate-200 rounded-3xl p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
            <span className="text-[10px] font-bold text-amber-500 tracking-widest uppercase">Pregunta</span>
            <div className="flex-1 flex items-center justify-center px-4">
              <p className="text-xl font-bold text-slate-800 text-center leading-relaxed">
                {currentCard?.question}
              </p>
            </div>
            <div className="text-[10px] font-semibold text-center text-slate-400 flex items-center justify-center gap-1.5 uppercase tracking-wider">
              <RefreshCw className="w-3 h-3 animate-[spin_4s_linear_infinite]" /> Toca la tarjeta para voltear
            </div>
          </div>

          {/* CARA RESPUESTA */}
          <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] bg-slate-950 text-white rounded-3xl p-6 flex flex-col justify-between shadow-xl border border-slate-800">
            <span className="text-[10px] font-bold text-indigo-400 tracking-widest uppercase">Respuesta Correcta</span>
            <div className="flex-1 flex items-center justify-center px-4">
              <p className="text-xl font-bold text-slate-100 text-center leading-relaxed">
                {currentCard?.answer}
              </p>
            </div>
            <div className="text-[10px] font-medium text-center text-slate-500 uppercase tracking-wider">
              Califica tu nivel de retención abajo
            </div>
          </div>

        </div>
      </div>

      {/* Botonera de Feedback Inmediato */}
      <div className="h-16">
        {isFlipped && (
          <div className="grid grid-cols-2 gap-4 animate-[fadeIn_0.12s_ease]">
            <button
              onClick={(e) => { e.stopPropagation(); handleAnswer(false); }}
              className="flex items-center justify-center gap-2 bg-red-50 border border-red-200 text-red-600 rounded-2xl font-bold text-sm hover:bg-red-100/80 transition-all active:scale-[0.97]"
            >
              <XCircle className="w-4 h-4 stroke-[2.5]" /> No la recordé
            </button>
            
            <button
              onClick={(e) => { e.stopPropagation(); handleAnswer(true); }}
              className="flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-2xl font-bold text-sm hover:bg-emerald-700 shadow-sm hover:shadow-md hover:shadow-emerald-900/10 transition-all active:scale-[0.97]"
            >
              <CheckCircle className="w-4 h-4 stroke-[2.5]" /> La dominé
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
