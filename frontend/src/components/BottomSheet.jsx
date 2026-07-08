import { useState, useEffect, useRef } from 'react';
import { lockBodyScroll, unlockBodyScroll } from '../lib/scrollLock';

/**
 * BottomSheet con física fluida interactiva 1:1 y scroll interno totalmente deshabilitado.
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
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  
  const touchStartY = useRef(null);
  const sheetRef = useRef(null);

  useEffect(() => {
    const handleRecalculate = () => {
      setWindowHeight(window.innerHeight);
    };

    window.addEventListener('resize', handleRecalculate);
    window.addEventListener('orientationchange', handleRecalculate);
    window.addEventListener('focus', handleRecalculate);

    return () => {
      window.removeEventListener('resize', handleRecalculate);
      window.removeEventListener('orientationchange', handleRecalculate);
      window.removeEventListener('focus', handleRecalculate);
    };
  }, []);

  const getDimensions = () => {
    const expandedHeightPx = windowHeight * (expandedHeight / 100);
    const maxTravelDistance = expandedHeightPx - collapsedHeight;
    return { maxTravelDistance };
  };

  // Manage body scroll using the shared lock utility. Each BottomSheet instance
  // receives a unique owner id so multiple components can request the lock
  // without stomping on each other.
  const ownerRef = useRef(`bottomsheet_${Math.random().toString(36).slice(2,9)}`);

  useEffect(() => {
    if (!lockScroll) return;

    if (isOpen) {
      lockBodyScroll(ownerRef.current);
    } else {
      unlockBodyScroll(ownerRef.current);
    }

    return () => {
      // ensure we release our owner lock on unmount
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

  const collapsedStyle = isDragging
    ? {
        opacity: Math.max(0, 1 - currentProgress * 2),
        transform: `translateY(${-currentProgress * 15}px)`,
      }
    : {};

  const expandedStyle = isDragging
    ? {
        opacity: Math.max(0, (currentProgress - 0.3) * 1.42),
        transform: `translateY(${(1 - currentProgress) * 15}px)`,
      }
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
      {/* Barra superior de arrastre */}
      <div className="flex justify-center pt-4 pb-4 cursor-grab active:cursor-grabbing">
        <div 
          onClick={() => isOpen ? onClose?.() : onOpen?.()}
          className="w-12 h-1.5 bg-gray-300 rounded-full hover:bg-gray-400 transition-colors"
          style={{ cursor: 'pointer' }}
        />
      </div>

      {/* CAMBIO RADICAL: Eliminamos cualquier lógica auto y lo bloqueamos en overflow-hidden permanente */}
      <div className="px-8 pb-8 h-full relative overflow-hidden">
        
        {/* Estado Colapsado (¡Bienvenido!) */}
        <div 
          style={collapsedStyle}
          className={`w-full absolute left-0 right-0 px-8 ${
            isDragging 
              ? '' 
              : `transition-all duration-300 ease-out ${isOpen ? 'opacity-0 -translate-y-2 pointer-events-none' : 'opacity-100 translate-y-0 pointer-events-auto'}`
          }`}
        >
          {collapsedContent}
        </div>

        {/* Estado Expandido (Google Login) */}
        <div 
          style={expandedStyle}
          className={`w-full absolute left-0 right-0 px-8 ${
            isDragging 
              ? '' 
              : `transition-all duration-300 ease-out ${isOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'}`
          }`}
        >
          {expandedContent}
        </div>

      </div>
    </div>
  );
}
