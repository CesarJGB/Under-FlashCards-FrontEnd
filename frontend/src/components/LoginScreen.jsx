import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { Sparkles, ChevronUp } from 'lucide-react';

export default function LoginScreen({ onSuccess, onError, error }) {
  const [isExpanded, setIsExpanded] = useState(false);
  // We use the GoogleLogin component (ID token credential) for compatibility
  // with the existing backend verification which expects an idToken in
  // `credential`. The previous useGoogleLogin flow returned access_token/code
  // and required additional server-side exchange.

  const handleGetStarted = () => {
    setIsExpanded(true);
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-gradient-to-br from-cyan-400 via-teal-500 to-blue-600">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-32 h-32 rounded-full bg-white blur-3xl" />
        <div className="absolute bottom-20 right-10 w-40 h-40 rounded-full bg-white blur-3xl" />
        <div className="absolute top-1/2 left-1/2 w-48 h-48 rounded-full bg-white blur-3xl" />
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-16 left-8 right-8 flex justify-between items-center opacity-20">
        <div className="w-16 h-16 rounded-2xl bg-white transform rotate-12" />
        <div className="w-12 h-12 rounded-xl bg-white transform -rotate-6" />
      </div>

      {/* Main Content - Logo Area */}
      <div className="relative z-10 flex flex-col items-center justify-center pt-20 pb-8 px-6">
        <div className="mb-6 relative">
          <div className="w-24 h-24 rounded-3xl bg-white shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform duration-300">
            <Sparkles className="w-12 h-12 text-cyan-600" />
          </div>
          <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center animate-pulse">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
        </div>
        
        <h1 className="text-5xl font-bold text-white mb-3 tracking-tight">
          Flashcards
        </h1>
        <p className="text-cyan-100 text-lg text-center max-w-xs leading-relaxed">
          Estudia de forma inteligente y alcanza tus metas
        </p>
      </div>

      {/* Bottom Sheet */}
      <div 
        className={`
          absolute bottom-0 left-0 right-0 
          bg-white rounded-t-[32px] shadow-2xl
          transition-all duration-500 ease-out
          ${isExpanded ? 'h-[85vh]' : 'h-auto'}
        `}
      >
        {/* Handle Bar */}
        <div className="flex justify-center pt-4 pb-2">
          <div className={`
            w-12 h-1.5 bg-slate-300 rounded-full 
            transition-transform duration-300
            ${isExpanded ? 'rotate-0' : ''}
          `} />
        </div>

        {/* Collapsed State - Get Started */}
        <div className={`
          px-8 pb-8 transition-all duration-500
          ${isExpanded ? 'opacity-0 h-0 overflow-hidden py-0' : 'opacity-100'}
        `}>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              ¡Bienvenido!
            </h2>
            <p className="text-slate-500">
              Inicia sesión para comenzar a estudiar
            </p>
          </div>

          <button
            onClick={handleGetStarted}
            className="w-full bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-semibold py-4 px-8 rounded-2xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2 group"
          >
            Comenzar
            <ChevronUp className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
          </button>

          <p className="text-center text-xs text-slate-400 mt-6">
            Al continuar aceptas nuestros términos y condiciones
          </p>
        </div>

        {/* Expanded State - Login Form */}
        <div className={`
          px-8 pb-8 transition-all duration-500 delay-100
          ${isExpanded ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden py-0'}
        `}>
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">
              Iniciar Sesión
            </h2>
            <p className="text-slate-500">
              Accede con tu cuenta de Google
            </p>
          </div>

          {/* Google Login Button (uses the official GoogleLogin component to
              receive an id_token in `credential` which the backend verifies) */}
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
            <div className="mt-6 flex items-start gap-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-4 animate-pulse">
              <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-red-600 font-bold text-xs">!</span>
              </div>
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Footer Info */}
          <div className="mt-8 text-center">
            <p className="text-xs text-slate-400">
              ¿Problemas para iniciar sesión?{' '}
              <button className="text-cyan-600 hover:text-cyan-700 font-semibold underline">
                Contáctanos
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
