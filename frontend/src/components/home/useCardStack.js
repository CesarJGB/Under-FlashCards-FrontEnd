// FILE: frontend/src/components/home/useCardStack.js
import { useRef, useState, useCallback } from 'react';

const LONG_PRESS_MS = 600; // tiempo manteniendo presionado antes de poder arrastrar
const DRAG_THRESHOLD_PX = 60; // distancia mínima de arrastre para reordenar

// Hook mínimo para una pila de tarjetas reordenable por gesto:
// - Mantener presionada la tarjeta del frente ~600ms la "levanta" (isPickedUp).
// - Arrastrar hacia la izquierda más allá del umbral: la tarjeta del frente
//   pasa al final (avanza a la siguiente).
// - Arrastrar hacia la derecha más allá del umbral: la última tarjeta pasa
//   al frente (retrocede a la anterior).
// - Soltar antes del hold, o sin arrastre suficiente: no reordena nada.
export default function useCardStack(initialCount) {
  const [order, setOrder] = useState(() => Array.from({ length: initialCount }, (_, i) => i));
  const [isPickedUp, setIsPickedUp] = useState(false);
  const [dragX, setDragX] = useState(0);

  const pressTimer = useRef(null);
  const startX = useRef(0);
  const dragXRef = useRef(0);
  const isDragging = useRef(false);
  const cancelledByMove = useRef(false);

  const clearPressTimer = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const onPointerDown = useCallback((e) => {
    cancelledByMove.current = false;
    isDragging.current = false;
    startX.current = e.clientX;

    pressTimer.current = setTimeout(() => {
      if (!cancelledByMove.current) {
        setIsPickedUp(true);
        isDragging.current = true;
      }
    }, LONG_PRESS_MS);
  }, []);

  const onPointerMove = useCallback((e) => {
    if (isDragging.current) {
      const next = e.clientX - startX.current;
      dragXRef.current = next;
      setDragX(next);
      return;
    }
    // Si se mueve antes de completar el hold, se cancela (era scroll, no long-press)
    if (Math.abs(e.clientX - startX.current) > 10) {
      cancelledByMove.current = true;
      clearPressTimer();
    }
  }, []);

  const onPointerUp = useCallback(() => {
    clearPressTimer();

    if (isDragging.current) {
      const finalDragX = dragXRef.current;
      if (finalDragX <= -DRAG_THRESHOLD_PX) {
        setOrder(prev => [...prev.slice(1), prev[0]]); // avanzar
      } else if (finalDragX >= DRAG_THRESHOLD_PX) {
        setOrder(prev => [prev[prev.length - 1], ...prev.slice(0, -1)]); // retroceder
      }
    }

    isDragging.current = false;
    dragXRef.current = 0;
    setIsPickedUp(false);
    setDragX(0);
  }, []);

  return {
    order,
    isPickedUp,
    dragX,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp
    }
  };
}
