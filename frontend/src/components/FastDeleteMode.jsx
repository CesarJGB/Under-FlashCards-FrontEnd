// FILE: frontend/src/components/FastDeleteMode.jsx

import { useState, useEffect, useRef } from 'react';
import { Trash2, ArrowUp, ArrowDown, ArrowLeft, Layers, Check } from 'lucide-react';

// Importamos la función de parseo unificada y centralizada
import { parseCardStyles } from '../lib/utils';
import useImmersiveScrollGuard from '../hooks/useImmersiveScrollGuard';

const ALIGN_CLASS = { left: 'text-left', center: 'text-center', right: 'text-right' };

export default function FastDeleteMode({ cards, onDelete, onClose }) {
  const [index, setIndex] = useState(0);
  // Estados para el control del arrastre visual (Swipe)
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [swipeAction, setSwipeAction] = useState(null); // 'delete' | 'keep' | null
  const [showSwipeHint, setShowSwipeHint] = useState(true);
  
  const touchStartY = useRef(null);
  const dragYRef = useRef(0);
  const cardRef = useRef(null); // Ref para interceptar y anular el scroll nativo móvil
  const actionTimeoutRef = useRef(null);
  const actionLockRef = useRef(false);
  const isMountedRef = useRef(true);

  useImmersiveScrollGuard(true, 'FastDeleteMode');

  // La ayuda aparece solamente al entrar al modo y desaparece al poco tiempo.
  // También se cierra en cuanto el usuario empieza a interactuar.
  useEffect(() => {
    isMountedRef.current = true;
    const hintTimeout = window.setTimeout(() => setShowSwipeHint(false), 4200);

    return () => {
      window.clearTimeout(hintTimeout);
      isMountedRef.current = false;
      if (actionTimeoutRef.current) window.clearTimeout(actionTimeoutRef.current);
    };
  }, []);

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

  // 📱 PREVENCIÓN DE SCROLL PARÁSITO: Bloquea el rebote elástico del móvil mientras se arrastra la tarjeta
  useEffect(() => {
    const handleTouchMove = (e) => {
      if (touchStartY.current !== null) {
        e.preventDefault();
      }
    };

    const element = cardRef.current;
    if (element) {
      element.addEventListener('touchmove', handleTouchMove, { passive: false });
    }

    return () => {
      if (element) {
        element.removeEventListener('touchmove', handleTouchMove);
      }
    };
  }, []);

  if (cards.length === 0 || index >= cards.length) {
    return (
      <div className="mx-auto mt-4 max-w-xl rounded-2xl border border-dashed border-slate-300 bg-white p-6 py-16 text-center animate-[fadeIn_0.2s_ease] dark:border-slate-700 dark:bg-slate-900">
        <Layers className="w-10 h-10 mx-auto mb-3 text-slate-400 animate-pulse" />
        <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">¡Filtro completado!</h4>
        <p className="mx-auto mt-1 max-w-xs text-xs text-slate-500 dark:text-slate-400">Has revisado todas las tarjetas disponibles en este mazo.</p>
        <button type="button" onClick={onClose} className="mt-5 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100">
          Volver al Editor
        </button>
      </div>
    );
  }

  const card = cards[index];
  const hasBg = !!card.bgImage;
  const alignClass = ALIGN_CLASS[card.textAlign] || 'text-center';
  
  // El parseador local redundante fue removido con éxito.
  // Ahora consumimos la lógica compartida globalmente.
  const st = parseCardStyles(card.fontSize);

  const finalQStyle = { ...(st.qColor ? { color: st.qColor } : {}), ...(typeof st.qSize === 'number' ? { fontSize: `${st.qSize}px` } : {}) };
  const finalAStyle = { ...(st.aColor ? { color: st.aColor } : {}), ...(typeof st.aSize === 'number' ? { fontSize: `${st.aSize}px` } : {}) };
  
  // 🚀 Integración del color de fondo sólido unificado junto a la imagen
  const cardStyle = {
    backgroundColor: st.bgColor || '#ffffff',
    ...(hasBg ? { backgroundImage: `url(${card.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {})
  };

  const resetDrag = () => {
    dragYRef.current = 0;
    setDragY(0);
  };

  // 🛠️ ANIMACIÓN E INTERACCIÓN POR BOTÓN O TECLADO
  // El bloqueo evita dobles pulsaciones y carreras entre el gesto, el teclado
  // y los botones mientras termina la animación de la tarjeta.
  const triggerAction = (action) => {
    if (actionLockRef.current || index >= cards.length) return;

    actionLockRef.current = true;
    setShowSwipeHint(false);
    setSwipeAction(action);
    actionTimeoutRef.current = window.setTimeout(async () => {
      try {
        if (action === 'delete') {
          await onDelete(card);
        } else if (isMountedRef.current) {
          setIndex((prev) => prev + 1);
        }
      } finally {
        actionTimeoutRef.current = null;
        actionLockRef.current = false;
        if (isMountedRef.current) {
          resetDrag();
          setSwipeAction(null);
        }
      }
    }, 220);
  };

  // 📱 MANEJADORES DE GESTOS TÁCTILES (SWIPE VERTICAL)
  const onTouchStart = (e) => {
    if (actionLockRef.current) return;
    touchStartY.current = e.changedTouches[0].clientY;
    dragYRef.current = 0;
    setShowSwipeHint(false);
    setIsDragging(true);
  };

  const onTouchMove = (e) => {
    if (touchStartY.current == null) return;
    const currentY = e.changedTouches[0].clientY;
    const deltaY = currentY - touchStartY.current;
    dragYRef.current = deltaY;
    setDragY(deltaY);
  };

  const onTouchEnd = () => {
    if (touchStartY.current == null) return;
    const finalDragY = dragYRef.current;
    touchStartY.current = null;
    setIsDragging(false);
    if (finalDragY < -100) {
      triggerAction('delete'); // Swipe Arriba -> Eliminar
    } else if (finalDragY > 100) {
      triggerAction('keep');   // Swipe Abajo -> Conservar
    } else {
      resetDrag(); // Reset si no cruza el umbral
    }
  };

  const onTouchCancel = () => {
    touchStartY.current = null;
    setIsDragging(false);
    resetDrag();
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
    <div className="relative mx-auto mt-2 w-full max-w-xl animate-[fadeIn_0.15s_ease]">
      {/* Encabezado contextual del modo; el DeckHeader global permanece oculto. */}
      <header className="mb-2 flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-extrabold text-slate-800 dark:text-slate-100">Modo borrado rápido</p>
            <p className="truncate text-[10px] font-medium text-slate-500 dark:text-slate-400">Clasifica deslizando la tarjeta</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Volver al modo edición"
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-[10px] font-bold text-slate-600 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Volver al editor</span>
        </button>
      </header>

      {/* El escenario reserva una zona real para la ayuda y separa las dos
          direcciones del gesto: borrar arriba, conservar abajo. */}
      <div className="relative px-2 pb-10">
        <div className="flex min-h-12 items-center justify-center">
          {showSwipeHint && (
            <div
              role="status"
              className="flex w-full max-w-sm items-center justify-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/95 px-3 py-2 text-center text-[11px] font-semibold leading-tight text-indigo-700 shadow-sm dark:border-indigo-400/20 dark:bg-indigo-500/10 dark:text-indigo-200"
            >
              <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Desliza arriba para borrar <span className="px-0.5 text-indigo-300 dark:text-indigo-400">·</span> abajo para conservar</span>
              <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            </div>
          )}
        </div>

        {/* Indicadores de gesto: borrar arriba, conservar abajo. */}
        {dragY < -30 && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center">
            <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-red-700 shadow-sm animate-bounce dark:border-red-400/30 dark:bg-red-500/15 dark:text-red-200">
              <ArrowUp className="h-3 w-3" aria-hidden="true" /> Soltar para eliminar
            </span>
          </div>
        )}
        {dragY > 30 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 shadow-sm animate-bounce dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-200">
              <ArrowDown className="h-3 w-3" aria-hidden="true" /> Soltar para conservar
            </span>
          </div>
        )}

        {/* Contenedor del mazo interactivo */}
        <div className="relative flex h-[360px] w-full items-center justify-center touch-none sm:h-[410px]">
        <div
          ref={cardRef}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchCancel}
          style={{ ...dynamicCardStyle, willChange: 'transform' }}
          className="absolute flex h-full w-full select-none flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 p-6 shadow-xl cursor-grab active:cursor-grabbing dark:border-slate-700 sm:p-8"
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
      </div>

      {/* 🎮 Controles alternativos: siguen disponibles para quien no use el gesto. */}
      <div className="grid grid-cols-2 gap-3 px-2">
        <button
          type="button"
          disabled={Boolean(swipeAction)}
          onClick={() => triggerAction('delete')}
          className="flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50/40 py-3 text-xs font-bold text-red-600 shadow-2xs transition-all hover:bg-red-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-row dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/15"
        >
          <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Eliminar tarjeta</span>
          <span className="hidden rounded-md border border-red-200 bg-red-100 px-1.5 py-0.5 text-[9px] font-mono text-red-700 sm:inline dark:border-red-400/30 dark:bg-red-500/15 dark:text-red-200"><ArrowUp className="inline h-2 w-2" /> UP</span>
        </button>

        <button
          type="button"
          disabled={Boolean(swipeAction)}
          onClick={() => triggerAction('keep')}
          className="flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-3 text-xs font-bold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-row dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <span>Conservar tarjeta</span>
          <span className="hidden rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[9px] font-mono text-slate-600 sm:inline dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"><ArrowDown className="inline h-2 w-2" /> DOWN</span>
        </button>
      </div>
    </div>
  );
}
