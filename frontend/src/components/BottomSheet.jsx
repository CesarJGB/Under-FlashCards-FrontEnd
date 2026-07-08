import { useState, useEffect, useRef } from 'react';
import { lockBodyScroll, unlockBodyScroll } from '../lib/scrollLock';

/**
 * BottomSheet con física interactiva fluida y renderizado libre de artefactos.
 */
export default function BottomSheet({
  isOpen,
  onOpen,
  onClose,
  collapsedContent,
  expandedContent,
  collapsedHeight = 280,
  expandedHeight = 62,
  openThreshold = 60,
  closeThreshold = 80,
  lockScroll = true,
}) {
  const [windowHeight, setWindowHeight] = useState(
    typeof window !== 'undefined' ? window.innerHeight : 800
  );
  const focusTimeoutRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  
  const touchStartY = useRef(null);
  const sheetRef = useRef(null);

  useEffect(() => {
    const handleRecalculate = () => {
      setWindowHeight(window.innerHeight);
    };

    const handleFocus = () => {
      if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
      focusTimeoutRef.current = setTimeout(() => {
        setWindowHeight(window.innerHeight);
        focusTimeoutRef.current = null;
      }, 120);
    };

    window.addEventListener('resize', handleRecalculate);
    window.addEventListener('orientationchange', handleRecalculate);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('resize', handleRecalculate);
      window.removeEventListener('orientationchange', handleRecalculate);
      window.removeEventListener('focus', handleFocus);
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
        focusTimeoutRef.current = null;
      }
    };
  }, []);

  const getDimensions = () => {
    const expandedHeightPx = windowHeight * (expandedHeight / 100);
    const maxTravelDistance = expandedHeightPx - collapsedHeight;
    return { maxTravelDistance };
  };

  // Mantuvimos el sistema de bloqueo avanzado del agente
  const ownerRef = useRef(`bottomsheet_${Math.random().toString(36).slice(2,9)}`);

  useEffect(() => {
    if (!lockScroll) return;

    if (isOpen) {
      lockBodyScroll(ownerRef.current);
    } else {
      unlockBodyScroll(ownerRef.current);
    }

    return () => {
      if (lockScroll) unlockBodyScroll(ownerRef.current);
    };
  }, [isOpen, lockScroll]);

  const onTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const onTouchMove = (e) => {
    if (touchStartY.current === null) return;
    
    const touchY = e.touches[0].clientY;
    const deltaY = touchY - touchStartY.current;
    
    if (!isDragging && Math.abs(deltaY) > 10) {
      setIsDragging(true);
    }

    if (isDragging) {
      if (e.cancelable) e.preventDefault();
      
      const { maxTravelDistance } = getDimensions();
      let clampedDelta = deltaY;
      
      if (isOpen) {
        clampedDelta = Math.max(0, Math.min(maxTravelDistance, deltaY));
      } else {
        clampedDelta = Math.min(0, Math.max(-maxTravelDistance, deltaY));
      }
      
      setDragOffset(clampedDelta);
    }
  };

  const onTouchEnd = () => {
    if (touchStartY.current === null) return;
    
    if (isDragging) {
      if (isOpen && dragOffset > closeThreshold) {
        onClose?.();
      } else if (!isOpen && dragOffset < -openThreshold) {
        onOpen?.();
      }
    }
    
    setDragOffset(0);
    setIsDragging(false);
    touchStartY.current = null;
  };

  const { maxTravelDistance } = getDimensions();
  const baseTranslateY = isOpen ? 0 : maxTravelDistance;
  const currentTranslateY = isDragging ? baseTranslateY + dragOffset : baseTranslateY;

  const currentProgress = maxTravelDistance > 0 
    ? 1 - (currentTranslateY / maxTravelDistance) 
    : 0;

  // CORRECCIÓN RADICAL: 
  // Si el dedo no está en la pantalla (!isDragging), vaciamos los estilos en línea por completo ({}).
  // Esto elimina el error de la pantalla blanca porque Tailwind retoma el control absoluto sin conflictos.
  // También eliminamos los transforms internos para evitar la colisión de los puntos y las letras.
  const collapsedStyle = isDragging
    ? { opacity: Math.max(0, 1 - currentProgress * 2) }
    : {};

  const expandedStyle = isDragging
    ? { opacity: Math.max(0, (currentProgress - 0.3) * 1.42) }
    : {};

  return (
    <div 
      ref={sheetRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{
        transform: `translateY(${currentTranslateY}px)`,
        transition: isDragging ? 'none' : 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
        height: `${expandedHeight}dvh`,
      }}
      className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[32px] shadow-2xl z-30 select-none will-change-transform"
    >
      <div className="flex justify-center pt-4 pb-4 cursor-grab active:cursor-grabbing">
        <div 
          onClick={() => isOpen ? onClose?.() : onOpen?.()}
          className="w-12 h-1.5 bg-gray-300 rounded-full hover:bg-gray-400 transition-colors"
          style={{ cursor: 'pointer' }}
        />
      </div>

      <div className="px-8 pb-8 h-full relative overflow-hidden">
        
        {/* Estado Colapsado (¡Bienvenido!) */}
        <div
          style={collapsedStyle}
          className={`w-full absolute left-0 right-0 px-8 transition-opacity duration-300 ease-out ${
            isDragging
              ? '' // Sin clases de Tailwind mientras arrastras
              : isOpen 
                ? 'opacity-0 pointer-events-none' // Se apaga limpiamente con CSS nativo
                : 'opacity-100 pointer-events-auto'
          }`}
        >
          {collapsedContent}
        </div>

        {/* Estado Expandido (Google Login) */}
        <div
          style={expandedStyle}
          className={`w-full absolute left-0 right-0 px-8 transition-opacity duration-300 ease-out ${
            isDragging
              ? '' // Sin clases de Tailwind mientras arrastras
              : isOpen 
                ? 'opacity-100 pointer-events-auto'
                : 'opacity-0 pointer-events-none'
          }`}
        >
          {expandedContent}
        </div>

      </div>
    </div>
  );
}
