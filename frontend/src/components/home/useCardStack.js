// FILE: frontend/src/components/home/useCardStack.js
import { useRef, useState, useCallback } from 'react';

const LONG_PRESS_MS = 600;
const DRAG_THRESHOLD_PX = 80; // Un poco más generoso para vertical

export default function useCardStack(initialCount) {
  const [order, setOrder] = useState(() => Array.from({ length: initialCount }, (_, i) => i));
  const [isPickedUp, setIsPickedUp] = useState(false);
  const [dragY, setDragY] = useState(0); // Cambiado a dragY

  const pressTimer = useRef(null);
  const startY = useRef(0); // Cambiado a startY
  const dragYRef = useRef(0); // Cambiado a dragYRef
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
    startY.current = e.clientY; // Cambiado a clientY

    pressTimer.current = setTimeout(() => {
      if (!cancelledByMove.current) {
        setIsPickedUp(true);
        isDragging.current = true;
      }
    }, LONG_PRESS_MS);
  }, []);

  const onPointerMove = useCallback((e) => {
    if (isDragging.current) {
      const next = e.clientY - startY.current; // Cambiado a clientY
      dragYRef.current = next;
      setDragY(next); // Cambiado a setDragY
      return;
    }
    // Si se mueve verticalmente antes de completar el hold, se cancela
    if (Math.abs(e.clientY - startY.current) > 10) { // Cambiado a clientY
      cancelledByMove.current = true;
      clearPressTimer();
    }
  }, []);

  const onPointerUp = useCallback(() => {
    clearPressTimer();

    if (isDragging.current) {
      const finalDragY = dragYRef.current;
      // Arrastrar hacia ARRIBA (negativo) = avanzar a siguiente tarjeta
      if (finalDragY <= -DRAG_THRESHOLD_PX) {
        setOrder(prev => [...prev.slice(1), prev[0]]); // avanzar
      } 
      // Arrastrar hacia ABAJO (positivo) = retroceder a tarjeta anterior
      else if (finalDragY >= DRAG_THRESHOLD_PX) {
        setOrder(prev => [prev[prev.length - 1], ...prev.slice(0, -1)]); // retroceder
      }
    }

    isDragging.current = false;
    dragYRef.current = 0;
    setIsPickedUp(false);
    setDragY(0); // Cambiado a setDragY
  }, []);

  return {
    order,
    isPickedUp,
    dragY, // Cambiado a dragY
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp
    }
  };
}
