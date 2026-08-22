import { useLayoutEffect, useRef, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { LoaderCircle, X } from 'lucide-react';
import underFlashcardsLogo from '../../media/svg/logo/under-flashcards-logo 2.svg';
import luaInviteCard from '../../media/svg/pantalla de secion/lua-invite-card.webp';
import ActionSheet from './common/ActionSheet';
import PublicHomeCarousel from './PublicHomeCarousel';
import { lockBodyScroll, unlockBodyScroll } from '../lib/scrollLock';
import { toggleViewportDebugFromGesture } from '../lib/viewportDebug';

const LOGIN_SCROLL_OWNER = 'LoginScreen';
const GOOGLE_MIN_BUTTON_WIDTH = 220;
const GOOGLE_MAX_BUTTON_WIDTH = 400;
const VIEWPORT_DEBUG_TAP_COUNT = 5;
const VIEWPORT_DEBUG_TAP_WINDOW_MS = 1200;

const readGoogleButtonWidth = (container) => {
  const measuredWidth = Math.round(container?.getBoundingClientRect?.().width || 0);
  if (measuredWidth <= 0) return null;
  return Math.max(GOOGLE_MIN_BUTTON_WIDTH, Math.min(GOOGLE_MAX_BUTTON_WIDTH, measuredWidth));
};

export default function LoginScreen({ onSuccess, onError, error }) {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [authenticating, setAuthenticating] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [googleButtonWidth, setGoogleButtonWidth] = useState(null);
  const loginTriggerRef = useRef(null);
  const googleContainerRef = useRef(null);
  const googleButtonWidthRef = useRef(null);
  const viewportDebugTapTimesRef = useRef([]);

  useLayoutEffect(() => {
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

  useLayoutEffect(() => {
    const container = googleContainerRef.current;
    if (!container) return undefined;
    const updateWidth = () => {
      const nextWidth = readGoogleButtonWidth(container);
      if (nextWidth === null || nextWidth === googleButtonWidthRef.current) return;
      googleButtonWidthRef.current = nextWidth;
      setGoogleButtonWidth(nextWidth);
    };
    updateWidth();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const handleClose = () => {
    setIsAuthOpen(false);
    setInviteError('');
  };

  const handleOpen = () => {
    setIsAuthOpen(true);
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

  const handleViewportDebugTap = () => {
    const now = Date.now();
    const recentTaps = viewportDebugTapTimesRef.current.filter(
      (timestamp) => now - timestamp <= VIEWPORT_DEBUG_TAP_WINDOW_MS,
    );
    recentTaps.push(now);

    if (recentTaps.length >= VIEWPORT_DEBUG_TAP_COUNT) {
      viewportDebugTapTimesRef.current = [];
      toggleViewportDebugFromGesture();
      return;
    }

    viewportDebugTapTimesRef.current = recentTaps;
  };

  return (
    <main className="login-viewport-surface fixed inset-0 grid w-full grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden overscroll-none bg-[#FBFAFF] px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-[calc(0.65rem+env(safe-area-inset-top))] text-slate-900 dark:bg-slate-950 dark:text-white sm:px-8 sm:pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pt-[calc(1rem+env(safe-area-inset-top))]">
      <header className="mx-auto flex w-full max-w-5xl shrink-0 items-center justify-center py-0.5 sm:justify-start">
        <img
          src={underFlashcardsLogo}
          alt="Under Flashcards"
          onClick={handleViewportDebugTap}
          className="h-[clamp(3rem,7.5vw,3.75rem)] w-auto max-w-full object-contain [@media(max-height:600px)]:h-[clamp(2.75rem,7vw,3.25rem)]"
        />
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-5xl items-stretch justify-center py-[clamp(0.2rem,1dvh,0.65rem)]">
        <PublicHomeCarousel />
      </div>

      <div className="mx-auto w-full max-w-md shrink-0 pt-[clamp(0.25rem,0.8dvh,0.65rem)]">
        <button
          ref={loginTriggerRef}
          type="button"
          onClick={handleOpen}
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
        restoreSnapAfterInput
        keepMounted
      >
        <div className="mx-auto w-full max-w-md overflow-visible pb-1 text-slate-950">
          <div className="relative flex min-h-11 items-start pr-12">
            <h2 className="pt-0.5 text-[clamp(1.65rem,6.3vw,1.95rem)] font-black leading-[1.05] tracking-[-0.025em] text-[#080914]">
              Iniciar sesión
            </h2>
            <button
              type="button"
              onClick={handleClose}
              disabled={authenticating}
              aria-label="Cerrar inicio de sesión"
              data-action-sheet-no-drag="true"
              className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-full border border-[#D6D1DF] bg-[#E8E4F0] text-[#7D7A89] transition-colors hover:bg-[#E1DDEA] hover:text-[#666472] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A99ACB] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <X className="h-5 w-5 stroke-[2.1]" aria-hidden="true" />
            </button>
          </div>

          <div
            ref={googleContainerRef}
            className="mx-auto mt-3 flex min-h-12 w-full max-w-[400px] items-center justify-center"
            data-testid="google-login-button"
            aria-busy={authenticating || googleButtonWidth === null}
          >
            {authenticating ? (
              <div className="flex min-h-10 w-full cursor-wait items-center justify-center text-sm font-bold text-slate-700" role="status">
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />
                Iniciando sesión…
              </div>
            ) : googleButtonWidth !== null ? (
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
                containerProps={{ className: 'w-full' }}
                useOneTap={false}
              />
            ) : null}
          </div>

          {error && !inviteError && (
            <p role="alert" className="mt-2.5 text-center text-sm font-semibold text-red-700">
              {error}
            </p>
          )}

          <div className="my-4 h-px w-full bg-[#CAC8D6]" aria-hidden="true" />

          <div>
            <label htmlFor="invite-code" className="block text-base font-extrabold leading-tight text-[#080914]">
              ¿Eres nuevo?
            </label>
            <p className="mt-1 text-[0.8125rem] leading-[1.35] text-[#17171D]">
              Ingresa tu código de invitación antes de continuar.
            </p>

            <div className="relative mb-3 mt-3 overflow-visible">
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
                className="min-h-[4.9rem] w-full rounded-[1.6rem] border border-[#B9AEC8] bg-[#FFFEFF] px-4 pr-[clamp(8.5rem,36vw,9.75rem)] text-[1.05rem] font-semibold tracking-wide text-[#0D0E14] outline-none transition-[border-color,box-shadow] placeholder:font-normal placeholder:tracking-normal placeholder:text-[#B2B1BC] focus:border-[#9B8BBE] focus:ring-4 focus:ring-[#DED7EE]/80 disabled:opacity-60"
              />
              <img
                src={luaInviteCard}
                alt=""
                aria-hidden="true"
                draggable="false"
                className="pointer-events-none absolute -bottom-7 -right-4 z-10 h-[clamp(8.25rem,36vw,9.75rem)] w-[clamp(8.25rem,36vw,9.75rem)] select-none object-contain"
              />
            </div>

            {inviteError ? (
              <p id="invite-code-error" role="alert" className="mt-2 text-sm font-semibold text-red-700">
                {inviteError}
              </p>
            ) : (
              <p id="invite-code-helper" className="mt-1 max-w-[calc(100%-4rem)] text-xs leading-relaxed text-[#17171D]">
                Si ya tienes acceso, puedes dejarlo vacío.
              </p>
            )}
          </div>
        </div>
      </ActionSheet>
    </main>
  );
}
