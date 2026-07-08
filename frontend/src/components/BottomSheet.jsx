import { useState, useEffect, useRef } from 'react';

/**
 * BottomSheet con física fluida interactiva 1:1 vinculada al dedo.
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
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  
  const touchStartY = useRef(null);
  const sheetRef = useRef(null);

  const getDimensions = () => {
    const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    const expandedHeightPx = windowHeight * (expandedHeight / 100);
    const maxTravelDistance = expandedHeightPx - collapsedHeight;
    return { maxTravelDistance };
  };

  useEffect(() => {
    if (lockScroll && isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.overscrollBehavior = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.overscrollBehavior = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.overscrollBehavior = '';
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

  // --- CÁLCULO DE PROGRESO INTERACTIVO EN TIEMPO REAL ---
  // progress = 0 significa totalmente cerrado, progress = 1 significa totalmente abierto
  const currentProgress = maxTravelDistance > 0 
    ? 1 - (currentTranslateY / maxTravelDistance) 
    : 0;

  // Estilos dinámicos para el estado colapsado (¡Bienvenido!)
  const collapsedStyle = isDragging
    ? {
        opacity: Math.max(0, 1 - currentProgress * 2), // Se desvanece rápido en la primera mitad del viaje
        transform: `translateY(${-currentProgress * 15}px)`, // Sube sutilmente con el dedo
      }
    : {};

  // Estilos dinámicos para el estado expandido (Google Login)
  const expandedStyle = isDragging
    ? {
        opacity: Math.max(0, (currentProgress - 0.3) * 1.42), // Empieza a aparecer tras pasar el 30% del viaje
        transform: `translateY(${(1 - currentProgress) * 15}px)`, // Emerge desde abajo con el dedo
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
        // Un bezier ligeramente más elástico para cuando se suelta el dedo
        transition: isDragging ? 'none' : 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.12)',
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

      {/* Área del Contenido Fijo */}
      <div className="px-8 pb-8 h-full overflow-y-auto relative">
        
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
