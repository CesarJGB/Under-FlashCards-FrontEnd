import { useState, useEffect, useCallback } from 'react';

export function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const measureKeyboardHeight = useCallback(() => {
    if (typeof window === 'undefined') return 0;
    
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.clientHeight;
    const diff = windowHeight - documentHeight;

    return diff > 80 ? diff : 0;
  }, []);

  useEffect(() => {
    let timeoutId;
    let initialTimeoutId;

    const updateHeight = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setKeyboardHeight(measureKeyboardHeight());
      }, 100);
    };

    // 👈 Delay inicial más largo para modales con autoFocus
    // El teclado tarda ~300ms en aparecer completamente en iOS
    initialTimeoutId = setTimeout(() => {
      setKeyboardHeight(measureKeyboardHeight());
    }, 350);

    window.addEventListener('resize', updateHeight);

    const handleFocus = () => {
      setTimeout(updateHeight, 200);
    };

    const handleBlur = () => {
      setTimeout(updateHeight, 200);
    };

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

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(initialTimeoutId);
      window.removeEventListener('resize', updateHeight);
      observer.disconnect();
      
      const inputs = document.querySelectorAll('input[data-keyboard-listener]');
      inputs.forEach(input => {
        input.removeEventListener('focus', handleFocus);
        input.removeEventListener('blur', handleBlur);
      });
    };
  }, [measureKeyboardHeight]);

  return keyboardHeight;
}

