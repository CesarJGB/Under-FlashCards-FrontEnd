import { useState } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { LogOut, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS,
// THIS BREAKS THE AUTH. Values come from .env (Vite import.meta.env).
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

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
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Flashcards
          </h1>
          <p className="mt-2 text-slate-500">
            Sign in to start studying smarter.
          </p>
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

        <p className="mt-6 text-center text-xs text-slate-400">
          Your token is verified securely on the server.
        </p>
      </div>
    </div>
  );
}

function ProfileScreen({ user, verified, onLogout }) {
  return (
    <div
      className="min-h-screen w-full flex items-center justify-center bg-slate-50 px-4"
      data-testid="profile-screen"
    >
      <div className="w-full max-w-md">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="h-24 bg-slate-900" />
          <div className="px-8 pb-8 -mt-12">
            <img
              src={user.picture}
              alt={user.name}
              referrerPolicy="no-referrer"
              className="w-24 h-24 rounded-full ring-4 ring-white object-cover bg-slate-200"
              data-testid="user-picture"
            />
            <h2
              className="mt-4 text-2xl font-bold text-slate-900"
              data-testid="user-name"
            >
              {user.name}
            </h2>
            <p className="text-slate-500" data-testid="user-email">
              {user.email}
            </p>

            <div
              className={`mt-5 inline-flex items-center gap-2 text-sm font-medium rounded-full px-3 py-1 ${
                verified
                  ? 'bg-green-50 text-green-700 border border-green-100'
                  : 'bg-amber-50 text-amber-700 border border-amber-100'
              }`}
              data-testid="verification-badge"
            >
              <ShieldCheck className="w-4 h-4" />
              {verified
                ? 'Verified by backend'
                : 'Verifying on server…'}
            </div>

            <button
              onClick={onLogout}
              className="mt-8 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 transition-colors"
              data-testid="logout-button"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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

    // 1) Decode the JWT locally to show name + picture immediately.
    try {
      const decoded = jwtDecode(credential);
      setUser({
        id: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture,
      });
    } catch (e) {
      setError('Could not read Google token.');
      return;
    }

    // 2) Verify the token on the backend (source of truth).
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

  const handleError = () => {
    setError('Google sign-in was cancelled or failed.');
  };

  const handleLogout = () => {
    setUser(null);
    setVerified(false);
    setError('');
  };

  if (user) {
    return (
      <ProfileScreen
        user={user}
        verified={verified}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <LoginScreen
      onSuccess={handleSuccess}
      onError={handleError}
      error={error}
    />
  );
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
          <h1 className="text-lg font-bold text-slate-900">
            Google Client ID missing
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Set <code className="font-mono">VITE_GOOGLE_CLIENT_ID</code> in your
            frontend <code className="font-mono">.env</code> file.
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
