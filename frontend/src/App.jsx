import { useState, useEffect, useCallback } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import {
  LogOut,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  Library,
  Settings,
  Plus,
  Loader2,
  KeyRound,
  Check,
  Layers,
  ArrowLeft,
  Pencil,
  Trash2,
  ImagePlus,
  X,
} from 'lucide-react';

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS,
// THIS BREAKS THE AUTH. Values come from .env (Vite import.meta.env).
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const COLOR_SWATCHES = [
  '#ffffff',
  '#fde68a',
  '#fca5a5',
  '#a7f3d0',
  '#93c5fd',
  '#c4b5fd',
  '#f9a8d4',
  '#1f2937',
];

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

// Pick readable text color over a light/dark cover color.
const isDark = (hex) => {
  if (!hex || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 140;
};

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
// Deck create/edit modal
// -----------------------------------------------------------------------------
function DeckModal({ initial, onClose, onSave }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [coverColor, setCoverColor] = useState(initial?.coverColor || '#ffffff');
  const [coverImage, setCoverImage] = useState(initial?.coverImage || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      setError('Image too large (max 1.5MB).');
      return;
    }
    setError('');
    setCoverImage(await fileToBase64(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError('');
    try {
      await onSave({ title: title.trim(), coverColor, coverImage });
    } catch (err) {
      setError(err.message || 'Could not save deck.');
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4"
      data-testid="deck-modal"
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-slate-900">
            {initial ? 'Edit deck' : 'New deck'}
          </h3>
          <button onClick={onClose} data-testid="deck-modal-close" className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Biology 101"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
            data-testid="deck-title-input"
          />

          <label className="block text-sm font-medium text-slate-700 mt-4 mb-2">Cover color</label>
          <div className="flex flex-wrap items-center gap-2" data-testid="deck-color-picker">
            {COLOR_SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCoverColor(c)}
                style={{ backgroundColor: c }}
                className={`w-8 h-8 rounded-full border ${
                  coverColor === c ? 'ring-2 ring-offset-2 ring-slate-900' : 'border-slate-200'
                }`}
              />
            ))}
            <input
              type="color"
              value={coverColor}
              onChange={(e) => setCoverColor(e.target.value)}
              className="w-8 h-8 rounded-full overflow-hidden cursor-pointer border border-slate-200"
              data-testid="deck-color-custom"
            />
          </div>

          <label className="block text-sm font-medium text-slate-700 mt-4 mb-2">Cover image (optional)</label>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 cursor-pointer rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
              <ImagePlus className="w-4 h-4" />
              Upload
              <input
                type="file"
                accept="image/*"
                onChange={handleFile}
                className="hidden"
                data-testid="deck-image-input"
              />
            </label>
            {coverImage && (
              <div className="flex items-center gap-2">
                <img src={coverImage} alt="cover" className="w-10 h-10 rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => setCoverImage('')}
                  className="text-xs text-red-600 hover:underline"
                  data-testid="deck-image-remove"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {error && <p className="mt-3 text-sm text-red-600" data-testid="deck-modal-error">{error}</p>}

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium px-5 py-2.5"
              data-testid="deck-save-button"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Deck cover card (library grid)
// -----------------------------------------------------------------------------
function DeckCard({ deck, onOpen, onEdit, onDelete }) {
  const dark = deck.coverImage ? true : isDark(deck.coverColor);
  const bgStyle = deck.coverImage
    ? { backgroundImage: `url(${deck.coverImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { backgroundColor: deck.coverColor };

  return (
    <button
      onClick={() => onOpen(deck)}
      style={bgStyle}
      className="group relative text-left h-44 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden"
      data-testid="deck-card"
    >
      {/* punch-hole detail to evoke a physical study keyring */}
      <span className="absolute top-3 left-1/2 -translate-x-1/2 w-8 h-2 rounded-full bg-black/15" />
      <span className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/55 to-transparent" />

      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onEdit(deck); }}
          className="p-1.5 rounded-lg bg-white/90 text-slate-700 hover:bg-white"
          data-testid="deck-edit-button"
        >
          <Pencil className="w-3.5 h-3.5" />
        </span>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onDelete(deck); }}
          className="p-1.5 rounded-lg bg-white/90 text-red-600 hover:bg-white"
          data-testid="deck-delete-button"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 p-4">
        <p className="font-bold text-white drop-shadow" data-testid="deck-title">
          {deck.title}
        </p>
        <p className="text-xs text-white/80">
          {deck.cardCount ?? 0} {deck.cardCount === 1 ? 'card' : 'cards'}
        </p>
      </div>

      {!deck.coverImage && !dark && (
        <span className="absolute top-4 left-4 text-slate-900/30">
          <Layers className="w-6 h-6" />
        </span>
      )}
    </button>
  );
}

// -----------------------------------------------------------------------------
// Deck interior — physical card vibe + flashcard CRUD
// -----------------------------------------------------------------------------
function DeckInterior({ deck, userId, onBack }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadCards = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/flashcards/deck/${deck.id}`);
      if (!res.ok) throw new Error('Could not load flashcards.');
      setCards(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [deck.id]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const resetForm = () => {
    setQuestion('');
    setAnswer('');
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        const res = await fetch(`${BACKEND_URL}/api/flashcards/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, answer }),
        });
        if (!res.ok) throw new Error('Could not update flashcard.');
        const updated = await res.json();
        setCards((prev) => prev.map((c) => (c.id === editingId ? updated : c)));
      } else {
        const res = await fetch(`${BACKEND_URL}/api/flashcards`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, deckId: deck.id, question, answer }),
        });
        if (!res.ok) throw new Error('Could not create flashcard.');
        const created = await res.json();
        setCards((prev) => [created, ...prev]);
      }
      resetForm();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (card) => {
    setEditingId(card.id);
    setQuestion(card.question);
    setAnswer(card.answer);
  };

  const handleDelete = async (card) => {
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/flashcards/${card.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not delete flashcard.');
      setCards((prev) => prev.filter((c) => c.id !== card.id));
      if (editingId === card.id) resetForm();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div data-testid="deck-interior">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        data-testid="back-to-library"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a la Biblioteca
      </button>

      <div
        className="mt-4 rounded-2xl p-6 border border-slate-200"
        style={
          deck.coverImage
            ? { backgroundImage: `url(${deck.coverImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : { backgroundColor: deck.coverColor }
        }
      >
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 ${
            deck.coverImage || isDark(deck.coverColor) ? 'bg-white/85 text-slate-900' : 'bg-slate-900/10 text-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" /> Deck
        </span>
        <h2
          className={`mt-2 text-2xl font-extrabold drop-shadow ${
            deck.coverImage || isDark(deck.coverColor) ? 'text-white' : 'text-slate-900'
          }`}
        >
          {deck.title}
        </h2>
      </div>

      {/* Create / edit form */}
      <form
        onSubmit={handleSubmit}
        className="mt-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm"
        data-testid="flashcard-form"
      >
        <p className="text-sm font-semibold text-slate-700 mb-3">
          {editingId ? 'Edit flashcard' : 'New flashcard'}
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Question"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
            data-testid="flashcard-question-input"
          />
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Answer"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
            data-testid="flashcard-answer-input"
          />
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            disabled={saving || !question.trim() || !answer.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium px-5 py-2.5"
            data-testid="flashcard-submit-button"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {editingId ? 'Save changes' : 'Add flashcard'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-slate-700 hover:bg-slate-50"
              data-testid="flashcard-cancel-edit"
            >
              Cancel
            </button>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-red-600" data-testid="deck-interior-error">{error}</p>}
      </form>

      {/* Flashcards list — physical study-card style */}
      <div className="mt-8 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Cards</h3>
        <span className="text-sm font-medium text-slate-400" data-testid="flashcard-count">
          {cards.length} total
        </span>
      </div>

      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-slate-400" data-testid="cards-loading">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : cards.length === 0 ? (
        <div className="mt-6 text-center border border-dashed border-slate-300 rounded-2xl py-12 text-slate-400" data-testid="cards-empty">
          <Layers className="w-8 h-8 mx-auto mb-2" />
          No cards in this deck yet.
        </div>
      ) : (
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="cards-grid">
          {cards.map((card) => (
            <div
              key={card.id}
              className="relative bg-white border border-slate-200 rounded-2xl p-5 pt-7 shadow-sm hover:shadow-md transition-shadow"
              data-testid="flashcard-item"
            >
              <span className="absolute top-2 left-1/2 -translate-x-1/2 w-7 h-1.5 rounded-full bg-slate-200" />
              <div className="flex justify-end gap-1 mb-1">
                <button
                  onClick={() => handleEdit(card)}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                  data-testid="flashcard-edit-button"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(card)}
                  className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                  data-testid="flashcard-delete-button"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Question</p>
              <p className="mt-1 font-semibold text-slate-900">{card.question}</p>
              <div className="my-4 border-t border-dashed border-slate-200" />
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Answer</p>
              <p className="mt-1 text-slate-700">{card.answer}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Library section — deck grid + modal + interior routing
// -----------------------------------------------------------------------------
function LibrarySection({ userId }) {
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // { editing?: deck }
  const [currentDeck, setCurrentDeck] = useState(null);

  const loadDecks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/decks/${userId}`);
      if (!res.ok) throw new Error('Could not load decks.');
      setDecks(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadDecks();
  }, [loadDecks]);

  const handleSaveDeck = async (payload) => {
    const editing = modal?.editing;
    const url = editing ? `${BACKEND_URL}/api/decks/${editing.id}` : `${BACKEND_URL}/api/decks`;
    const method = editing ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing ? payload : { userId, ...payload }),
    });
    if (!res.ok) throw new Error('Could not save deck.');
    const saved = await res.json();
    setDecks((prev) =>
      editing ? prev.map((d) => (d.id === saved.id ? { ...d, ...saved } : d)) : [saved, ...prev]
    );
    setModal(null);
  };

  const handleDeleteDeck = async (deck) => {
    if (!window.confirm(`Delete deck "${deck.title}" and all its cards?`)) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/decks/${deck.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not delete deck.');
      setDecks((prev) => prev.filter((d) => d.id !== deck.id));
    } catch (e) {
      setError(e.message);
    }
  };

  if (currentDeck) {
    return (
      <DeckInterior
        deck={currentDeck}
        userId={userId}
        onBack={() => {
          setCurrentDeck(null);
          loadDecks();
        }}
      />
    );
  }

  return (
    <div data-testid="library-section">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Biblioteca</h2>
          <p className="text-slate-500 mt-1">Your study decks.</p>
        </div>
        <button
          onClick={() => setModal({})}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium px-5 py-2.5"
          data-testid="create-deck-button"
        >
          <Plus className="w-4 h-4" /> New deck
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-red-600" data-testid="library-error">{error}</p>}

      {loading ? (
        <div className="mt-8 flex items-center gap-2 text-slate-400" data-testid="decks-loading">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : decks.length === 0 ? (
        <div className="mt-8 text-center border border-dashed border-slate-300 rounded-2xl py-16 text-slate-400" data-testid="decks-empty">
          <Library className="w-8 h-8 mx-auto mb-2" />
          No decks yet. Create your first deck.
        </div>
      ) : (
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="decks-grid">
          {decks.map((deck) => (
            <DeckCard
              key={deck.id}
              deck={deck}
              onOpen={setCurrentDeck}
              onEdit={(d) => setModal({ editing: d })}
              onDelete={handleDeleteDeck}
            />
          ))}
        </div>
      )}

      {modal && (
        <DeckModal
          initial={modal.editing}
          onClose={() => setModal(null)}
          onSave={handleSaveDeck}
        />
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
            className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-2.5 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
            data-testid="api-key-input"
          />
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Stored securely on the server and never shown again in full.
        </p>

        <button
          type="submit"
          disabled={saving || !apiKey.trim()}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium px-5 py-2.5"
          data-testid="api-key-save-button"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Save key
        </button>

        {saved && <p className="mt-3 text-sm text-green-600" data-testid="settings-saved">API key saved.</p>}
        {error && <p className="mt-3 text-sm text-red-600" data-testid="settings-error">{error}</p>}
      </form>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Dashboard
// -----------------------------------------------------------------------------
function DashboardScreen({ user, verified, onLogout }) {
  const [tab, setTab] = useState('library');

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
      <aside className="hidden md:flex w-72 shrink-0 flex-col bg-white border-r border-slate-200 p-5">
        <div className="flex items-center gap-2 px-1 mb-8">
          <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-extrabold text-slate-900 text-lg">Flashcards</span>
        </div>

        <nav className="space-y-1.5">
          {navItem('library', 'Biblioteca', Library)}
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

      <main className="flex-1 min-w-0">
        <div className="md:hidden sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <span className="font-extrabold text-slate-900">Flashcards</span>
          <div className="flex gap-3">
            <button onClick={() => setTab('library')} data-testid="nav-library-mobile">
              <Library className={`w-5 h-5 ${tab === 'library' ? 'text-slate-900' : 'text-slate-400'}`} />
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

          {tab === 'library' ? (
            <LibrarySection userId={user.id} />
          ) : (
            <SettingsSection userId={user.id} />
          )}
        </div>
      </main>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Auth shell (unchanged logic)
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
    try {
      jwtDecode(credential);
    } catch {
      setError('Could not read Google token.');
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
