import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { Sparkles, ChevronUp } from 'lucide-react';
import BottomSheet from './BottomSheet';

export default function LoginScreen({ onSuccess, onError, error }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleGetStarted = () => setIsExpanded(true);
  const handleClose = () => setIsExpanded(false);

  // Eliminamos clases de animación que rompen el iframe de Google
  const collapsedContent = (
    <div>
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
  );

  const expandedContent = (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Iniciar Sesión</h2>
        <p className="text-gray-500">Accede con tu cuenta de Google</p>
      </div>

      {/* Contenedor estable con ancho y alto mínimo predefinido */}
      <div className="w-full flex justify-center min-h-[44px]" data-testid="google-login-button">
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

      {error && (
        <div className="mt-6 flex items-start gap-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-4">
          <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-red-600 font-bold text-xs">!</span>
          </div>
          <span className="font-medium">{error}</span>
        </div>
      )}

      <div className="mt-8 text-center">
        <p className="text-xs text-gray-400">
          ¿Problemas para iniciar sesión?{' '}
          <button className="text-cyan-600 hover:text-cyan-700 font-semibold underline">
            Contáctanos
          </button>
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full relative bg-gradient-to-b from-gray-900 via-gray-800 to-white overflow-hidden">
      <div className="fixed top-0 left-0 right-0 h-12 bg-gray-900 z-40" />

      {/* Logo Area */}
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

      <BottomSheet
        isOpen={isExpanded}
        onOpen={handleGetStarted}
        onClose={handleClose}
        collapsedContent={collapsedContent}
        expandedContent={expandedContent}
        collapsedHeight={280}
        expandedHeight={60}
      />
    </div>
  );
}
