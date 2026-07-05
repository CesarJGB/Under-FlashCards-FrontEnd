import { useState, useEffect, useCallback } from 'react';

/**
 * Hook para detectar altura del teclado en dispositivos móviles
 * Funciona en iOS (Safari) y Android (Chrome)
 * 
 * @returns {number} Altura del teclado en píxeles, o 0 si no hay teclado
 */
export function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Función para calcular altura del teclado
  const calculateKeyboardHeight = useCallback(() => {
    // Método 1: visualViewport (moderno, Chrome/Safari iOS 15+)
    if (typeof window !== 'undefined' && window.visualViewport) {
      const diff = window.innerHeight - window.visualViewport.height;
      // Si la diferencia es significativa (> 100px), es el teclado
      if (diff > 100) return diff;
    }

    // Método 2: window.innerHeight vs document.documentElement.clientHeight
    // Útil para navegadores más antiguos
    if (typeof window !== 'undefined') {
      const diff = window.innerHeight - document.documentElement.clientHeight;
      if (diff > 100) return diff;
    }

    // Método 3: Detectar por eventos de input focus/blur (fallback)
    // No se usa directamente aquí, pero se combina con el efecto

    return 0;
  }, []);

  // Efecto principal: escuchar resize y focus/blur
  useEffect(() => {
    const handleResize = () => {
      setKeyboardHeight(calculateKeyboardHeight());
    };

    // Escuchar resize del viewport
    window.visualViewport?.addEventListener('resize', handleResize);
    
    // Escuchar eventos de foco en inputs (para casos donde resize no se dispara)
    const handleFocus = () => {
      setTimeout(() => {
        setKeyboardHeight(calculateKeyboardHeight());
      }, 100);
    };

    const handleBlur = () => {
      setTimeout(() => {
        setKeyboardHeight(calculateKeyboardHeight());
      }, 100);
    };

    // Agregar listeners a todos los inputs
    const inputs = document.querySelectorAll('input, textarea');
    inputs.forEach(input => {
      input.addEventListener('focus', handleFocus);
      input.addEventListener('blur', handleBlur);
    });

    // Inicializar al montar
    handleResize();

    // Limpiar
    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      inputs.forEach(input => {
        input.removeEventListener('focus', handleFocus);
        input.removeEventListener('blur', handleBlur);
      });
    };
  }, [calculateKeyboardHeight]);

  return keyboardHeight;
}

