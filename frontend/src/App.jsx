// FILE: frontend/src/App.jsx
import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { getJSON, setJSON } from './lib/safeLocalStorage';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { LogOut, Sparkles, Library, Settings, Home, BookOpen, User, MessageSquare } from 'lucide-react';

import LoginScreen from './components/LoginScreen';
import usePendingReviewsFlush from './hooks/usePendingReviewsFlush';
import HomeSection from './components/HomeSection';
import StudySection from './components/StudySection';
import LibrarySection from './components/LibrarySection';
import SettingsSection from './components/SettingsSection';
import UserSection from './components/UserSection';
import ChatSection from './components/ChatSection';
import PublicMateriaPage from './components/PublicMateriaPage';
import { getPublicMateriaShareId } from './lib/publicMateria';

const DebugPanel = lazy(() => import('./components/DebugPanel'));

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

function DashboardScreen({ user, onLogout }) {
  const [tab, setTab] = useState('home');
  const [homeKey, setHomeKey] = useState(0);
  const mobileNavRef = useRef(null);
  const contentScrollRef = useRef(null);
  const [dashboardShell, setDashboardShell] = useState(null);
  
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

  const loadDecks = useCallback(async (showSpinner = false, signal) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/decks/${user.id}?t=${Date.now()}`, { 
        signal,
        headers: {
          'X-User-Id': user.id // 🔑 Pasamos la identidad del usuario requerida por tu backend
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
          'X-User-Id': user.id // 🔑 Pasamos la identidad del usuario requerida por tu backend
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

  const handleTabChange = (id) => {
    if (id === 'library') {
      setCurrentDeck(null);
      setInitialMode('edit');
      setPendingLibraryNav(null);
    }
    
    if (id === 'home') {
      setHomeKey(prev => prev + 1);
    }
    
    setTab(id);
  };

  // Ensure viewport resets to top when switching main tabs (SPA behavior)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // schedule on next frame to allow DOM updates
    requestAnimationFrame(() => {
      contentScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });
  }, [tab]);

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
    <div ref={setDashboardShell} className="relative h-full min-h-0 w-full overflow-hidden bg-slate-50 flex md:min-h-[100dvh] md:h-auto md:overflow-visible" data-testid="dashboard-screen">
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
          {navItem('chat', 'Chat', MessageSquare)}
        </nav>
      </aside>

      <main ref={contentScrollRef} className="relative flex-1 min-h-0 min-w-0 overflow-y-auto overscroll-contain md:min-h-[100dvh] md:overflow-visible">
        {/* Header móvil: oculto en 'home' para no pisar la UI propia que Home va a manejar (perfil, foto, nombre, etc.) */}
        {tab !== 'home' && (
          <div className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3.5 flex items-center justify-between shadow-xs">
            <span className="min-w-0 max-w-[80%]">
              {currentDeck && tab === 'library' ? (
                <span className="font-black text-slate-900 text-base border-l-4 border-slate-900 pl-2.5 block truncate">
                  {currentDeck.title}
                </span>
                ) : (
                <span className="font-black text-slate-900 tracking-tight text-base block animate-[fadeIn_0.1s_ease]">
                  {tab === 'library' ? 'Biblioteca' : tab === 'study' ? 'Modo de Estudio' : tab === 'usuario' ? 'Perfil' : tab === 'chat' ? 'Chat' : 'Ajustes'}
                </span>
              )}
            </span>

            {tab === 'usuario' && (
              <button
                type="button"
                onClick={() => handleTabChange('settings')}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors shrink-0 animate-[fadeIn_0.12s_ease] cursor-pointer"
                title="Ajustes"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        <div className={`max-w-5xl mx-auto px-4 pt-4 ${tab === 'home' ? 'pb-0' : 'pb-24'} md:px-6 md:pt-8 md:pb-8`}>
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
            />
          )}

          {tab === 'study' && (
            <StudySection 
              decks={decks}
              materias={materias}
              userId={user.id}
              userEmail={user.email}
              onOpenReview={handleOpenReviewFromStudy}
            />
          )}

          {tab === 'library' && (
            <LibrarySection
              userId={user.id}
              userEmail={user.email}
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
              pendingNav={pendingLibraryNav}
              clearPendingNav={() => setPendingLibraryNav(null)}
              dashboardShell={dashboardShell}
            />
          )}

          {tab === 'settings' && <SettingsSection userId={user.id} />}

          {tab === 'chat' && <ChatSection userId={user.id} />}

          {tab === 'usuario' && (
            <UserSection 
              user={user} 
              onLogout={onLogout} 
              onOpenSettings={() => handleTabChange('settings')}
            />
          )}
        </div>

      </main>

      {/* 👇 MENÚ DE NAVEGACIÓN MÓVIL OPTIMIZADO 👇 */}
      <div ref={mobileNavRef} className="md:hidden absolute inset-x-0 mx-auto w-fit bg-white/90 backdrop-blur-xl border border-slate-200/80 h-14 rounded-full px-2 flex items-center gap-1.5 z-40 shadow-[0_8px_32px_rgba(0,0,0,0.12)] animate-[slideUp_0.2s_ease-out]" style={{ bottom: '0.75rem' }}>
        {[
          { id: 'home', title: 'Inicio', Icon: Home },
          { id: 'study', title: 'Estudio', Icon: BookOpen },
          { id: 'library', title: 'Biblioteca', Icon: Library },
          { id: 'chat', title: 'Chat', Icon: MessageSquare }
        ].map((item) => {
          const isActive = tab === item.id;
          const IconComponent = item.Icon;

          return (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className={`h-10 px-4 flex items-center justify-center transition-all duration-200 rounded-full cursor-pointer active:scale-95 ${
                isActive
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/30'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              title={item.title}
            >
              <IconComponent className={`w-6 h-6 transition-all duration-200 ${
                isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'
              }`} />
            </button>
          );
        })}
      </div>

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
      setUser(data.user);
    } catch {
      setError('Falló la verificación en el servidor.');
    }
  };

  if (user) return <DashboardScreen user={user} onLogout={() => setUser(null)} />;
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
