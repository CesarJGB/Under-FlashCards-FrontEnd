import { useRef, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { ChevronDown, Sparkles } from 'lucide-react';
import ActionSheet from './common/ActionSheet';
import PublicHomeCarousel from './PublicHomeCarousel';

export default function LoginScreen({ onSuccess, onError, error }) {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [showInviteCode, setShowInviteCode] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [authenticating, setAuthenticating] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const loginTriggerRef = useRef(null);

  const handleClose = () => {
    if (authenticating) return;
    setIsAuthOpen(false);
    setInviteError('');
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    if (authenticating) return;
    setAuthenticating(true);
    setInviteError('');
    const result = await onSuccess?.(credentialResponse, inviteCode);
    if (result?.inviteError) setInviteError(result.inviteError);
    setAuthenticating(false);
  };

  const handleGoogleError = () => {
    setAuthenticating(false);
    onError?.();
  };

  return (
    <main className="min-h-[100dvh] overflow-y-auto bg-[#FBFAFF] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))] text-slate-900 dark:bg-slate-950 dark:text-white sm:px-8">
      <div className="mx-auto flex min-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1.75rem)] w-full max-w-5xl flex-col">
        <header className="flex shrink-0 items-center justify-center gap-2 py-1 sm:justify-start">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 shadow-sm shadow-violet-300/60">
            <Sparkles className="h-5 w-5 text-white" aria-hidden="true" />
          </span>
          <span className="text-base font-extrabold tracking-tight sm:text-lg">Under Flashcards</span>
        </header>

        <div className="flex flex-1 items-center justify-center py-3 sm:py-5">
          <PublicHomeCarousel />
        </div>

        <div className="sticky bottom-0 z-10 mx-auto w-full max-w-md bg-gradient-to-t from-[#FBFAFF] via-[#FBFAFF] to-transparent pt-3 dark:from-slate-950 dark:via-slate-950">
          <button
            ref={loginTriggerRef}
            type="button"
            onClick={() => setIsAuthOpen(true)}
            disabled={authenticating}
            className="flex min-h-14 w-full items-center justify-center rounded-[1.25rem] bg-violet-600 px-6 py-4 text-base font-bold text-white shadow-[0_10px_28px_rgba(124,58,237,0.24)] transition-all hover:bg-violet-700 hover:shadow-[0_12px_32px_rgba(124,58,237,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2 active:translate-y-0.5 active:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
          >
            Iniciar sesión
          </button>
        </div>
      </div>

      <ActionSheet open={isAuthOpen} title="Iniciar sesión" onClose={handleClose} returnTarget={loginTriggerRef.current}>
        <div className="mx-auto w-full max-w-md pb-2">
          <div className="pb-5 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-500/20">
              <Sparkles className="h-5 w-5 text-violet-700 dark:text-violet-300" aria-hidden="true" />
            </div>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">Accede con tu cuenta de Google para continuar.</p>
          </div>

          <div className="relative flex min-h-14 w-full items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.06)] transition-shadow focus-within:ring-2 focus-within:ring-violet-600 focus-within:ring-offset-2 hover:shadow-md dark:border-slate-700 dark:bg-slate-800" data-testid="google-login-button" aria-busy={authenticating}>
            <GoogleLogin onSuccess={handleGoogleSuccess} onError={handleGoogleError} theme="outline" size="large" shape="pill" text="continue_with" locale="es" width="360" useOneTap={false} />
            {authenticating && <div className="absolute inset-0 flex items-center justify-center bg-white/95 text-sm font-semibold text-slate-700 dark:bg-slate-800/95 dark:text-slate-200">Iniciando sesión…</div>}
          </div>

          <div className="mt-4 rounded-2xl bg-violet-50/80 p-3 dark:bg-violet-500/10">
            <button
              type="button"
              aria-expanded={showInviteCode}
              aria-controls="invite-code-panel"
              onClick={() => { setShowInviteCode((visible) => !visible); setInviteError(''); }}
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-2 text-left text-sm font-semibold text-violet-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 dark:text-violet-200"
            >
              <span>¿Eres nuevo? Agrega tu código de invitación</span>
              <ChevronDown className={`h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none ${showInviteCode ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>

            {showInviteCode && (
              <div id="invite-code-panel" className="px-2 pb-2 pt-2">
                <label htmlFor="invite-code" className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">Código de invitación</label>
                <input
                  id="invite-code"
                  name="code"
                  type="text"
                  value={inviteCode}
                  onChange={(event) => { setInviteCode(event.target.value.toUpperCase()); setInviteError(''); }}
                  autoCapitalize="characters"
                  autoComplete="one-time-code"
                  spellCheck="false"
                  disabled={authenticating}
                  className="min-h-12 w-full rounded-xl border border-violet-200 bg-white px-4 font-mono tracking-widest text-slate-900 outline-none transition-shadow placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                  placeholder="Ingresa tu código"
                  aria-describedby={inviteError ? 'invite-code-error' : undefined}
                />
              </div>
            )}
          </div>

          {(inviteError || error) && <p id="invite-code-error" role="alert" className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">{inviteError || error}</p>}
        </div>
      </ActionSheet>
    </main>
  );
}
