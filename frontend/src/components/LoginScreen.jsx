import { useEffect, useRef, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { LoaderCircle, Sparkles, X } from 'lucide-react';
import ActionSheet from './common/ActionSheet';
import PublicHomeCarousel from './PublicHomeCarousel';
import { lockBodyScroll, unlockBodyScroll } from '../lib/scrollLock';

const LOGIN_SCROLL_OWNER = 'LoginScreen';

export default function LoginScreen({ onSuccess, onError, error }) {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [authenticating, setAuthenticating] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [googleButtonWidth, setGoogleButtonWidth] = useState(300);
  const loginTriggerRef = useRef(null);
  const googleContainerRef = useRef(null);

  useEffect(() => {
    const originalPaddingTop = document.body.style.paddingTop;
    const originalPaddingBottom = document.body.style.paddingBottom;
    document.body.style.paddingTop = '0px';
    document.body.style.paddingBottom = '0px';
    lockBodyScroll(LOGIN_SCROLL_OWNER);
    return () => {
      unlockBodyScroll(LOGIN_SCROLL_OWNER);
      document.body.style.paddingTop = originalPaddingTop;
      document.body.style.paddingBottom = originalPaddingBottom;
    };
  }, []);

  useEffect(() => {
    const container = googleContainerRef.current;
    if (!isAuthOpen || !container || typeof ResizeObserver === 'undefined') return undefined;
    const updateWidth = () => {
      const nextWidth = Math.floor(container.getBoundingClientRect().width);
      if (nextWidth > 0) setGoogleButtonWidth(Math.max(220, Math.min(400, nextWidth)));
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, [isAuthOpen]);

  const handleClose = () => {
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
    <main className="fixed inset-0 grid h-[100dvh] w-full grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden overscroll-none bg-[#FBFAFF] px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-[calc(0.65rem+env(safe-area-inset-top))] text-slate-900 dark:bg-slate-950 dark:text-white sm:px-8 sm:pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pt-[calc(1rem+env(safe-area-inset-top))]">
      <header className="mx-auto flex w-full max-w-5xl shrink-0 items-center justify-center gap-2 py-0.5 sm:justify-start">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 shadow-sm shadow-violet-300/60 sm:h-9 sm:w-9">
          <Sparkles className="h-4 w-4 text-white sm:h-5 sm:w-5" aria-hidden="true" />
        </span>
        <span className="text-sm font-extrabold tracking-tight sm:text-lg">Under Flashcards</span>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-5xl items-stretch justify-center py-[clamp(0.2rem,1dvh,0.65rem)]">
        <PublicHomeCarousel />
      </div>

      <div className="mx-auto w-full max-w-md shrink-0 pt-[clamp(0.25rem,0.8dvh,0.65rem)]">
        <button
          ref={loginTriggerRef}
          type="button"
          onClick={() => setIsAuthOpen(true)}
          disabled={authenticating}
          className="flex min-h-[clamp(3rem,7dvh,3.5rem)] w-full items-center justify-center rounded-[1.2rem] bg-violet-600 px-6 py-3 text-base font-extrabold text-white shadow-[0_9px_24px_rgba(124,58,237,0.24)] transition-[transform,background-color,box-shadow] hover:bg-violet-700 hover:shadow-[0_11px_28px_rgba(124,58,237,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2 active:translate-y-0.5 active:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
        >
          Iniciar sesión
        </button>
      </div>

      <ActionSheet
        open={isAuthOpen}
        onClose={handleClose}
        returnTarget={loginTriggerRef.current}
        ariaLabel="Iniciar sesión"
        appearance="auth"
        draggable
        dragDisabled={authenticating}
      >
        <div className="mx-auto w-full max-w-md pb-1 text-slate-900">
          <div className="relative pr-11">
            <h2 className="text-[clamp(1.6rem,6vw,2rem)] font-black leading-tight tracking-[-0.03em] text-slate-950">
              Iniciar sesión
            </h2>
            <button
              type="button"
              onClick={handleClose}
              disabled={authenticating}
              aria-label="Cerrar inicio de sesión"
              data-action-sheet-no-drag="true"
              className="absolute -right-1 -top-1 flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-4">
            <label htmlFor="invite-code" className="text-sm font-extrabold text-slate-900">
              ¿Eres nuevo?
            </label>
            <p className="mt-1 text-sm leading-snug text-slate-600">
              Ingresa tu código de invitación antes de continuar.
            </p>
            <input
              id="invite-code"
              name="code"
              type="text"
              value={inviteCode}
              onChange={(event) => {
                setInviteCode(event.target.value.toUpperCase());
                setInviteError('');
              }}
              autoCapitalize="characters"
              autoComplete="one-time-code"
              spellCheck="false"
              disabled={authenticating}
              placeholder="Código"
              aria-label="Código de invitación"
              aria-describedby={inviteError ? 'invite-code-error' : 'invite-code-helper'}
              data-action-sheet-no-drag="true"
              className="mt-2 min-h-12 w-full rounded-2xl border border-violet-200 bg-white px-4 text-base font-semibold tracking-wide text-slate-900 outline-none transition-[border-color,box-shadow] placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100 disabled:opacity-60"
            />
            {inviteError ? (
              <p id="invite-code-error" role="alert" className="mt-2 text-sm font-semibold text-red-700">
                {inviteError}
              </p>
            ) : (
              <p id="invite-code-helper" className="mt-1.5 text-xs leading-relaxed text-slate-500">
                Si ya tienes acceso, puedes dejarlo vacío.
              </p>
            )}
          </div>

          <div ref={googleContainerRef} className="mx-auto mt-4 flex min-h-14 w-full max-w-[400px] items-center justify-center" data-testid="google-login-button" aria-busy={authenticating}>
            {authenticating ? (
              <div className="flex min-h-10 w-full cursor-wait items-center justify-center text-sm font-bold text-slate-700" role="status">
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />
                Iniciando sesión…
              </div>
            ) : (
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                theme="outline"
                size="large"
                shape="pill"
                text="continue_with"
                logo_alignment="left"
                locale="es"
                width={`${googleButtonWidth}`}
                useOneTap={false}
              />
            )}
          </div>

          {error && !inviteError && (
            <p role="alert" className="mt-3 text-center text-sm font-semibold text-red-700">
              {error}
            </p>
          )}
        </div>
      </ActionSheet>
    </main>
  );
}
