import { useState, useEffect, useCallback } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { LogOut, Sparkles, Library, Settings, AlertCircle, Home } from 'lucide-react';

import LoginScreen from './components/LoginScreen';
import HomeSection from './components/HomeSection';
import LibrarySection from './components/LibrarySection';
import SettingsSection from './components/SettingsSection';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

function DashboardScreen({ user, onLogout }) {
  const [tab, setTab] = useState('home');

  // ⚡ ALINEACIÓN DE ARQUITECTURA: Elevamos los mazos al núcleo global para compartir caché
  const [decks, setDecks] = useState(() => {
    const cached = localStorage.getItem(`decks_${user.id}`);
    return cached ? JSON.parse(cached) : [];
  });
  const [loading, setLoading] = useState(() => {
    const cached = localStorage.getItem(`decks_${user.id}`);
    return !cached;
  });

  // Estados de navegación interna compartidos
  const [currentDeck, setCurrentDeck] = useState(null);
  const [initialMode, setInitialMode] = useState('edit');

  const loadDecks = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/decks/${user.id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDecks(data);
      localStorage.setItem(`decks_${user.id}`, JSON.stringify(data));
    } catch {
      /* fallback silencioso a caché */
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    loadDecks();
  }, [loadDecks]);

  // ⚡ ENRUTADOR MÁGICO: Abre el mazo directamente en Modo Repaso cambiando de pestaña
  const handleOpenReviewFromHome = (deck) => {
    setInitialMode('review');
    setCurrentDeck(deck);
    setTab('library');
  };

  const navItem = (id, label, Icon) => (
    <button
      onClick={() => setTab(id)}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
        tab === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );

  return (
    <div className="min-h-screen w-full bg-slate-50 flex" data-testid="dashboard-screen">
      {/* SIDEBAR (Escritorio) */}
      <aside className="hidden md:flex w-72 shrink-0 flex-col bg-white border-r border-slate-200 p-5">
        <div className="flex items-center gap-2 px-1 mb-8">
          <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-extrabold text-slate-900 text-lg">Flashcards</span>
        </div>

        <nav className="space-y-1.5">
          {navItem('home', 'Inicio', Home)}
          {navItem('library', 'Archivos', Library)}
          {navItem('settings', 'Ajustes', Settings)}
        </nav>

        <div className="mt-auto pt-5 border-t border-slate-100">
          <div className="flex items-center gap-3 px-1">
            <img src={user.picture} alt={user.name} referrerPolicy="no-referrer" className="w-9 h-9 rounded-full object-cover bg-slate-200" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 truncate">{user.name}</p>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
            </div>
          </div>
          <button onClick={onLogout} className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2.5 transition-colors">
            <LogOut className="w-4 h-4" /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* CONTENEDOR PRINCIPAL */}
      <main className="flex-1 min-w-0 relative">
        <div className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm">
          <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-slate-900 fill-slate-900" /> Flashcards
          </span>
          <button onClick={onLogout} className="p-1 text-slate-400 hover:text-red-600 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-4 pb-20 md:pb-8 md:px-6 md:py-8">
          {tab === 'home' && (
            <HomeSection 
              user={user} 
              decks={decks} 
              onOpenReview={handleOpenReviewFromHome} 
            />
          )}
          {tab === 'library' && (
            <LibrarySection 
              userId={user.id} 
              decks={decks}
              loading={loading}
              setDecks={setDecks}
              loadDecks={loadDecks}
              currentDeck={currentDeck}
              setCurrentDeck={setCurrentDeck}
              initialMode={initialMode}
              setInitialMode={setInitialMode}
            />
          )}
          {tab === 'settings' && <SettingsSection userId={user.id} />}
        </div>

        {/* BARRA INFERIOR MÓVIL */}
        <div className="md:hidden fixed bottom-0 inset-x-0 bg-white/90 backdrop-blur-md border-t border-slate-200/80 px-6 py-2 flex justify-around items-center z-40 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
          <button onClick={() => setTab('home')} className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-colors ${tab === 'home' ? 'text-slate-900 font-bold' : 'text-slate-400'}`}>
            <Home className="w-5 h-5" /> <span className="text-[10px]">Inicio</span>
          </button>
          <button onClick={() => setTab('library')} className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-colors ${tab === 'library' ? 'text-slate-900 font-bold' : 'text-slate-400'}`}>
            <Library className="w-5 h-5" /> <span className="text-[10px]">Archivos</span>
          </button>
          <button onClick={() => setTab('settings')} className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-colors ${tab === 'settings' ? 'text-slate-900 font-bold' : 'text-slate-400'}`}>
            <Settings className="w-5 h-5" /> <span className="text-[10px]">Ajustes</span>
          </button>
        </div>
      </main>
    </div>
  );
}

function FlashcardsApp() {
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');

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
  if (!GOOGLE_CLIENT_ID) return null;
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <FlashcardsApp />
    </GoogleOAuthProvider>
  );
}
