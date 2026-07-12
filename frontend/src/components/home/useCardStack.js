// FILE: frontend/src/components/home/useCardStack.js
import { useRef, useState, useCallback, useEffect } from 'react';

const LONG_PRESS_MS = 600;
const DRAG_THRESHOLD_PX = 80;

export default function useCardStack(initialCount, order, onReorder) {
  const [isPickedUp, setIsPickedUp] = useState(false);
  const [dragY, setDragY] = useState(0);

  const pressTimer = useRef(null);
  const startY = useRef(0);
  const dragYRef = useRef(0);
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
    startY.current = e.clientY;

    pressTimer.current = setTimeout(() => {
      if (!cancelledByMove.current) {
        setIsPickedUp(true);
        isDragging.current = true;
      }
    }, LONG_PRESS_MS);
  }, []);

  const onPointerMove = useCallback((e) => {
    if (isDragging.current) {
      const next = e.clientY - startY.current;
      dragYRef.current = next;
      setDragY(next);
      return;
    }
    if (Math.abs(e.clientY - startY.current) > 10) {
      cancelledByMove.current = true;
      clearPressTimer();
    }
  }, []);

  const onPointerUp = useCallback(() => {
    clearPressTimer();

    if (isDragging.current) {
      const finalDragY = dragYRef.current;
      if (finalDragY <= -DRAG_THRESHOLD_PX) {
        // Avanzar: mover primero al final
        const newOrder = [...order.slice(1), order[0]];
        onReorder(newOrder);
      } else if (finalDragY >= DRAG_THRESHOLD_PX) {
        // Retroceder: mover último al principio
        const newOrder = [order[order.length - 1], ...order.slice(0, -1)];
        onReorder(newOrder);
      }
    }

    isDragging.current = false;
    dragYRef.current = 0;
    setIsPickedUp(false);
    setDragY(0);
  }, [order, onReorder]);

  return {
    order,
    isPickedUp,
    dragY,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp
    }
  };
}
