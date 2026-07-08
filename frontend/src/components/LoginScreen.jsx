import { useState, useEffect, useRef } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { Sparkles, ChevronUp, ChevronDown } from 'lucide-react';

export default function LoginScreen({ onSuccess, onError, error }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const touchStartY = useRef(null);

  // Bloqueo de scroll total y prevención de pull-to-refresh
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    
    return () => {
      document.body.style.overflow = '';
      document.body.style.overscrollBehavior = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.overscrollBehavior = '';
    };
  }, []);

  const handleGetStarted = () => {
    setIsExpanded(true);
  };

  const handleClose = () => {
    setIsExpanded(false);
  };

  // Touch handlers para swipe
  const onTouchStart = (e) => {
    touchStartY.current = e.changedTouches[0].clientY;
  };

  const onTouchEnd = (e) => {
    if (touchStartY.current == null) return;
    
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    const threshold = 50;
    
    if (isExpanded && dy > threshold) {
      handleClose();
    } else if (!isExpanded && dy < -threshold) {
      handleGetStarted();
    }
    
    touchStartY.current = null;
  };

  return (
    <div className="min-h-screen w-full relative bg-gradient-to-b from-gray-900 via-gray-800 to-white overflow-hidden">
      {/* Main Content - Logo Area (centrado en la parte superior) */}
      <div className="relative z-10 flex flex-col items-center justify-center pt-32 pb-8 px-6">
        <div className="mb-6">
          <div className="w-24 h-24 rounded-3xl bg-white shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform duration-300">
            <Sparkles className="w-12 h-12 text-gray-900" />
          </div>
        </div>
        
        <h1 className="text-5xl font-bold text-white mb-3 tracking-tight drop-shadow-lg">
          Flashcards
        </h1>
        <p className="text-gray-300 text-lg text-center max-w-xs leading-relaxed">
          Estudia de forma inteligente y alcanza tus metas
        </p>
      </div>

      {/* Bottom Sheet - FIXED al fondo de la pantalla */}
      <div 
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className={`
          fixed bottom-0 left-0 right-0 
          bg-white rounded-t-[32px] shadow-2xl z-30
          transition-all duration-500 ease-out
          touch-pan-y select-none
          ${isExpanded ? 'h-[85vh]' : 'h-auto'}
        `}
      >
        {/* Handle Bar */}
        <div className="flex justify-center pt-4 pb-2">
          <button
            onClick={handleClose}
            className="flex flex-col items-center gap-1 group"
            aria-label={isExpanded ? "Cerrar" : "Abrir"}
          >
            <div className={`
              w-12 h-1.5 bg-gray-300 rounded-full 
              transition-all duration-300
              ${isExpanded ? 'group-hover:bg-gray-400' : ''}
            `} />
            {isExpanded && (
              <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
            )}
          </button>
        </div>

        {/* Render only one state at a time */}
        {!isExpanded ? (
          <div 
            key="collapsed"
            className="px-8 pb-8 animate-slideUp"
          >
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                ¡Bienvenido!
              </h2>
              <p className="text-gray-500">Inicia sesión para comenzar a estudiar</p>
            </div>

            <button
              onClick={handleGetStarted}
              className="w-full bg-gradient-to-r from-gray-800 via-gray-700 to-gray-600 text-white font-semibold py-4 px-8 rounded-2xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2 group"
            >
              Comenzar
              <ChevronUp className="w-5 h-5 group-hover:-translate-y-1 transition-transform duration-300" />
            </button>

            <p className="text-center text-xs text-gray-400 mt-6">
              Al continuar aceptas nuestros términos y condiciones
            </p>
          </div>
        ) : (
          <div 
            key="expanded"
            className="px-8 pb-8 animate-slideUp"
          > 
            {/* Header */}
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Iniciar Sesión</h2>
              <p className="text-gray-500">Accede con tu cuenta de Google</p>
            </div>

            {/* Google Login Button */}
            <div className="w-full flex justify-center" data-testid="google-login-button">
              <GoogleLogin
                onSuccess={onSuccess}
                onError={onError}
                theme="outline"
                size="large"
                shape="pill"
                text="continue_with"
                locale="es"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="mt-6 flex items-start gap-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-4">
                <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-red-600 font-bold text-xs">!</span>
                </div>
                <span className="font-medium">{error}</span>
              </div>
            )}

            {/* Footer Info */}
            <div className="mt-8 text-center">
              <p className="text-xs text-gray-400">
                ¿Problemas para iniciar sesión?{' '}
                <button className="text-cyan-600 hover:text-cyan-700 font-semibold underline">
                  Contáctanos
                </button>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Custom CSS for animations */}
      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slideUp {
          animation: slideUp 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}
