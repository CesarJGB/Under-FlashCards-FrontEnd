import { useState, useEffect, useCallback } from 'react';

/**
 * Hook robusto para detectar altura del teclado en móviles
 * Funciona en Safari iOS y Chrome Android sin dependencia de visualViewport
 * 
 * @returns {number} Altura del teclado en píxeles, o 0 si no hay teclado
 */
export function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Función que mide la diferencia entre window.innerHeight y document.documentElement.clientHeight
  const measureKeyboardHeight = useCallback(() => {
    if (typeof window === 'undefined') return 0;
    
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.clientHeight;
    const diff = windowHeight - documentHeight;

    // En móviles, cuando el teclado está abierto, documentHeight se reduce
    // Umbral conservador: > 80px = teclado activo
    return diff > 80 ? diff : 0;
  }, []);

  // Efecto principal: escuchar resize y eventos de foco/blur
  useEffect(() => {
    let timeoutId;

    const updateHeight = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setKeyboardHeight(measureKeyboardHeight());
      }, 100); // Pequeño delay para esperar a que el teclado se muestre
    };

    // Escuchar resize (para cambios de orientación, etc.)
    window.addEventListener('resize', updateHeight);

    // Escuchar foco/blur en inputs (más confiable en Safari)
    const handleFocus = () => {
      setTimeout(updateHeight, 200);
    };

    const handleBlur = () => {
      setTimeout(updateHeight, 200);
    };

    // Agregar listeners a todos los inputs existentes y futuros
    const observer = new MutationObserver(() => {
      const inputs = document.querySelectorAll('input, textarea');
      inputs.forEach(input => {
        if (!input.hasAttribute('data-keyboard-listener')) {
          input.setAttribute('data-keyboard-listener', 'true');
          input.addEventListener('focus', handleFocus);
          input.addEventListener('blur', handleBlur);
        }
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Inicializar al montar
    updateHeight();

    // Limpiar
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updateHeight);
      observer.disconnect();
      
      // Limpiar listeners de inputs
      const inputs = document.querySelectorAll('input[data-keyboard-listener]');
      inputs.forEach(input => {
        input.removeEventListener('focus', handleFocus);
        input.removeEventListener('blur', handleBlur);
      });
    };
  }, [measureKeyboardHeight]);

  return keyboardHeight;
}

