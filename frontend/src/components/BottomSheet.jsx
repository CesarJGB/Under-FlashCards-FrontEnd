import { useState, useEffect, useRef } from 'react';

/**
 * BottomSheet reutilizable con rendimiento optimizado por hardware (GPU).
 */
export default function BottomSheet({
  isOpen,
  onOpen,
  onClose,
  collapsedContent,
  expandedContent,
  collapsedHeight = 280,
  expandedHeight = 60,
  openThreshold = 60,
  closeThreshold = 80,
  lockScroll = true,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  
  const touchStartY = useRef(null);
  const sheetRef = useRef(null);

  // Bloqueo de scroll nativo de la pantalla de fondo
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
    // Guardamos la posición inicial del toque sin activar el estado de arrastre aún
    touchStartY.current = e.touches[0].clientY;
  };

  const onTouchMove = (e) => {
    if (touchStartY.current === null) return;
    
    const touchY = e.touches[0].clientY;
    const deltaY = touchY - touchStartY.current;
    
    // SOLUCIÓN AL TAP: Solo activamos el arrastre si el dedo se movió más de 10px
    // Esto evita que un simple toque con el pulgar "tiemble" y rompa el botón de Google
    if (!isDragging && Math.abs(deltaY) > 10) {
      setIsDragging(true);
    }

    if (isDragging) {
      // Evita el scroll por defecto del navegador mientras arrastramos el panel
      if (e.cancelable) e.preventDefault();
      
      let clampedDelta = deltaY;
      
      if (isOpen) {
        // Si está abierto, solo permitimos deslizar hacia abajo (valores positivos)
        // Evitamos que suba y salga de la pantalla (valores negativos se clavan en 0)
        clampedDelta = Math.max(0, deltaY);
      } else {
        // Si está cerrado/colapsado, solo permitimos deslizar hacia arriba (valores negativos)
        // Evitamos que baje más allá de su base fija (valores positivos se clavan en 0)
        clampedDelta = Math.min(0, deltaY);
      }
      
      setDragOffset(clampedDelta);
    }
  };

  const onTouchEnd = () => {
    if (touchStartY.current === null) return;
    
    // Solo disparamos cambios de estado si el usuario realmente arrastró el panel
    if (isDragging) {
      if (isOpen && dragOffset > closeThreshold) {
        onClose?.();
      } else if (!isOpen && dragOffset < -openThreshold) {
        onOpen?.();
      }
    }
    
    // Reseteamos todas las variables de control de forma limpia
    setDragOffset(0);
    setIsDragging(false);
    touchStartY.current = null;
  };

  // La altura es estrictamente fija durante el ciclo de renderizado para evitar Reflows pesados
  const sheetHeight = isOpen ? `${expandedHeight}vh` : `${collapsedHeight}px`;

  // Toda la animación física del arrastre se delega al transform
  const transformStyle = isDragging ? `translateY(${dragOffset}px)` : 'translateY(0)';

  return (
    <div 
      ref={sheetRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{
        transform: transformStyle,
        transition: isDragging ? 'none' : 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        height: sheetHeight,
      }}
      className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[32px] shadow-2xl z-30 select-none will-change-transform"
    >
      {/* Área del Control / Handle Bar */}
      <div className="flex justify-center pt-4 pb-4 cursor-grab active:cursor-grabbing">
        <div 
          onClick={() => isOpen ? onClose?.() : onOpen?.()}
          className="w-12 h-1.5 bg-gray-300 rounded-full hover:bg-gray-400 transition-colors duration-200"
          style={{ cursor: 'pointer' }}
        />
      </div>

      {/* Contenedor de contenido */}
      <div className="px-8 pb-8 h-full overflow-y-auto">
        {isOpen ? expandedContent : collapsedContent}
      </div>
    </div>
  );
}
