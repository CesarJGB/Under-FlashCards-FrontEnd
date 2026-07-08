import { useState, useEffect, useRef } from 'react';

/**
 * BottomSheet con tope magnético y límites físicos absolutos.
 */
export default function BottomSheet({
  isOpen,
  onOpen,
  onClose,
  collapsedContent,
  expandedContent,
  collapsedHeight = 280,
  expandedHeight = 85, // Ajustado a 85vh por defecto para cubrir bien la pantalla de login
  openThreshold = 60,
  closeThreshold = 80,
  lockScroll = true,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  
  const touchStartY = useRef(null);
  const sheetRef = useRef(null);

  // Auxiliar para calcular las distancias en píxeles en tiempo real
  const getDimensions = () => {
    const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    const expandedHeightPx = windowHeight * (expandedHeight / 100);
    // La distancia máxima que el panel se puede mover entre abierto y cerrado
    const maxTravelDistance = expandedHeightPx - collapsedHeight;
    return { maxTravelDistance };
  };

  // Bloqueo de scroll del fondo
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
    
    // Filtro de tolerancia para proteger los clicks en el botón de Google
    if (!isDragging && Math.abs(deltaY) > 10) {
      setIsDragging(true);
    }

    if (isDragging) {
      if (e.cancelable) e.preventDefault();
      
      const { maxTravelDistance } = getDimensions();
      let clampedDelta = deltaY;
      
      if (isOpen) {
        // ESTADO ABIERTO: Solo permitimos deslizar hacia abajo (valores positivos)
        // El límite máximo de bajada es la distancia de viaje (maxTravelDistance)
        clampedDelta = Math.max(0, Math.min(maxTravelDistance, deltaY));
      } else {
        // ESTADO CERRADO: Solo permitimos deslizar hacia arriba (valores negativos)
        // SOLUCIÓN AL INFINITO: Ponemos un freno absoluto para que no suba más allá del tope máximo
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

  // --- CÁLCULO DE POSICIONES ABSOLUTAS ---
  const { maxTravelDistance } = getDimensions();
  
  // Posición base inicial en pixeles dependiendo de si está abierto (0) o cerrado (abajo)
  const baseTranslateY = isOpen ? 0 : maxTravelDistance;
  
  // Posición final combinando el estado estático + el arrastre del dedo
  const currentTranslateY = isDragging ? baseTranslateY + dragOffset : baseTranslateY;

  return (
    <div 
      ref={sheetRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{
        transform: `translateY(${currentTranslateY}px)`,
        transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.1)', // Efecto magnético sutil
        height: `${expandedHeight}vh`,
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

      {/* Área del Contenido */}
      <div className="px-8 pb-8 h-full overflow-y-auto">
        {isOpen ? expandedContent : collapsedContent}
      </div>
    </div>
  );
}
