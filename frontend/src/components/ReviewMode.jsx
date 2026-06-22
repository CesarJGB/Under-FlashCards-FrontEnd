
import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, RotateCw, BookOpen, Loader2 } from 'lucide-react';

const ALIGN_CLASS = { left: 'text-left', center: 'text-center', right: 'text-right' };

// 🧠 DESEMPAQUETADOR RETROCOMPATIBLE: Parsea la configuración o aplica fallbacks
const parseCardStyles = (fontSizeField) => {
  if (fontSizeField && fontSizeField.startsWith('{')) {
    try {
      const p = JSON.parse(fontSizeField);
      return {
        qSize: p.qSize || 'text-base',
        qBold: p.qBold ?? true,
        qItalic: p.qItalic ?? false,
        qColor: p.qColor || '',
        aSize: p.aSize || 'text-base',
        aBold: p.aBold ?? false,
        aItalic: p.aItalic ?? false,
        aColor: p.aColor || ''
      };
    } catch (e) {}
  }
  // Fallback si la tarjeta fue creada antes de la actualización de estilos divididos
  return {
    qSize: fontSizeField || 'text-base', qBold: true, qItalic: false, qColor: '',
    aSize: fontSizeField || 'text-base', aBold: false, aItalic: false, aColor: ''
  };
};

export default function ReviewMode({ cards, loading }) {
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const touchStartX = useRef(null);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow || 'unset';
    };
  }, []);

  useEffect(() => {
    if (index > cards.length - 1) setIndex(Math.max(0, cards.length - 1));
  }, [cards.length, index]);

  if (loading) {
    return (
      <div className="mt-4 flex items-center gap-2 text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="mt-4 text-center border border-dashed border-slate-300 rounded-2xl py-12 text-slate-400">
        <BookOpen className="w-8 h-8 mx-auto mb-2" />
        No hay tarjetas para repasar en este mazo
      </div>
    );
  }

  const card = cards[index];
  const hasBg = !!card.bgImage;
  const alignClass = ALIGN_CLASS[card.textAlign] || 'text-center';
  
  // 🎴 Extraer la configuración tipográfica de la tarjeta actual
  const st = parseCardStyles(card.fontSize);

  // Seleccionar variables activas según la cara visible (Pregunta vs Respuesta)
  const currentSize = showAnswer ? st.aSize : st.qSize;
  const currentBold = showAnswer ? st.aBold : st.qBold;
  const currentItalic = showAnswer ? st.aItalic : st.qItalic;
  const currentColor = showAnswer ? st.aColor : st.qColor;

  // 🛠️ CONTROL DE TIPOS: Evita inyectar números puros en las clases de Tailwind
  const isNumSize = typeof currentSize === 'number';
  const sizeStyle = isNumSize ? { fontSize: `${currentSize}px` } : {};
  const sizeClass = isNumSize ? '' : currentSize;

  const cardStyle = hasBg
    ? { backgroundImage: `url(${card.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {};
  const progress = ((index + 1) / cards.length) * 100;

  const goPrev = () => {
    setIndex((i) => (i - 1 + cards.length) % cards.length);
    setShowAnswer(false);
  };
  const goNext = () => {
    setIndex((i) => (i + 1) % cards.length);
    setShowAnswer(false);
  };

  const onTouchStart = (e) => {
    touchStartX.current = e.changedTouches[0].clientX;
  };
  const onTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) {
      if (dx < 0) goNext();
      else goPrev();
    }
    touchStartX.current = null;
  };

  return (
    <div className="mt-4 w-full max-w-xl mx-auto px-2">
      <p className="text-center text-xs font-medium text-slate-500">
        Tarjeta {index + 1} de {cards.length}
      </p>

      <div className="relative mt-3 w-full">
        <button onClick={goPrev} className="hidden sm:flex absolute -left-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center rounded-full bg-white border border-slate-200 shadow hover:bg-slate-50 transition-colors">
          <ChevronLeft className="w-5 h-5 text-slate-700" />
        </button>
        <button onClick={goNext} className="hidden sm:flex absolute -right-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center rounded-full bg-white border border-slate-200 shadow hover:bg-slate-50 transition-colors">
          <ChevronRight className="w-5 h-5 text-slate-700" />
        </button>

        <div
          key={index}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          style={cardStyle}
          className="relative w-full rounded-2xl border border-slate-200 shadow-md overflow-hidden bg-white min-h-[290px] sm:min-h-[340px] flex flex-col select-none animate-[slideIn_0.2s_ease-out] touch-pan-x overscroll-none"
        >
          <div className="absolute top-0 inset-x-0 h-1.5 bg-black/10 z-20">
            <div className="h-full bg-slate-900/80 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>

          {hasBg && <span className="absolute inset-0 bg-black/55" />}
          <span className="absolute top-4 left-1/2 -translate-x-1/2 w-10 h-2.5 rounded-full bg-slate-400/40 z-10" />

          <div className="relative z-10 flex-1 flex flex-col justify-center p-6 sm:p-8">
            <p className={`text-[10px] font-semibold uppercase tracking-widest ${alignClass} ${hasBg ? 'text-white/70' : 'text-slate-400'}`}>
              {showAnswer ? 'Respuesta' : 'Pregunta'}
            </p>
            <div key={`${index}-${showAnswer}`} className="mt-2 animate-[fadeIn_0.25s_ease]">
              {/* 🎴 Fusión híbrida perfecta de estilos en línea y clases reactivas */}
              <p 
                style={{
                  ...sizeStyle,
                  ...(currentColor ? { color: currentColor } : {})
                }}
                className={`whitespace-pre-wrap ${alignClass} ${sizeClass} ${currentBold ? 'font-bold' : 'font-normal'} ${currentItalic ? 'italic' : ''} ${hasBg && !currentColor ? 'text-white' : (!currentColor ? 'text-slate-900' : '')}`}
              >
                {showAnswer ? card.answer : card.question}
              </p>
            </div>
          </div>

          <div className="relative z-10 p-5 pt-0">
            <button onClick={() => setShowAnswer((s) => !s)} className={`w-full inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-colors ${hasBg ? 'bg-white/90 text-slate-900 hover:bg-white' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>
              <RotateCw className="w-4 h-4" />
              {showAnswer ? 'Mostrar Pregunta' : 'Voltear tarjeta'}
            </button>
          </div>
        </div>

        <div className="sm:hidden mt-3 flex justify-between px-2">
          <button onClick={goPrev} className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-slate-200 shadow">
            <ChevronLeft className="w-5 h-5 text-slate-700" />
          </button>
          <button onClick={goNext} className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-slate-200 shadow">
            <ChevronRight className="w-5 h-5 text-slate-700" />
          </button>
        </div>
      </div>
    </div>
  );
}
