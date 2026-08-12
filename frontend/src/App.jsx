// FILE: frontend/src/App.jsx
import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
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

const DebugPanel = lazy(() => import('./components/DebugPanel'));

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const INITIAL_APP_LOADING_DURATION = 2500;

function AppLoadingScreen() {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-white"
      role="status"
      aria-live="polite"
      data-testid="app-loading-screen"
    >
      <div className="flex flex-col items-center gap-4 text-slate-700">
        <Sparkles className="h-8 w-8 animate-pulse text-slate-900" aria-hidden="true" />
        <p className="text-sm font-medium">Preparando tu espacio...</p>
      </div>
    </div>
  );
}

function DashboardScreen({ user, onLogout, onInviteRequired }) {
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

  const [decks, setDecks] = useState(() => getJSON(`decks_${user.id}`) || []);

  const [materias, setMaterias] = useState(() => getJSON(`materias_${user.id}`) || []);

  const [loading, setLoading] = useState(() => {
    const cachedDecks = getJSON(`decks_${user.id}`);
    const cachedMaterias = getJSON(`materias_${user.id}`);
    return !cachedDecks || !cachedMaterias;
  });

  const [currentDeck, setCurrentDeck] = useState(null);
  const [initialMode, setInitialMode] = useState('edit');

  // 💡 Determinamos si se está en el editor de un mazo en la biblioteca
  const isEditingDeck = tab === 'library' && currentDeck !== null && initialMode === 'edit';

  const loadDecks = useCallback(async (showSpinner = false, signal) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/decks/${user.id}?t=${Date.now()}`, { 
        signal,
        headers: {
          'X-User-Id': user.id
        }
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDecks(data);
      setJSON(`decks_${user.id}`, data);
    } catch {
      /* fallback silencioso a caché local */
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  const loadMaterias = useCallback(async (showSpinner = false, signal) => {
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
    } catch {
      /* fallback silencioso a caché local */
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
        {/* Home, biblioteca, perfil y sus ajustes gestionan sus controles dentro de su contenido. */}
        {tab === 'general' && !isCalendarImmersive && (
          <div className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3.5 flex items-center justify-between shadow-xs">
            <span className="min-w-0 max-w-[80%]">
              <span className="font-black text-slate-900 tracking-tight text-base block animate-[fadeIn_0.1s_ease]">
                General
              </span>
            </span>

          </div>
        )}

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
                    ? 'gap-2 bg-violet-200 px-[clamp(0.75rem,4vw,1.125rem)] shadow-sm ring-1 ring-inset ring-violet-300'
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
    if (!isAppLoading) return undefined;

    const timeoutId = window.setTimeout(() => {
      setIsAppLoading(false);
    }, INITIAL_APP_LOADING_DURATION);

    return () => window.clearTimeout(timeoutId);
  }, [isAppLoading]);

  usePendingReviewsFlush(user?.id);

  const handleSuccess = async (credentialResponse) => {
    setError('');
    const credential = credentialResponse?.credential;
    if (!credential) return;
    try {
      jwtDecode(credential);
      const res = await fetch(`${BACKEND_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();

      if (data.needsInvite) {
        setPendingInvite({ credential, user: data.user });
        return;
      }

      setUser({ ...data.user, authToken: credential });
      setIsAppLoading(true);
    } catch {
      setError('Falló la verificación en el servidor.');
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
        {isAppLoading && <AppLoadingScreen />}
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
