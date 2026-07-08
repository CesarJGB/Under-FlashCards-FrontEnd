import { useState, useEffect, useRef } from 'react';

/**
 * BottomSheet reutilizable con arrastre progresivo.
 * 
 * @param {boolean} isOpen - Controla si está expandido
 * @param {function} onOpen - Callback al abrir
 * @param {function} onClose - Callback al cerrar
 * @param {ReactNode} collapsedContent - Contenido cuando está colapsado
 * @param {ReactNode} expandedContent - Contenido cuando está expandido
 * @param {number} collapsedHeight - Altura fija del estado colapsado (px)
 * @param {number} expandedHeight - Altura del estado expandido (vh)
 * @param {number} maxHeight - Límite máximo durante el arrastre (% de pantalla)
 * @param {number} openThreshold - Distancia para abrir (px)
 * @param {number} closeThreshold - Distancia para cerrar (px)
 * @param {boolean} lockScroll - Bloquear scroll cuando está abierto
 */
export default function BottomSheet({
  isOpen,
  onOpen,
  onClose,
  collapsedContent,
  expandedContent,
  collapsedHeight = 280,
  expandedHeight = 60,
  maxHeight = 90,
  openThreshold = 50,
  closeThreshold = 100,
  lockScroll = true,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  
  const touchStartY = useRef(null);
  const sheetRef = useRef(null);

  // Bloqueo de scroll cuando está abierto
  useEffect(() => {
    if (lockScroll && isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.overscrollBehavior = 'none';
      document.documentElement.style.overflow = 'hidden';
      document.documentElement.style.overscrollBehavior = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.overscrollBehavior = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.overscrollBehavior = '';
    }
    
    return () => {
      document.body.style.overflow = '';
      document.body.style.overscrollBehavior = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.overscrollBehavior = '';
    };
  }, [isOpen, lockScroll]);

  const onTouchStart = (e) => {
    touchStartY.current = e.changedTouches[0].clientY;
    setIsDragging(true);
  };

  const onTouchMove = (e) => {
    if (touchStartY.current === null) return;
    
    const touchY = e.changedTouches[0].clientY;
    const deltaY = touchY - touchStartY.current;
    
    if ((isOpen && deltaY > 0) || (!isOpen && deltaY < 0)) {
      e.preventDefault();
      
      if (isOpen) {
        const maxDown = window.innerHeight * (expandedHeight / 100);
        setDragOffset(Math.min(deltaY, maxDown));
      } else {
        const maxUp = -(window.innerHeight * (maxHeight / 100));
        setDragOffset(Math.max(deltaY, maxUp));
      }
    }
  };

  const onTouchEnd = (e) => {
    if (touchStartY.current === null) return;
    
    const touchY = e.changedTouches[0].clientY;
    const deltaY = touchY - touchStartY.current;
    
    if (isOpen) {
      if (deltaY > closeThreshold) onClose?.();
    } else {
      if (deltaY < -openThreshold) onOpen?.();
    }
    
    setDragOffset(0);
    setIsDragging(false);
    touchStartY.current = null;
  };

  const getSheetHeight = () => {
    if (isDragging) {
      if (isOpen) {
        const baseHeight = window.innerHeight * (expandedHeight / 100);
        return `${Math.max(baseHeight - dragOffset, collapsedHeight)}px`;
      } else {
        return `${Math.min(collapsedHeight - dragOffset, window.innerHeight * (maxHeight / 100))}px`;
      }
    }
    
    return isOpen ? `${expandedHeight}vh` : `${collapsedHeight}px`;
  };

  const getTransform = () => {
    if (!isDragging) return 'translateY(0)';
    return `translateY(${dragOffset}px)`;
  };

  return (
    <div 
      ref={sheetRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{
        transform: getTransform(),
        transition: isDragging ? 'none' : 'transform 0.3s ease-out, height 0.3s ease-out',
        height: getSheetHeight(),
      }}
      className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[32px] shadow-2xl z-30 touch-pan-y select-none"
    >
      {/* Handle Bar */}
      <div className="flex justify-center pt-4 pb-2">
        <button
          onClick={() => isOpen ? onClose?.() : onOpen?.()}
          className="flex flex-col items-center gap-1 group"
          aria-label={isOpen ? "Cerrar" : "Abrir"}
        >
          <div className={`w-12 h-1.5 bg-gray-300 rounded-full transition-all duration-300 ${isOpen ? 'group-hover:bg-gray-400' : ''}`} />
        </button>
      </div>

      {/* Contenido */}
      <div className="px-8 pb-8">
        {isOpen ? expandedContent : collapsedContent}
      </div>
    </div>
  );
}
