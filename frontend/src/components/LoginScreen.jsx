import { Sparkles, AlertCircle } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';

export default function LoginScreen({ onSuccess, onError, error }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-900 mb-5">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Flashcards</h1>
          <p className="mt-2 text-slate-500">Inicia sesión para estudiar mejor.</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
          <p className="text-sm font-medium text-slate-700 text-center mb-6">
            Continúa con tu cuenta de Google
          </p>
          <div className="flex justify-center" data-testid="google-login-button">
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
            <div className="mt-5 flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
