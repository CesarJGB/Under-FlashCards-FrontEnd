// ARCHIVO: frontend/src/components/ReviewMode.jsx
import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, RotateCw, BookOpen, Loader2, Maximize2, X } from 'lucide-react';

const ALIGN_CLASS = { left: 'text-left', center: 'text-center', right: 'text-right' };

// 🧠 DESEMPAQUETADOR RETROCOMPATIBLE: Parsea la configuración incluyendo el color de fondo sólido
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
        aColor: p.aColor || '',
        bgColor: p.bgColor || '' // 🚀 Extraído con éxito del string JSON
      };
    } catch (e) {}
  }
  return {
    qSize: fontSizeField || 'text-base', qBold: true, qItalic: false, qColor: '',
    aSize: fontSizeField || 'text-base', aBold: false, aItalic: false, aColor: '',
    bgColor: ''
  };
};

export default function ReviewMode({ cards, loading }) {
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
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
  
  const st = parseCardStyles(card.fontSize);

  const currentSize = showAnswer ? st.aSize : st.qSize;
  const currentBold = showAnswer ? st.aBold : st.qBold;
  const currentItalic = showAnswer ? st.aItalic : st.qItalic;
  const currentColor = showAnswer ? st.aColor : st.qColor;

  const isNumSize = typeof currentSize === 'number';
  const sizeStyle = isNumSize ? { fontSize: `${currentSize}px` } : {};
  const sizeClass = isNumSize ? '' : currentSize;

  // 🚀 ACTUALIZADO: cardStyle ahora fusiona el color sólido con el fallback blanco y la imagen si existiera
  const cardStyle = {
    backgroundColor: st.bgColor || '#ffffff',
    ...(hasBg ? { backgroundImage: `url(${card.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {})
  };
  
  const progress = ((index + 1) / cards.length) * 100;

  const goPrev = () => {
    setIndex((i) => (i - 1 + cards.length) % cards.length);
    setShowAnswer(false);
    setIsZoomed(false);
  };
  const goNext = () => {
    setIndex((i) => (i + 1) % cards.length);
    setShowAnswer(false);
    setIsZoomed(false);
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
    <div className="mt-4 w-full max-w-xl mx-auto px-2 pb-6">
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
          className="relative w-full rounded-2xl border border-slate-200 shadow-md overflow-hidden min-h-[290px] sm:min-h-[340px] flex flex-col select-none animate-[slideIn_0.2s_ease-out] touch-pan-x overscroll-none"
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
            
            <div key={`${index}-${showAnswer}`} className="mt-2 flex flex-col flex-1 justify-center animate-[fadeIn_0.25s_ease]">
              <p 
                style={{
                  ...sizeStyle,
                  ...(currentColor ? { color: currentColor } : {})
                }}
                className={`whitespace-pre-wrap ${alignClass} ${sizeClass} ${currentBold ? 'font-bold' : 'font-normal'} ${currentItalic ? 'italic' : ''} ${hasBg && !currentColor ? 'text-white' : (!currentColor ? 'text-slate-900' : '')}`}
              >
                {showAnswer ? card.answer : card.question}
              </p>

              {card.contentImage && card.imageSide === (showAnswer ? 'answer' : 'question') && (
                <div className="mt-4 flex justify-center w-full animate-[slideUp_0.18s_ease-out]">
                  <div className="relative max-w-max group">
                    <img 
                      src={card.contentImage} 
                      alt="Imagen de estudio" 
                      className={`max-h-36 sm:max-h-44 w-auto object-contain rounded-xl border p-1 shadow-2xs ${
                        hasBg ? 'bg-white/10 border-white/20' : 'bg-slate-50 border-slate-200/60'
                      }`}
                    />
                    
                    <button
                      type="button"
                      onClick={() => setIsZoomed(true)}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-950/70 hover:bg-slate-950 text-white shadow-md backdrop-blur-xs transition-all opacity-90 sm:opacity-0 sm:group-hover:opacity-100 active:scale-95 flex items-center justify-center border border-white/10 cursor-pointer"
                      title="Ver en pantalla completa"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
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

      {isZoomed && card.contentImage && (
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
              src={card.contentImage} 
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
