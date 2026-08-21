// FILE: frontend/src/App.jsx
import { useState, useEffect, useLayoutEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { getJSON, setJSON } from './lib/safeLocalStorage';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { Sparkles, Library, Home, BookOpen, User, LayoutGrid } from 'lucide-react';

import LoginScreen from './components/LoginScreen';
import usePendingReviewsFlush from './hooks/usePendingReviewsFlush';
import HomeSection from './components/HomeSection';
import StudySection from './components/StudySection';
import LibrarySection from './components/LibrarySection';
import GeneralSection from './components/library/GeneralSection';
import SettingsSection from './components/SettingsSection';
import UserSection from './components/UserSection';
import InviteCodeManager from './components/InviteCodeManager';
import InviteGateScreen from './components/InviteGateScreen';
import PublicMateriaPage from './components/PublicMateriaPage';
import { getPublicMateriaShareId } from './lib/publicMateria';
import { preloadStaticIllustrations } from './lib/staticIllustrations';
import { sanitizeDeckSummaries } from './lib/imageDelivery';
import { perfLibraryProfile } from './lib/perfLibraryProfile';
import luaLoadingVideo from '../media/svg/pantalla de secion/lua_loading_animation_5s.mp4';
import underFlashcardsLogo from '../media/svg/logo/under-flashcards-logo 2.svg';
import './app-loading.css';

const DebugPanel = lazy(() => import('./components/DebugPanel'));

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const APP_LOADING_VIDEO_SAFETY_TIMEOUT = 12000;
const APP_LOADING_REVEAL_FALLBACK_TIMEOUT = 900;
const APP_LOADING_PHASE = Object.freeze({
  VIDEO: 'video',
  BRAND_ICON: 'brand-icon',
  BRAND_ICON_EXIT: 'brand-icon-exit',
  BRAND_LOGO: 'brand-logo',
  REVEALING: 'revealing',
  COMPLETE: 'complete',
});
const APP_LOADING_TIMING = Object.freeze({
  ICON_IN: 260,
  ICON_HOLD: 650,
  ICON_OUT: 180,
  LOGO_IN: 260,
  LOGO_HOLD: 1400,
});
const APP_LOADING_PHASE_TRANSITION = Object.freeze({
  [APP_LOADING_PHASE.BRAND_ICON]: Object.freeze({
    next: APP_LOADING_PHASE.BRAND_ICON_EXIT,
    duration: APP_LOADING_TIMING.ICON_IN + APP_LOADING_TIMING.ICON_HOLD,
  }),
  [APP_LOADING_PHASE.BRAND_ICON_EXIT]: Object.freeze({
    next: APP_LOADING_PHASE.BRAND_LOGO,
    duration: APP_LOADING_TIMING.ICON_OUT,
  }),
  [APP_LOADING_PHASE.BRAND_LOGO]: Object.freeze({
    next: APP_LOADING_PHASE.REVEALING,
    duration: APP_LOADING_TIMING.LOGO_IN + APP_LOADING_TIMING.LOGO_HOLD,
  }),
});
const APP_LOADING_BACKGROUND = Object.freeze({
  VIDEO: '#FBFAFF',
  BRAND: '#EDE9FE',
  HOME: '#FFFFFF',
});
const APP_LOADING_PHRASES = [
  {
    dark: 'No hay atajos para volverse fuerte;',
    purple: 'la verdadera habilidad se construye repitiendo lo básico todos los días.',
  },
  {
    dark: 'Un solo golpe no derriba un gran árbol,',
    purple: 'pero miles de intentos constantes terminan por lograrlo.',
  },
];

let luaLoadingPreloadVideo = null;
let luaLoadingPreloadPromise = null;

function preloadLuaLoadingVideo() {
  if (typeof document === 'undefined') return Promise.resolve(false);
  if (luaLoadingPreloadPromise) return luaLoadingPreloadPromise;

  luaLoadingPreloadVideo = document.createElement('video');
  const preloadVideo = luaLoadingPreloadVideo;
  preloadVideo.preload = 'auto';
  preloadVideo.muted = true;
  preloadVideo.defaultMuted = true;
  preloadVideo.playsInline = true;

  luaLoadingPreloadPromise = new Promise((resolve) => {
    let settled = false;

    const cleanup = () => {
      preloadVideo.removeEventListener('loadeddata', handleLoaded);
      preloadVideo.removeEventListener('canplay', handleLoaded);
      preloadVideo.removeEventListener('error', handleError);
    };

    const settle = (loaded) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(loaded);
    };

    const handleLoaded = () => settle(true);
    const handleError = () => settle(false);

    preloadVideo.addEventListener('loadeddata', handleLoaded);
    preloadVideo.addEventListener('canplay', handleLoaded);
    preloadVideo.addEventListener('error', handleError);
    preloadVideo.src = luaLoadingVideo;
    preloadVideo.load();
  });

  return luaLoadingPreloadPromise;
}

function AppLoadingScreen({ onComplete, videoSource = luaLoadingVideo }) {
  const [phrase] = useState(
    () => APP_LOADING_PHRASES[Math.floor(Math.random() * APP_LOADING_PHRASES.length)]
  );
  const [phase, setPhase] = useState(APP_LOADING_PHASE.VIDEO);
  const luaLoadingVideoRef = useRef(null);
  const playAttemptedRef = useRef(false);
  const safetyTimerRef = useRef(null);
  const phaseTimerRef = useRef(null);
  const completedRef = useRef(false);
  const mountedRef = useRef(true);
  const phaseRef = useRef(APP_LOADING_PHASE.VIDEO);
  const onCompleteRef = useRef(onComplete);
  const documentBackgroundRef = useRef(null);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const clearSafetyTimer = useCallback(() => {
    if (safetyTimerRef.current !== null) {
      window.clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
  }, []);

  const clearPhaseTimer = useCallback(() => {
    if (phaseTimerRef.current !== null) {
      window.clearTimeout(phaseTimerRef.current);
      phaseTimerRef.current = null;
    }
  }, []);

  const finishLoading = useCallback(() => {
    if (completedRef.current || !mountedRef.current) return;
    completedRef.current = true;
    phaseRef.current = APP_LOADING_PHASE.COMPLETE;
    setPhase(APP_LOADING_PHASE.COMPLETE);
    clearSafetyTimer();
    clearPhaseTimer();
    onCompleteRef.current?.();
  }, [clearPhaseTimer, clearSafetyTimer]);

  const advancePhase = useCallback((expectedPhase, nextPhase) => {
    if (
      completedRef.current
      || !mountedRef.current
      || phaseRef.current !== expectedPhase
    ) return;

    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }, []);

  const showBrandSplash = useCallback(() => {
    advancePhase(APP_LOADING_PHASE.VIDEO, APP_LOADING_PHASE.BRAND_ICON);
  }, [advancePhase]);

  const startLuaLoadingVideo = useCallback(() => {
    if (
      completedRef.current
      || playAttemptedRef.current
      || phaseRef.current !== APP_LOADING_PHASE.VIDEO
    ) return;

    const video = luaLoadingVideoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.currentTime = 0;
    playAttemptedRef.current = true;

    try {
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          playAttemptedRef.current = false;
        });
      }
    } catch {
      playAttemptedRef.current = false;
    }
  }, []);

  useEffect(() => {
    const video = luaLoadingVideoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.currentTime = 0;

    if (video.readyState >= 2) {
      startLuaLoadingVideo();
    }
  }, [startLuaLoadingVideo]);

  useEffect(() => {
    clearPhaseTimer();

    const transition = APP_LOADING_PHASE_TRANSITION[phase];
    if (transition) {
      phaseTimerRef.current = window.setTimeout(() => {
        phaseTimerRef.current = null;
        advancePhase(phase, transition.next);
      }, transition.duration);
    } else if (phase === APP_LOADING_PHASE.REVEALING) {
      phaseTimerRef.current = window.setTimeout(
        finishLoading,
        APP_LOADING_REVEAL_FALLBACK_TIMEOUT
      );
    }

    return clearPhaseTimer;
  }, [advancePhase, clearPhaseTimer, finishLoading, phase]);

  useLayoutEffect(() => {
    const targets = [document.documentElement, document.body];
    documentBackgroundRef.current = targets.map((target) => ({
      target,
      value: target.style.getPropertyValue('background-color'),
      priority: target.style.getPropertyPriority('background-color'),
    }));

    return () => {
      documentBackgroundRef.current?.forEach(({ target, value, priority }) => {
        if (value) {
          target.style.setProperty('background-color', value, priority);
        } else {
          target.style.removeProperty('background-color');
        }
      });
      documentBackgroundRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const backgroundColor = phase === APP_LOADING_PHASE.VIDEO
      ? APP_LOADING_BACKGROUND.VIDEO
      : phase === APP_LOADING_PHASE.REVEALING || phase === APP_LOADING_PHASE.COMPLETE
        ? APP_LOADING_BACKGROUND.HOME
        : APP_LOADING_BACKGROUND.BRAND;

    documentBackgroundRef.current?.forEach(({ target }) => {
      target.style.setProperty('background-color', backgroundColor);
    });
  }, [phase]);

  useEffect(() => {
    mountedRef.current = true;
    safetyTimerRef.current = window.setTimeout(finishLoading, APP_LOADING_VIDEO_SAFETY_TIMEOUT);
    return () => {
      mountedRef.current = false;
      clearSafetyTimer();
      clearPhaseTimer();
      onCompleteRef.current = null;
    };
  }, [clearPhaseTimer, clearSafetyTimer, finishLoading]);

  const handleRevealTransitionEnd = useCallback((event) => {
    if (
      event.target !== event.currentTarget
      || phaseRef.current !== APP_LOADING_PHASE.REVEALING
      || !['transform', 'opacity'].includes(event.propertyName)
    ) return;

    finishLoading();
  }, [finishLoading]);

  return (
    <div
      className="fixed inset-0 z-[100] isolate overflow-hidden"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-loading-phase={phase}
      data-testid="app-loading-screen"
      style={{
        '--app-loading-video-background': APP_LOADING_BACKGROUND.VIDEO,
        '--app-loading-brand-background': APP_LOADING_BACKGROUND.BRAND,
      }}
    >
      <div
        className="app-loading-curtain absolute inset-0 overflow-hidden"
        data-loading-phase={phase}
        data-testid="app-loading-curtain"
        onTransitionEnd={handleRevealTransitionEnd}
      >
        <div
          className="app-loading-video-stage absolute inset-0 flex items-center justify-center bg-[#FBFAFF] px-5 py-4 sm:px-8 sm:py-8"
          aria-hidden={phase !== APP_LOADING_PHASE.VIDEO}
          data-testid="app-loading-video-stage"
        >
          <div className="flex h-full min-h-0 w-full max-w-5xl flex-col items-center justify-center gap-[clamp(0.75rem,3vh,2rem)]">
            <div
              className="relative isolate aspect-square h-auto w-[min(90vw,40rem,58vh)] max-w-full shrink-0 overflow-hidden bg-[#FBFAFF] leading-none"
              data-testid="lua-loading-video-frame"
            >
              <video
                ref={luaLoadingVideoRef}
                src={videoSource || undefined}
                muted
                autoPlay
                playsInline
                preload="auto"
                controls={false}
                aria-hidden="true"
                onLoadedData={startLuaLoadingVideo}
                onCanPlay={startLuaLoadingVideo}
                onEnded={showBrandSplash}
                onError={showBrandSplash}
                className="block h-full w-full max-w-full object-contain"
                style={{
                  isolation: 'isolate',
                  WebkitBackfaceVisibility: 'hidden',
                  backfaceVisibility: 'hidden',
                  WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                }}
                data-testid="lua-loading-video"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-10 border-2 border-[#FBFAFF]"
                data-testid="lua-loading-video-edge-mask"
              />
            </div>
            <p className="max-w-4xl text-center text-[clamp(1.25rem,4.5vw,2rem)] font-extrabold leading-[1.4]">
              <span className="text-slate-950">{phrase.dark}</span>{' '}
              <span className="text-violet-600">{phrase.purple}</span>
            </p>
          </div>
        </div>

        <div
          className="app-loading-brand-stage absolute inset-0 flex items-center justify-center"
          aria-hidden={phase === APP_LOADING_PHASE.VIDEO}
          data-testid="app-loading-brand-splash"
        >
          <div className="app-loading-brand-lockup flex flex-col items-center justify-center">
            {(phase === APP_LOADING_PHASE.BRAND_ICON
              || phase === APP_LOADING_PHASE.BRAND_ICON_EXIT) && (
              <img
                src="/icons/icon-512.png"
                alt=""
                aria-hidden="true"
                draggable="false"
                className="app-loading-brand-icon select-none"
                data-testid="app-loading-brand-icon"
              />
            )}
            {(phase === APP_LOADING_PHASE.BRAND_LOGO
              || phase === APP_LOADING_PHASE.REVEALING) && (
              <img
                src={underFlashcardsLogo}
                alt="Under Flashcards"
                draggable="false"
                className="app-loading-brand-logo select-none"
                data-testid="app-loading-brand-logo"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardScreen({ user, onLogout, onInviteRequired }) {
  perfLibraryProfile.renderCount('DashboardScreen');
  const [tab, setTab] = useState('home');
  const [homeKey, setHomeKey] = useState(0);
  const [studyKey, setStudyKey] = useState(0);
  const mobileNavRef = useRef(null);
  const contentScrollRef = useRef(null);
  const homeAdaptivePreviewRef = useRef(null);
  const [dashboardShell, setDashboardShell] = useState(null);
  const [libraryFabHost, setLibraryFabHost] = useState(null);
  const [isCalendarImmersive, setIsCalendarImmersive] = useState(false);
  const handleCalendarImmersiveChange = useCallback((immersive) => {
    setIsCalendarImmersive(Boolean(immersive));
  }, []);

  // Estado puente para navegación Home → Library
  const [pendingLibraryNav, setPendingLibraryNav] = useState(null);

  const [decks, setDecks] = useState(() => sanitizeDeckSummaries(getJSON(`decks_${user.id}`) || []));

  const [materias, setMaterias] = useState(() => getJSON(`materias_${user.id}`) || []);

  const [loading, setLoading] = useState(() => {
    const cachedDecks = getJSON(`decks_${user.id}`);
    const cachedMaterias = getJSON(`materias_${user.id}`);
    return !cachedDecks || !cachedMaterias;
  });

  const [currentDeck, setCurrentDeck] = useState(null);
  const [initialMode, setInitialMode] = useState('edit');

  useEffect(() => {
    void preloadStaticIllustrations();
  }, []);

  // 💡 Determinamos si se está en el editor de un mazo en la biblioteca
  const isEditingDeck = tab === 'library' && currentDeck !== null && initialMode === 'edit';

  const loadDecks = useCallback(async (showSpinner = false, signal) => {
    const perfInv = perfLibraryProfile.beginLoader('loadDecks', { showSpinner, signal });
    if (showSpinner) setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/decks/${user.id}?t=${Date.now()}&contract=indexed&cover=thumbnail`, {
        signal,
        headers: {
          'X-User-Id': user.id
        }
      });
      if (!res.ok) throw new Error();
      const data = sanitizeDeckSummaries(await res.json());
      setDecks(data);
      setJSON(`decks_${user.id}`, data);
      perfInv.end('ok');
    } catch {
      /* fallback silencioso a caché local */
      perfInv.end('error');
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  const loadMaterias = useCallback(async (showSpinner = false, signal) => {
    const perfInv = perfLibraryProfile.beginLoader('loadMaterias', { showSpinner, signal });
    if (showSpinner) setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/academic/materias/${user.id}?t=${Date.now()}`, { 
        signal,
        headers: {
          'X-User-Id': user.id
        }
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMaterias(data);
      setJSON(`materias_${user.id}`, data);
      perfInv.end('ok');
    } catch {
      /* fallback silencioso a caché local */
      perfInv.end('error');
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    loadDecks(false, signal);
    loadMaterias(false, signal);

    return () => controller.abort();
  }, [loadDecks, loadMaterias]);

  // Handler de navegación profunda a librería desde Home
  const handleNavigateToLibraryPath = useCallback((path) => {
    setPendingLibraryNav(path);
    setCurrentDeck(null);
    setInitialMode('edit');
    setTab('library');
  }, []);

  const handleStableHomeAdaptivePreview = useCallback((snapshot) => {
    homeAdaptivePreviewRef.current = snapshot;
  }, []);

  const handleTabChange = (id) => {
    if (id !== 'general') setIsCalendarImmersive(false);
    if (id === 'library') {
      setCurrentDeck(null);
      setInitialMode('edit');
      setPendingLibraryNav(null);
    }

    if (id === 'home') {
      contentScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      }
      setHomeKey(prev => prev + 1);
    }

    if (id === 'study') {
      setStudyKey(prev => prev + 1);
    }

    setTab(id);
  };

  // Ensure viewport resets to top when switching main tabs (SPA behavior)
    useEffect(() => {
    if (typeof window === 'undefined') return;
    requestAnimationFrame(() => {
      contentScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });
  }, [tab, currentDeck]);


  const handleOpenReviewFromHome = (deck) => {
    setInitialMode('review');
    setCurrentDeck(deck);
    setTab('library');
  };

  const handleOpenReviewFromStudy = (deck, mode = 'continuous-review') => {
    setInitialMode(mode);
    setCurrentDeck(deck);
    setTab('library');
  };

  const handleExitToStudy = () => {
    setCurrentDeck(null);
    setInitialMode('edit');
    setTab('study');
  };

  const navItem = (id, label, Icon) => (
    <button
      type="button"
      onClick={() => handleTabChange(id)}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
        tab === id ? 'bg-slate-900 text-white font-semibold' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );

  return (
    <div ref={setDashboardShell} className="fixed inset-0 w-full overflow-hidden bg-slate-50 flex pt-[env(safe-area-inset-top)] md:static md:min-h-[100dvh] md:overflow-visible md:pt-0" data-testid="dashboard-screen">
      <aside className="hidden md:flex w-72 shrink-0 flex-col bg-white border-r border-slate-200 p-5">
        <div className="flex items-center gap-2 px-1 mb-8 h-9 min-w-0">
          <div className="min-w-0 flex items-center gap-2">
            {currentDeck && tab === 'library' ? (
              <span className="font-black text-slate-900 text-base border-l-4 border-slate-900 pl-2.5 truncate" title={currentDeck.title}>
                {currentDeck.title}
              </span>
            ) : (
              <>
                <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="font-extrabold text-slate-900 text-lg">Under-Flash</span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleTabChange('usuario')}
            className="ml-auto p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors shrink-0 cursor-pointer"
            title="Perfil de usuario"
          >
            <User className="w-5 h-5" />
          </button>

        </div>

        <nav className="space-y-1.5">
          {navItem('home', 'Inicio', Home)}
          {navItem('study', 'Modo Estudio', BookOpen)}
          {navItem('library', 'Biblioteca', Library)}
          {navItem('general', 'General', LayoutGrid)}
        </nav>
      </aside>

      <main ref={contentScrollRef} data-app-scroll-root className="relative flex-1 min-h-0 min-w-0 overflow-y-auto overscroll-contain md:min-h-[100dvh] md:overflow-visible">
        <div
          ref={setLibraryFabHost}
          className="sticky z-50 h-0 pointer-events-none"
          style={{ top: 'calc(100dvh - env(safe-area-inset-bottom) - 9.5rem)' }}
        />
        {/* 💡 Si se está editando un mazo, pb-0 remueve el padding inferior reservado para la barra móvil */}
        <div className={`max-w-5xl mx-auto px-4 pt-4 ${tab === 'home' || isEditingDeck || isCalendarImmersive ? 'pb-0' : 'pb-[calc(env(safe-area-inset-bottom)+6rem)]'} md:px-6 md:pt-8 md:pb-8`}>
          {tab === 'home' && (
            <HomeSection 
              key={homeKey}
              user={user} 
              decks={decks} 
              materias={materias}
              onOpenReview={handleOpenReviewFromHome}
              onNavigateToLibrary={handleNavigateToLibraryPath}
              onLogout={onLogout}
              loadDecks={loadDecks}
              loadMaterias={loadMaterias}
              onOpenProfile={() => handleTabChange('usuario')}
              bottomNavRef={mobileNavRef}
              adaptivePreviewBootstrap={homeAdaptivePreviewRef.current}
              onStableAdaptivePreview={handleStableHomeAdaptivePreview}
            />
          )}

          {tab === 'study' && (
            <StudySection 
              key={studyKey}
              decks={decks}
              materias={materias}
              userId={user.id}
              userEmail={user.email}
              onOpenReview={handleOpenReviewFromStudy}
              dashboardShell={dashboardShell}
            />
          )}

          {tab === 'library' && (
            <LibrarySection
              userId={user.id}
              isAdmin={user.isAdmin}
              authToken={user.authToken}
              decks={decks}
              materias={materias}
              loading={loading}
              setDecks={setDecks}
              setMaterias={setMaterias}
              loadDecks={loadDecks}
              loadMaterias={loadMaterias}
              currentDeck={currentDeck}
              setCurrentDeck={setCurrentDeck}
              initialMode={initialMode}
              setInitialMode={setInitialMode}
              onExitToStudy={handleExitToStudy}
              onInviteRequired={onInviteRequired}
              pendingNav={pendingLibraryNav}
              clearPendingNav={() => setPendingLibraryNav(null)}
              libraryFabHost={libraryFabHost}
            />
          )}

          {tab === 'general' && (
            <GeneralSection
              userId={user.id}
              dashboardShell={dashboardShell}
              onCalendarImmersiveChange={handleCalendarImmersiveChange}
            />
          )}

          {tab === 'home-settings' && (
            <SettingsSection userId={user.id} section="home" onBack={() => handleTabChange('usuario')} />
          )}

          {tab === 'ai-settings' && (
            <SettingsSection userId={user.id} section="ai" onBack={() => handleTabChange('usuario')} />
          )}

          {tab === 'invite-codes' && (
            <InviteCodeManager
              authToken={user.authToken}
              onBack={() => handleTabChange('usuario')}
            />
          )}

          {tab === 'usuario' && (
            <UserSection 
              user={user} 
              onLogout={onLogout} 
              onOpenAiSettings={() => handleTabChange('ai-settings')}
              onOpenHomeSettings={() => handleTabChange('home-settings')}
              onOpenInviteCodes={() => handleTabChange('invite-codes')}
              onBackHome={() => handleTabChange('home')}
            />
          )}
        </div>

      </main>

      {/* 👇 MENÚ DE NAVEGACIÓN MÓVIL OPTIMIZADO (Se oculta en modo edición de mazo) 👇 */}
      {!isEditingDeck && !isCalendarImmersive && (
        <div ref={mobileNavRef} className="md:hidden absolute inset-x-0 mx-auto flex h-[4.25rem] w-fit max-w-[calc(100%_-_1rem)] items-center gap-[clamp(0.375rem,2vw,0.5rem)] rounded-full border border-slate-200 bg-white px-[clamp(0.375rem,2vw,0.5rem)] shadow-[0_8px_32px_rgba(15,23,42,0.12)] backdrop-blur-xl z-40 animate-[slideUp_0.2s_ease-out]" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}>
          {[
            { id: 'home', title: 'Inicio', Icon: Home },
            { id: 'study', title: 'Estudio', Icon: BookOpen },
            { id: 'library', title: 'Biblioteca', Icon: Library },
            { id: 'general', title: 'General', Icon: LayoutGrid }
          ].map((item) => {
            const isActive = tab === item.id;
            const IconComponent = item.Icon;

            return (
              <button
                type="button"
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                aria-label={item.title}
                aria-current={isActive ? 'page' : undefined}
                className={`flex h-[3.25rem] items-center justify-center rounded-full text-black transition-all duration-200 cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 ${
                  isActive
                    ? 'gap-2 bg-[linear-gradient(135deg,#E4DCFA_0%,#D6CAF3_100%)] px-[clamp(0.75rem,4vw,1.125rem)] shadow-[0_6px_16px_rgba(96,78,140,0.12)] ring-1 ring-inset ring-[#B8A8DF]'
                    : 'w-[clamp(3rem,14.5vw,3.25rem)] bg-slate-100 hover:bg-slate-200'
                }`}
                title={item.title}
              >
                <IconComponent aria-hidden="true" className={`shrink-0 transition-all duration-200 ${
                  isActive ? 'h-6 w-6 stroke-[2.5]' : 'h-6 w-6 stroke-[1.8]'
                }`} />
                {isActive && (
                  <span className="whitespace-nowrap text-sm font-bold leading-none">
                    {item.title}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* DebugPanel (lazy-loaded) - rendered only when ?debug=true or in DEV */}
      {typeof window !== 'undefined' && (new URLSearchParams(window.location.search).get('debug') === 'true' || import.meta.env.DEV) && (
        <Suspense fallback={null}>
          <DebugPanel initialUserId={user?.id} initialDeckId={currentDeck?.id} />
        </Suspense>
      )}

    </div>
  );
}

function FlashcardsApp() {
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [isAppLoading, setIsAppLoading] = useState(false);
  const [pendingInvite, setPendingInvite] = useState(null);

  useEffect(() => {
    void preloadLuaLoadingVideo();
  }, []);

  const handleAppLoadingComplete = useCallback(() => {
    setIsAppLoading(false);
  }, []);

  usePendingReviewsFlush(user?.id);

  const handleSuccess = async (credentialResponse, inviteCode = '') => {
    setError('');
    const credential = credentialResponse?.credential;
    if (!credential) return { error: 'Google no devolvió una credencial válida.' };
    try {
      jwtDecode(credential);
      const res = await fetch(`${BACKEND_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Falló la verificación en el servidor.');

      if (data.needsInvite) {
        const normalizedInviteCode = inviteCode.trim();
        if (normalizedInviteCode) {
          const inviteResponse = await fetch(`${BACKEND_URL}/api/auth/redeem-invite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential, code: normalizedInviteCode }),
          });
          const inviteData = await inviteResponse.json().catch(() => ({}));
          if (!inviteResponse.ok) {
            return { inviteError: inviteData.error || 'No se pudo validar el código.' };
          }

          setUser({
            ...data.user,
            hasAccess: true,
            needsInvite: false,
            authToken: credential,
          });
          setIsAppLoading(true);
          return { success: true };
        }
        setPendingInvite({ credential, user: data.user });
        return { needsInvite: true };
      }

      setUser({ ...data.user, authToken: credential });
      setIsAppLoading(true);
      return { success: true };
    } catch (requestError) {
      const message = requestError.message || 'Falló la verificación en el servidor.';
      setError(message);
      return { error: message };
    }
  };
  const handleInviteRedeemed = () => {
    if (!pendingInvite) return;

    setUser({
      ...pendingInvite.user,
      hasAccess: true,
      needsInvite: false,
      authToken: pendingInvite.credential,
    });
    setPendingInvite(null);
    setIsAppLoading(true);
  };

  const handleInviteRequired = () => {
    if (!user?.authToken) return;

    setPendingInvite({
      credential: user.authToken,
      user: { ...user, hasAccess: false, needsInvite: true },
    });
    setIsAppLoading(false);
    setUser(null);
  };

  if (pendingInvite) {
    return (
      <InviteGateScreen
        credential={pendingInvite.credential}
        userEmail={pendingInvite.user.email}
        onRedeemed={handleInviteRedeemed}
        onCancel={() => setPendingInvite(null)}
      />
    );
  }

  if (user) {
    const handleLogout = () => {
      setIsAppLoading(false);
      setUser(null);
    };

    return (
      <>
        <DashboardScreen
          user={user}
          onLogout={handleLogout}
          onInviteRequired={handleInviteRequired}
        />
        {isAppLoading && <AppLoadingScreen onComplete={handleAppLoadingComplete} />}
      </>
    );
  }
  return <LoginScreen onSuccess={handleSuccess} onError={() => setError('Falló el inicio de sesión.')} error={error} />;
}

export default function App() {
  const publicMateriaShareId = getPublicMateriaShareId();

  if (publicMateriaShareId) {
    return <PublicMateriaPage shareId={publicMateriaShareId} />;
  }

  if (!GOOGLE_CLIENT_ID) return null;
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <FlashcardsApp />
    </GoogleOAuthProvider>
  );
}

// Exports nombrados mínimos para los harnesses locales de rendimiento y loading.
// No alteran el flujo normal: el entry productivo sigue consumiendo el default export.
export { AppLoadingScreen, DashboardScreen };
