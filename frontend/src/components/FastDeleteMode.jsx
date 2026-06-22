// ARCHIVO: frontend/src/components/FastDeleteMode.jsx
import { useState, useEffect, useRef } from 'react';
import { Trash2, ArrowUp, ArrowDown, X, Layers, Check } from 'lucide-react';

const ALIGN_CLASS = { left: 'text-left', center: 'text-center', right: 'text-right' };

const parseCardStyles = (fontSizeField) => {
  if (fontSizeField && fontSizeField.startsWith('{')) {
    try {
      const p = JSON.parse(fontSizeField);
      return {
        qSize: p.qSize || 'text-base', qBold: p.qBold ?? true, qItalic: p.qItalic ?? false, qColor: p.qColor || '',
        aSize: p.aSize || 'text-base', aBold: p.aBold ?? false, aItalic: p.aItalic ?? false, aColor: p.aColor || ''
      };
    } catch (e) {}
  }
  return { qSize: fontSizeField || 'text-base', qBold: true, qItalic: false, qColor: '', aSize: fontSizeField || 'text-base', aBold: false, aItalic: false, aColor: '' };
};

export default function FastDeleteMode({ cards, onDelete, onClose }) {
  const [index, setIndex] = useState(0);
  // Estados para el control del arrastre visual (Swipe)
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [swipeAction, setSwipeAction] = useState(null); // 'delete' | 'keep' | null
  
  const touchStartY = useRef(null);

  // ⌨️ ATAJOS DE TECLADO: Agiliza el filtrado drásticamente en escritorio
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (index >= cards.length) return;
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        triggerAction('delete');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        triggerAction('keep');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [index, cards]);

  if (cards.length === 0 || index >= cards.length) {
    return (
      <div className="mt-4 text-center border border-dashed border-slate-300 rounded-2xl py-16 bg-white p-6 max-w-xl mx-auto animate-[fadeIn_0.2s_ease]">
        <Layers className="w-10 h-10 mx-auto mb-3 text-slate-400 animate-pulse" />
        <h4 className="font-bold text-slate-800 text-base">¡Filtro Completado!</h4>
        <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">Has revisado todas las tarjetas disponibles en este mazo.</p>
        <button type="button" onClick={onClose} className="mt-5 text-xs font-bold bg-slate-900 text-white px-5 py-2.5 rounded-xl hover:bg-slate-800 transition-colors shadow-xs">
          Volver al Editor
        </button>
      </div>
    );
  }

  const card = cards[index];
  const hasBg = !!card.bgImage;
  const alignClass = ALIGN_CLASS[card.textAlign] || 'text-center';
  const st = parseCardStyles(card.fontSize);

  const finalQStyle = { ...(st.qColor ? { color: st.qColor } : {}), ...(typeof st.qSize === 'number' ? { fontSize: `${st.qSize}px` } : {}) };
  const finalAStyle = { ...(st.aColor ? { color: st.aColor } : {}), ...(typeof st.aSize === 'number' ? { fontSize: `${st.aSize}px` } : {}) };
  const cardStyle = hasBg ? { backgroundImage: `url(${card.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {};

  // 🛠️ ANIMACIÓN E INTERACCIÓN POR BOTÓN O TECLADO
  const triggerAction = async (action) => {
    setSwipeAction(action);
    setTimeout(async () => {
      if (action === 'delete') {
        await onDelete(card);
        // Nota: Al eliminar, el array 'cards' reduce su tamaño, reduciendo el index de forma natural
      } else {
        setIndex((prev) => prev + 1);
      }
      // Reajuste de estados de animación
      setDragY(0);
      setSwipeAction(null);
    }, 200);
  };

  // 📱 MANEJADORES DE GESTOS TÁCTILES (SWIPE VERTICAL)
  const onTouchStart = (e) => {
    touchStartY.current = e.changedTouches[0].clientY;
    setIsDragging(true);
  };

  const onTouchMove = (e) => {
    if (touchStartY.current == null) return;
    const currentY = e.changedTouches[0].clientY;
    const deltaY = currentY - touchStartY.current;
    setDragY(deltaY);
  };

  const onTouchEnd = () => {
    setIsDragging(false);
    if (dragY < -100) {
      triggerAction('delete'); // Swipe Arriba -> Eliminar
    } else if (dragY > 100) {
      triggerAction('keep');   // Swipe Abajo -> Conservar
    } else {
      setDragY(0); // Reset si no cruza el umbral
    }
    touchStartY.current = null;
  };

  // Cálculo de estilos dinámicos de arrastre en tiempo real
  const dynamicCardStyle = {
    ...cardStyle,
    transform: swipeAction === 'delete' 
      ? 'translateY(-150%) scale(0.9) rotate(-5deg)' 
      : swipeAction === 'keep' 
      ? 'translateY(150%) scale(0.9) rotate(5deg)'
      : `translateY(${dragY}px) rotate(${dragY * 0.03}deg)`,
    opacity: swipeAction ? 0 : isDragging ? 0.95 : 1,
    transition: isDragging ? 'none' : 'transform 0.2s ease-out, opacity 0.2s ease'
  };

  return (
    <div className="mt-4 w-full max-w-xl mx-auto px-2 relative animate-[fadeIn_0.15s_ease]">
      {/* Cabecera del sub-modo */}
      <div className="flex items-center justify-between mb-4 bg-slate-100 border border-slate-200/60 rounded-xl px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Borrado Rápido Activo</p>
        </div>
        <button type="button" onClick={onClose} className="text-xs font-semibold text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs transition-colors">
          <X className="w-3.5 h-3.5" /> Salir
        </button>
      </div>

      {/* Indicadores flotantes de acción por Swipe */}
      <div className="absolute inset-x-0 -top-8 flex justify-center pointer-events-none z-30 transition-opacity duration-150">
        {dragY < -30 && (
          <span className="bg-red-500 text-white text-[10px] font-extrabold px-3 py-1 rounded-full shadow-md uppercase tracking-wider animate-bounce inline-flex items-center gap-1">
            <Trash2 className="w-3 h-3" /> Soltar para Eliminar
          </span>
        )}
        {dragY > 30 && (
          <span className="bg-emerald-500 text-white text-[10px] font-extrabold px-3 py-1 rounded-full shadow-md uppercase tracking-wider animate-bounce inline-flex items-center gap-1">
            <Check className="w-3 h-3" /> Soltar para Conservar
          </span>
        )}
      </div>

      {/* Contenedor del mazo interactivo */}
      <div className="relative w-full h-[360px] sm:h-[410px] flex items-center justify-center touch-none">
        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={dynamicCardStyle}
          className="absolute w-full h-full rounded-2xl border border-slate-200 shadow-xl overflow-hidden bg-white flex flex-col justify-between p-6 sm:p-8 select-none cursor-grab active:cursor-grabbing"
        >
          {hasBg && <span className="absolute inset-0 bg-black/55 z-0" />}
          <span className="absolute top-3 left-1/2 -translate-x-1/2 w-9 h-1.5 rounded-full bg-slate-300/50 z-10" />

          <div className="relative z-10 flex-1 flex flex-col justify-center w-full">
            {/* Pregunta */}
            <p className={`text-[9px] font-bold uppercase tracking-wide ${hasBg ? 'text-white/60' : 'text-slate-400'}`}>Pregunta</p>
            <p style={finalQStyle} className={`mt-0.5 whitespace-pre-wrap ${alignClass} ${st.qBold ? 'font-bold' : 'font-normal'} ${st.qItalic ? 'italic' : ''} ${hasBg && !st.qColor ? 'text-white' : 'text-slate-900'}`}>
              {card.question}
            </p>
            
            {/* Separador */}
            <div className={`my-4 border-t border-dashed ${hasBg ? 'border-white/30' : 'border-slate-200'}`} />
            
            {/* Respuesta */}
            <p className={`text-[9px] font-bold uppercase tracking-wide ${hasBg ? 'text-white/60' : 'text-slate-400'}`}>Respuesta</p>
            <p style={finalAStyle} className={`mt-0.5 whitespace-pre-wrap ${alignClass} ${st.aBold ? 'font-bold' : 'font-normal'} ${st.aItalic ? 'italic' : ''} ${hasBg && !st.aColor ? 'text-white/95' : 'text-slate-700'}`}>
              {card.answer}
            </p>

            {/* Render miniaturizado si la tarjeta incluye imagen médica/contenido */}
            {card.contentImage && (
              <div className="mt-3 flex justify-center">
                <img src={card.contentImage} alt="Adjunto" className="max-h-16 w-auto object-contain rounded-lg border border-slate-200/50 p-0.5 bg-slate-50/40" />
              </div>
            )}
          </div>

          <div className="relative z-10 text-center text-[10px] font-medium text-slate-400">
            Tarjeta {index + 1} de {cards.length}
          </div>
        </div>
      </div>

      {/* 🎮 PANEL DE MANDOS DE ESCRITORIO / ACCESOS DIRECTOS */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => triggerAction('delete')}
          className="flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50/40 hover:bg-red-50 text-red-600 font-bold py-3 text-xs transition-all shadow-2xs active:scale-95 cursor-pointer"
        >
          <Trash2 className="w-4 h-4 shrink-0" />
          <span>Eliminar tarjeta</span>
          <span className="hidden sm:inline bg-red-100 text-red-700 text-[9px] px-1.5 py-0.5 rounded-md border border-red-200 ml-1 font-mono"><ArrowUp className="w-2 h-2 inline" /> UP</span>
        </button>

        <button
          type="button"
          onClick={() => triggerAction('keep')}
          className="flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold py-3 text-xs transition-all shadow-2xs active:scale-95 cursor-pointer"
        >
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Conservar tarjeta</span>
          <span className="hidden sm:inline bg-slate-100 text-slate-600 text-[9px] px-1.5 py-0.5 rounded-md border border-slate-200 ml-1 font-mono"><ArrowDown className="w-2 h-2 inline" /> DOWN</span>
        </button>
      </div>
    </div>
  );
}
