import { useState } from 'react';
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
  // La pestaña por defecto ahora es el Home (Inicio)
  const [tab, setTab] = useState('home');

  const navItem = (id, label, Icon) => (
    <button
      onClick={() => setTab(id)}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
        tab === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
      }`}
      data-testid={`nav-${id}`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );

  return (
    <div className="min-h-screen w-full bg-slate-50 flex" data-testid="dashboard-screen">
      {/* SIDEBAR (Escritorio - Queda intacto a la izquierda) */}
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
            <img
              src={user.picture}
              alt={user.name}
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-full object-cover bg-slate-200"
              data-testid="user-picture"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate" data-testid="user-name">
                {user.name}
              </p>
              <p className="text-xs text-slate-400 truncate" data-testid="user-email">
                {user.email}
              </p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2.5 transition-colors"
            data-testid="logout-button"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* CONTENEDOR PRINCIPAL */}
      <main className="flex-1 min-w-0 relative">
        {/* BARRA SUPERIOR MÓVIL: Simplificada, solo muestra la marca y botón de logout */}
        <div className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm">
          <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-slate-900 fill-slate-900" /> Flashcards
          </span>
          <button onClick={onLogout} className="p-1 text-slate-400 hover:text-red-600 transition-colors" data-testid="logout-button-mobile">
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* CONTENIDO DE LA APP: pb-20 añadido en móviles para que la barra inferior no tape nada */}
        <div className="max-w-5xl mx-auto px-4 py-4 pb-20 md:pb-8 md:px-6 md:py-8">
          {tab === 'home' && <HomeSection user={user} />}
          {tab === 'library' && <LibrarySection userId={user.id} />}
          {tab === 'settings' && <SettingsSection userId={user.id} />}
        </div>

        {/* 📱 BARRA DE NAVEGACIÓN INFERIOR (Fija en móviles tipo Dock) */}
        <div className="md:hidden fixed bottom-0 inset-x-0 bg-white/90 backdrop-blur-md border-t border-slate-200/80 px-6 py-2 flex justify-around items-center z-40 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
          <button
            onClick={() => setTab('home')}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-colors ${
              tab === 'home' ? 'text-slate-900 font-bold' : 'text-slate-400'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px]">Inicio</span>
          </button>

          <button
            onClick={() => setTab('library')}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-colors ${
              tab === 'library' ? 'text-slate-900 font-bold' : 'text-slate-400'
            }`}
          >
            <Library className="w-5 h-5" />
            <span className="text-[10px]">Archivos</span>
          </button>

          <button
            onClick={() => setTab('settings')}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-colors ${
              tab === 'settings' ? 'text-slate-900 font-bold' : 'text-slate-400'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="text-[10px]">Ajustes</span>
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
    if (!credential) {
      setError('No se recibió la credencial de Google.');
      return;
    }
    try {
      jwtDecode(credential);
    } catch {
      setError('No se pudo leer el token de Google.');
      return;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Falló la verificación en el servidor.');
      }
      const data = await res.json();
      setUser(data.user);
    } catch (e) {
      setError(e.message || 'Falló la verificación en el servidor.');
    }
  };

  const handleError = () => setError('El inicio de sesión con Google se canceló o falló.');

  const handleLogout = () => {
    setUser(null);
    setError('');
  };

  if (user) {
    return <DashboardScreen user={user} onLogout={handleLogout} />;
  }
  return <LoginScreen onSuccess={handleSuccess} onError={handleError} error={error} />;
}

export default function App() {
  if (!GOOGLE_CLIENT_ID) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md text-center bg-white border border-amber-200 rounded-2xl p-8" data-testid="missing-client-id">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-slate-900">Falta el Google Client ID</h1>
          <p className="mt-2 text-sm text-slate-500">
            Define <code className="font-mono">VITE_GOOGLE_CLIENT_ID</code> en el archivo{' '}
            <code className="font-mono">.env</code> del frontend.
          </p>
        </div>
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <FlashcardsApp />
    </GoogleOAuthProvider>
  );
}
