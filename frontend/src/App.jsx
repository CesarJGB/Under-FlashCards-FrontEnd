import { useState, useEffect, useCallback } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import {
  LogOut,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  BookOpen,
  Settings,
  Plus,
  Loader2,
  KeyRound,
  Check,
  Layers,
} from 'lucide-react';

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS,
// THIS BREAKS THE AUTH. Values come from .env (Vite import.meta.env).
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

// -----------------------------------------------------------------------------
// Login screen
// -----------------------------------------------------------------------------
function LoginScreen({ onSuccess, onError, error }) {
  return (
    <div
      className="min-h-screen w-full flex items-center justify-center bg-slate-50 px-4"
      data-testid="login-screen"
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-900 mb-5">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Flashcards</h1>
          <p className="mt-2 text-slate-500">Sign in to start studying smarter.</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
          <p className="text-sm font-medium text-slate-700 text-center mb-6">
            Continue with your Google account
          </p>
          <div className="flex justify-center" data-testid="google-login-button">
            <GoogleLogin
              onSuccess={onSuccess}
              onError={onError}
              theme="outline"
              size="large"
              shape="pill"
              text="continue_with"
            />
          </div>
          {error && (
            <div
              className="mt-5 flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3"
              data-testid="login-error"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Study section: create form + grid
// -----------------------------------------------------------------------------
function StudySection({ userId }) {
  const [cards, setCards] = useState([]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadCards = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/flashcards/${userId}`);
      if (!res.ok) throw new Error('Could not load flashcards.');
      setCards(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/flashcards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, question, answer }),
      });
      if (!res.ok) throw new Error('Could not save the flashcard.');
      const created = await res.json();
      setCards((prev) => [created, ...prev]);
      setQuestion('');
      setAnswer('');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="study-section">
      <h2 className="text-2xl font-bold text-slate-900">Study</h2>
      <p className="text-slate-500 mt-1">Create cards and review your deck.</p>

      {/* Create form */}
      <form
        onSubmit={handleCreate}
        className="mt-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm"
        data-testid="flashcard-form"
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Question</label>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What is the capital of France?"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              data-testid="flashcard-question-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Answer</label>
            <input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Paris"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              data-testid="flashcard-answer-input"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={saving || !question.trim() || !answer.trim()}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium px-5 py-2.5 transition-colors"
          data-testid="flashcard-submit-button"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add flashcard
        </button>
        {error && (
          <p className="mt-3 text-sm text-red-600" data-testid="study-error">
            {error}
          </p>
        )}
      </form>

      {/* Grid */}
      <div className="mt-8 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Your cards
        </h3>
        <span
          className="text-sm font-medium text-slate-400"
          data-testid="flashcard-count"
        >
          {cards.length} total
        </span>
      </div>

      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-slate-400" data-testid="cards-loading">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : cards.length === 0 ? (
        <div
          className="mt-6 text-center border border-dashed border-slate-300 rounded-2xl py-12 text-slate-400"
          data-testid="cards-empty"
        >
          <Layers className="w-8 h-8 mx-auto mb-2" />
          No flashcards yet. Create your first one above.
        </div>
      ) : (
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="cards-grid">
          {cards.map((card) => (
            <div
              key={card.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow"
              data-testid="flashcard-item"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Question
              </p>
              <p className="mt-1 font-semibold text-slate-900">{card.question}</p>
              <div className="my-4 border-t border-slate-100" />
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Answer
              </p>
              <p className="mt-1 text-slate-700">{card.answer}</p>
              <p className="mt-4 text-xs text-slate-400">ease {card.easeFactor}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Settings section: AI API key
// -----------------------------------------------------------------------------
function SettingsSection({ userId }) {
  const [apiKey, setApiKey] = useState('');
  const [masked, setMasked] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/user/${userId}`);
        if (res.ok) {
          const data = await res.json();
          setHasKey(data.hasApiKey);
          setMasked(data.apiKeyMasked || '');
        }
      } catch {
        /* ignore */
      }
    })();
  }, [userId]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/user/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, aiApiKey: apiKey }),
      });
      if (!res.ok) throw new Error('Could not save the API key.');
      const data = await res.json();
      setHasKey(data.hasApiKey);
      setMasked(data.apiKeyMasked || '');
      setApiKey('');
      setSaved(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="settings-section">
      <h2 className="text-2xl font-bold text-slate-900">Settings</h2>
      <p className="text-slate-500 mt-1">Manage your personal AI API key.</p>

      <form
        onSubmit={handleSave}
        className="mt-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm max-w-xl"
        data-testid="settings-form"
      >
        <label className="block text-sm font-medium text-slate-700 mb-1.5">AI API Key</label>
        <div className="relative">
          <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={hasKey ? `Saved: ${masked}` : 'sk-...'}
            className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-2.5 text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
            data-testid="api-key-input"
          />
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Stored securely on the server and never shown again in full.
        </p>

        <button
          type="submit"
          disabled={saving || !apiKey.trim()}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium px-5 py-2.5 transition-colors"
          data-testid="api-key-save-button"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Save key
        </button>

        {saved && (
          <p className="mt-3 text-sm text-green-600" data-testid="settings-saved">
            API key saved.
          </p>
        )}
        {error && (
          <p className="mt-3 text-sm text-red-600" data-testid="settings-error">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Dashboard (replaces ProfileScreen)
// -----------------------------------------------------------------------------
function DashboardScreen({ user, verified, onLogout }) {
  const [tab, setTab] = useState('study');

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
      {/* Sidebar */}
      <aside className="hidden md:flex w-72 shrink-0 flex-col bg-white border-r border-slate-200 p-5">
        <div className="flex items-center gap-2 px-1 mb-8">
          <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-extrabold text-slate-900 text-lg">Flashcards</span>
        </div>

        <nav className="space-y-1.5">
          {navItem('study', 'Study', BookOpen)}
          {navItem('settings', 'Settings', Settings)}
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
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        {/* Mobile top bar with tabs */}
        <div className="md:hidden sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <span className="font-extrabold text-slate-900">Flashcards</span>
          <div className="flex gap-2">
            <button onClick={() => setTab('study')} data-testid="nav-study-mobile">
              <BookOpen className={`w-5 h-5 ${tab === 'study' ? 'text-slate-900' : 'text-slate-400'}`} />
            </button>
            <button onClick={() => setTab('settings')} data-testid="nav-settings-mobile">
              <Settings className={`w-5 h-5 ${tab === 'settings' ? 'text-slate-900' : 'text-slate-400'}`} />
            </button>
            <button onClick={onLogout} data-testid="logout-button-mobile">
              <LogOut className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex items-center justify-end mb-4">
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1 ${
                verified
                  ? 'bg-green-50 text-green-700 border border-green-100'
                  : 'bg-amber-50 text-amber-700 border border-amber-100'
              }`}
              data-testid="verification-badge"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {verified ? 'Verified session' : 'Verifying…'}
            </span>
          </div>

          {tab === 'study' ? (
            <StudySection userId={user.id} />
          ) : (
            <SettingsSection userId={user.id} />
          )}
        </div>
      </main>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Auth shell
// -----------------------------------------------------------------------------
function FlashcardsApp() {
  const [user, setUser] = useState(null);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');

  const handleSuccess = async (credentialResponse) => {
    setError('');
    const credential = credentialResponse?.credential;
    if (!credential) {
      setError('No credential received from Google.');
      return;
    }

    // Decode locally for instant feedback (name/picture).
    try {
      jwtDecode(credential);
    } catch {
      setError('Could not read Google token.');
      return;
    }

    // Verify on backend (source of truth) — returns persisted user with Mongo id.
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Server verification failed.');
      }
      const data = await res.json();
      setUser(data.user);
      setVerified(true);
    } catch (e) {
      setVerified(false);
      setError(e.message || 'Backend verification failed.');
    }
  };

  const handleError = () => setError('Google sign-in was cancelled or failed.');

  const handleLogout = () => {
    setUser(null);
    setVerified(false);
    setError('');
  };

  if (user) {
    return <DashboardScreen user={user} verified={verified} onLogout={handleLogout} />;
  }

  return <LoginScreen onSuccess={handleSuccess} onError={handleError} error={error} />;
}

export default function App() {
  if (!GOOGLE_CLIENT_ID) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div
          className="max-w-md text-center bg-white border border-amber-200 rounded-2xl p-8"
          data-testid="missing-client-id"
        >
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-slate-900">Google Client ID missing</h1>
          <p className="mt-2 text-sm text-slate-500">
            Set <code className="font-mono">VITE_GOOGLE_CLIENT_ID</code> in your frontend{' '}
            <code className="font-mono">.env</code> file.
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
