// ARCHIVO: frontend/src/components/App.jsx
import { useState, useEffect, useCallback } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { LogOut, Sparkles, Library, Settings, Home } from 'lucide-react';

import LoginScreen from './components/LoginScreen';
import HomeSection from './components/HomeSection';
import LibrarySection from './components/LibrarySection';
import SettingsSection from './components/SettingsSection';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

function DashboardScreen({ user, onLogout }) {
  const [tab, setTab] = useState('home');

  // Cache local optimista para Mazos
  const [decks, setDecks] = useState(() => {
    const cached = localStorage.getItem(`decks_${user.id}`);
    return cached ? JSON.parse(cached) : [];
  });

  // NUEVO: Cache local optimista para Materias (Jerarquía principal)
  const [materias, setMaterias] = useState(() => {
    const cached = localStorage.getItem(`materias_${user.id}`);
    return cached ? JSON.parse(cached) : [];
  });

  const [loading, setLoading] = useState(() => {
    const cachedDecks = localStorage.getItem(`decks_${user.id}`);
    const cachedMaterias = localStorage.getItem(`materias_${user.id}`);
    return !cachedDecks || !cachedMaterias;
  });

  const [currentDeck, setCurrentDeck] = useState(null);
  const [initialMode, setInitialMode] = useState('edit');

  // Sincronización en segundo plano de Mazos (Rompe caché del navegador mediante ?t=...)
  const loadDecks = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/decks/${user.id}?t=${Date.now()}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDecks(data);
      localStorage.setItem(`decks_${user.id}`, JSON.stringify(data));
    } catch {
      /* fallback silencioso a caché local */
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  // NUEVO: Sincronización en segundo plano de Materias (0ms latencia percibida)
  const loadMaterias = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/academic/materias/${user.id}?t=${Date.now()}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMaterias(data);
      localStorage.setItem(`materias_${user.id}`, JSON.stringify(data));
    } catch {
      /* fallback silencioso a caché local */
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  // Efecto de carga inicial paralela
  useEffect(() => {
    Promise.all([loadDecks(), loadMaterias()]);
  }, [loadDecks, loadMaterias]);

  const handleTabChange = (id) => {
    if (id === 'library') {
      setCurrentDeck(null);
      setInitialMode('edit');
    }
    setTab(id);
  };

  const handleOpenReviewFromHome = (deck) => {
    setInitialMode('review');
    setCurrentDeck(deck);
    setTab('library');
  };

  const navItem = (id, label, Icon) => (
    <button
      onClick={() => handleTabChange(id)}
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
        <div className="flex items-center gap-2 px-1 mb-8 h-9 min-w-0">
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
        {/* HEADER SUPERIOR MÓVIL */}
        <div className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3.5 flex items-center justify-between shadow-xs">
          <span className="min-w-0 max-w-[80%]">
            {currentDeck && tab === 'library' ? (
              <span className="font-black text-slate-900 text-base border-l-4 border-slate-900 pl-2.5 block truncate">
                {currentDeck.title}
              </span>
            ) : (
              <span className="font-black text-slate-900 tracking-tight text-base block animate-[fadeIn_0.1s_ease]">
                {tab === 'library' ? 'Archivos' : tab === 'home' ? 'Inicio' : 'Ajustes'}
              </span>
            )}
          </span>

          {tab === 'home' && (
            <button 
              onClick={onLogout} 
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50/50 rounded-lg transition-colors shrink-0 animate-[fadeIn_0.12s_ease] cursor-pointer"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* CONTENIDO INTERNO */}
        <div className="max-w-5xl mx-auto px-4 py-4 pb-24 md:pb-8 md:px-6 md:py-8">
          {tab === 'home' && (
            <HomeSection 
              user={user} 
              decks={decks} 
              materias={materias}
              onOpenReview={handleOpenReviewFromHome}
              onLogout={onLogout}
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
            />
          )}
          {tab === 'settings' && <SettingsSection userId={user.id} />}
        </div>

        {/* BARRA INFERIOR MÓVIL */}
        <div className="md:hidden fixed bottom-5 inset-x-4 max-w-xs mx-auto bg-white/85 backdrop-blur-xl border border-slate-200/60 h-14 rounded-full px-2 flex justify-between items-center z-40 shadow-[0_8px_30px_rgb(0,0,0,0.08)] animate-[slideUp_0.2s_ease-out]">
          {[
            { id: 'home', title: 'Inicio', Icon: Home },
            { id: 'library', title: 'Archivos', Icon: Library },
            { id: 'settings', title: 'Ajustes', Icon: Settings }
          ].map((item) => {
            const isActive = tab === item.id;
            const IconComponent = item.Icon;
            
            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`h-10 flex items-center justify-center transition-all duration-200 rounded-full relative flex-1 cursor-pointer ${
                  isActive 
                    ? 'bg-slate-900 text-white font-bold px-6 shadow-2xs' 
                    : 'text-slate-400 hover:text-slate-600 px-4'
                }`}
                title={item.title}
              >
                <IconComponent className={`w-4 h-4 transition-transform duration-200 ${isActive ? 'scale-105 stroke-[2.3]' : 'stroke-[1.8]'}`} />
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}

// ... El envoltorio FlashcardsApp y la exportación de App se mantienen exactamente iguales ...
