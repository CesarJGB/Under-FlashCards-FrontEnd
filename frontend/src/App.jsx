import { useState, useEffect, useCallback, useRef } from 'react';
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
  AlignLeft,
  AlignCenter,
  AlignRight,
  SlidersHorizontal,
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

// Literal Tailwind classes so the JIT keeps them in the build.
const FONT_SIZES = [
  { label: 'Pequeña', value: 'text-sm' },
  { label: 'Normal', value: 'text-base' },
  { label: 'Grande', value: 'text-lg' },
  { label: 'Extra Grande', value: 'text-xl' },
];
const ALIGNS = [
  { label: 'Izquierda', value: 'left', Icon: AlignLeft },
  { label: 'Centro', value: 'center', Icon: AlignCenter },
  { label: 'Derecha', value: 'right', Icon: AlignRight },
];
const ALIGN_CLASS = { left: 'text-left', center: 'text-center', right: 'text-right' };

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const isDark = (hex) => {
  if (!hex || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 140;
};

// -----------------------------------------------------------------------------
// Login
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
          <p className="mt-2 text-slate-500">Inicia sesión para estudiar mejor.</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
          <p className="text-sm font-medium text-slate-700 text-center mb-6">
            Continúa con tu cuenta de Google
          </p>
          <div className="flex justify-center" data-testid="google-login-button">
            <GoogleLogin
              onSuccess={onSuccess}
              onError={onError}
              theme="outline"
              size="large"
              shape="pill"
              text="continue_with"
              locale="es"
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
      setError('La imagen es muy grande (máx. 1.5MB).');
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
      setError(err.message || 'No se pudo guardar el mazo.');
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
            {initial ? 'Editar mazo' : 'Nuevo mazo'}
          </h3>
          <button onClick={onClose} data-testid="deck-modal-close" className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Título</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Biología 101"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
            data-testid="deck-title-input"
          />

          <label className="block text-sm font-medium text-slate-700 mt-4 mb-2">Color de portada</label>
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

          <label className="block text-sm font-medium text-slate-700 mt-4 mb-2">Imagen de portada (opcional)</label>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 cursor-pointer rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
              <ImagePlus className="w-4 h-4" />
              Subir
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
                <img src={coverImage} alt="portada" className="w-10 h-10 rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => setCoverImage('')}
                  className="text-xs text-red-600 hover:underline"
                  data-testid="deck-image-remove"
                >
                  Quitar
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
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium px-5 py-2.5"
              data-testid="deck-save-button"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Deck cover card
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
          {deck.cardCount ?? 0} {deck.cardCount === 1 ? 'tarjeta' : 'tarjetas'}
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
// Modo Repaso — carrusel de estudio
// -----------------------------------------------------------------------------
function ReviewMode({ cards, loading }) {
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const touchStartX = useRef(null);

  useEffect(() => {
    if (index > cards.length - 1) setIndex(Math.max(0, cards.length - 1));
  }, [cards.length, index]);

  if (loading) {
    return (
      <div className="mt-8 flex items-center gap-2 text-slate-400" data-testid="review-loading">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div
        className="mt-8 text-center border border-dashed border-slate-300 rounded-2xl py-16 text-slate-400"
        data-testid="review-empty"
      >
        <BookOpen className="w-8 h-8 mx-auto mb-2" />
        No hay tarjetas para repasar en este mazo
      </div>
    );
  }

  const card = cards[index];
  const hasBg = !!card.bgImage;
  const alignClass = ALIGN_CLASS[card.textAlign] || 'text-center';
  const sizeClass = card.fontSize || 'text-base';
  const cardStyle = hasBg
    ? { backgroundImage: `url(${card.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {};
  const progress = ((index + 1) / cards.length) * 100;

  const goPrev = () => {
    setIndex((i) => (i - 1 + cards.length) % cards.length);
    setShowAnswer(false);
  };
  const goNext = () => {
    setIndex((i) => (i + 1) % cards.length);
    setShowAnswer(false);
  };

  const onTouchStart = (e) => {
    touchStartX.current = e.changedTouches[0].clientX;
  };
  const onTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) {
      if (dx < 0) goNext();
      else goPrev();
    }
    touchStartX.current = null;
  };

  return (
    <div className="mt-8" data-testid="review-mode">
      <p className="text-center text-sm font-medium text-slate-500" data-testid="review-counter">
        Tarjeta {index + 1} de {cards.length}
      </p>

      <div className="relative mt-4 max-w-2xl mx-auto">
        {/* Flechas (escritorio) */}
        <button
          onClick={goPrev}
          className="hidden sm:flex absolute -left-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center rounded-full bg-white border border-slate-200 shadow hover:bg-slate-50 transition-colors"
          data-testid="review-prev"
        >
          <ChevronLeft className="w-5 h-5 text-slate-700" />
        </button>
        <button
          onClick={goNext}
          className="hidden sm:flex absolute -right-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center rounded-full bg-white border border-slate-200 shadow hover:bg-slate-50 transition-colors"
          data-testid="review-next"
        >
          <ChevronRight className="w-5 h-5 text-slate-700" />
        </button>

        {/* Tarjeta */}
        <div
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          style={cardStyle}
          className="relative rounded-3xl border border-slate-200 shadow-lg overflow-hidden bg-white min-h-[340px] flex flex-col select-none"
          data-testid="review-card"
        >
          {/* Barra de progreso */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-black/10 z-20">
            <div
              className="h-full bg-slate-900/80 transition-all duration-300"
              style={{ width: `${progress}%` }}
              data-testid="review-progress"
            />
          </div>

          {hasBg && <span className="absolute inset-0 bg-black/55" />}

          {/* Detalle del llavero */}
          <span className="absolute top-4 left-1/2 -translate-x-1/2 w-10 h-2.5 rounded-full bg-slate-400/40 z-10" />

          <div className="relative z-10 flex-1 flex flex-col justify-center p-8 pt-10">
            <p
              className={`text-xs font-semibold uppercase tracking-widest ${alignClass} ${
                hasBg ? 'text-white/70' : 'text-slate-400'
              }`}
            >
              {showAnswer ? 'Respuesta' : 'Pregunta'}
            </p>
            <div key={`${index}-${showAnswer}`} className="mt-3 animate-[fadeIn_0.25s_ease]">
              <p
                className={`font-semibold whitespace-pre-wrap ${sizeClass} ${alignClass} ${
                  hasBg ? 'text-white' : 'text-slate-900'
                }`}
                data-testid="review-text"
              >
                {showAnswer ? card.answer : card.question}
              </p>
            </div>
          </div>

          <div className="relative z-10 p-6 pt-0">
            <button
              onClick={() => setShowAnswer((s) => !s)}
              className={`w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 font-medium transition-colors ${
                hasBg ? 'bg-white/90 text-slate-900 hover:bg-white' : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
              data-testid="flip-card-button"
            >
              <RotateCw className="w-4 h-4" />
              {showAnswer ? 'Mostrar Pregunta' : 'Voltear tarjeta'}
            </button>
          </div>
        </div>

        {/* Flechas (móvil) */}
        <div className="sm:hidden mt-4 flex justify-between">
          <button
            onClick={goPrev}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-white border border-slate-200 shadow"
            data-testid="review-prev-mobile"
          >
            <ChevronLeft className="w-5 h-5 text-slate-700" />
          </button>
          <button
            onClick={goNext}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-white border border-slate-200 shadow"
            data-testid="review-next-mobile"
          >
            <ChevronRight className="w-5 h-5 text-slate-700" />
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Deck interior — editor con estilos + grid de tarjetas
// -----------------------------------------------------------------------------
function DeckInterior({ deck, userId, onBack }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [bgImage, setBgImage] = useState('');
  const [textAlign, setTextAlign] = useState('center');
  const [fontSize, setFontSize] = useState('text-base');
  const [showStyles, setShowStyles] = useState(false);
  // Estilos "pegajosos" para crear tarjetas en lote sin reconfigurar.
  const [defaultStyles, setDefaultStyles] = useState({
    bgImage: '',
    textAlign: 'center',
    fontSize: 'text-base',
  });
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('edit'); // 'edit' | 'review'

  const loadCards = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/flashcards/deck/${deck.id}`);
      if (!res.ok) throw new Error('No se pudieron cargar las tarjetas.');
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
    // Recupera los estilos predeterminados persistentes (no los de la tarjeta editada).
    setBgImage(defaultStyles.bgImage);
    setTextAlign(defaultStyles.textAlign);
    setFontSize(defaultStyles.fontSize);
    setEditingId(null);
  };

  // Mientras se crea (no se edita), recuerda los estilos elegidos como predeterminados.
  useEffect(() => {
    if (editingId === null) {
      setDefaultStyles({ bgImage, textAlign, fontSize });
    }
  }, [bgImage, textAlign, fontSize, editingId]);

  const handleBgFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 700 * 1024) {
      setError('La imagen es muy grande (máx. 700KB).');
      return;
    }
    setError('');
    setBgImage(await fileToBase64(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    setSaving(true);
    setError('');
    const body = { question, answer, bgImage, textAlign, fontSize };
    try {
      if (editingId) {
        const res = await fetch(`${BACKEND_URL}/api/flashcards/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('No se pudo actualizar la tarjeta.');
        const updated = await res.json();
        setCards((prev) => prev.map((c) => (c.id === editingId ? updated : c)));
        // Al terminar la edición, recupera los estilos predeterminados persistentes.
        resetForm();
      } else {
        const res = await fetch(`${BACKEND_URL}/api/flashcards`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, deckId: deck.id, ...body }),
        });
        if (!res.ok) throw new Error('No se pudo crear la tarjeta.');
        const created = await res.json();
        setCards((prev) => [created, ...prev]);
        // Crear en lote: limpia solo el texto y MANTÉN los estilos.
        setQuestion('');
        setAnswer('');
      }
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
    setBgImage(card.bgImage || '');
    setTextAlign(card.textAlign || 'center');
    setFontSize(card.fontSize || 'text-base');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (card) => {
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/flashcards/${card.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('No se pudo eliminar la tarjeta.');
      setCards((prev) => prev.filter((c) => c.id !== card.id));
      if (editingId === card.id) resetForm();
    } catch (e) {
      setError(e.message);
    }
  };

  const headerDark = deck.coverImage || isDark(deck.coverColor);

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
            headerDark ? 'bg-white/85 text-slate-900' : 'bg-slate-900/10 text-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" /> Mazo
        </span>
        <h2 className={`mt-2 text-2xl font-extrabold drop-shadow ${headerDark ? 'text-white' : 'text-slate-900'}`}>
          {deck.title}
        </h2>
      </div>

      {/* Selector de modo */}
      <div className="mt-5 inline-flex rounded-xl border border-slate-200 bg-white p-1" data-testid="mode-tabs">
        <button
          type="button"
          onClick={() => setMode('edit')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            mode === 'edit' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
          }`}
          data-testid="mode-edit-tab"
        >
          <Pencil className="w-4 h-4" /> Modo Edición
        </button>
        <button
          type="button"
          onClick={() => setMode('review')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            mode === 'review' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
          }`}
          data-testid="mode-review-tab"
        >
          <BookOpen className="w-4 h-4" /> Modo Repaso
        </button>
      </div>

      {mode === 'review' && <ReviewMode cards={cards} loading={loading} />}

      {mode === 'edit' && (
      <>
      {/* Editor */}
      <form
        onSubmit={handleSubmit}
        className="mt-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm"
        data-testid="flashcard-form"
      >
        <p className="text-sm font-semibold text-slate-700 mb-3">
          {editingId ? 'Editar tarjeta' : 'Nueva tarjeta'}
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Pregunta</label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="¿Cuál es la capital de Francia?"
              className="min-h-[100px] w-full resize-y rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              data-testid="flashcard-question-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Respuesta</label>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="París"
              className="min-h-[100px] w-full resize-y rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              data-testid="flashcard-answer-input"
            />
          </div>
        </div>

        {/* Opciones de estilo (progressive disclosure) */}
        <button
          type="button"
          onClick={() => setShowStyles((s) => !s)}
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
          data-testid="toggle-styles-button"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Opciones de estilo
        </button>

        {showStyles && (
          <div className="mt-4 grid sm:grid-cols-3 gap-5" data-testid="style-controls">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Tamaño de letra</p>
            <div className="flex flex-wrap gap-1.5" data-testid="font-size-controls">
              {FONT_SIZES.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFontSize(f.value)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-colors ${
                    fontSize === f.value
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                  data-testid={`font-size-${f.value}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Alineación</p>
            <div className="flex gap-1.5" data-testid="align-controls">
              {ALIGNS.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  title={label}
                  onClick={() => setTextAlign(value)}
                  className={`rounded-lg p-2 border transition-colors ${
                    textAlign === value
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                  data-testid={`align-${value}`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Fondo</p>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50">
                <ImagePlus className="w-4 h-4" />
                Imagen
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleBgFile}
                  className="hidden"
                  data-testid="flashcard-bg-input"
                />
              </label>
              {bgImage && (
                <button
                  type="button"
                  onClick={() => setBgImage('')}
                  className="text-xs text-red-600 hover:underline"
                  data-testid="flashcard-bg-remove"
                >
                  Quitar
                </button>
              )}
            </div>
          </div>
        </div>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="submit"
            disabled={saving || !question.trim() || !answer.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium px-5 py-2.5"
            data-testid="flashcard-submit-button"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {editingId ? 'Guardar cambios' : 'Agregar tarjeta'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-slate-700 hover:bg-slate-50"
              data-testid="flashcard-cancel-edit"
            >
              Cancelar
            </button>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-red-600" data-testid="deck-interior-error">{error}</p>}
      </form>

      {/* Grid de tarjetas */}
      <div className="mt-8 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Tarjetas</h3>
        <span className="text-sm font-medium text-slate-400" data-testid="flashcard-count">
          {cards.length} en total
        </span>
      </div>

      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-slate-400" data-testid="cards-loading">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
        </div>
      ) : cards.length === 0 ? (
        <div className="mt-6 text-center border border-dashed border-slate-300 rounded-2xl py-12 text-slate-400" data-testid="cards-empty">
          <Layers className="w-8 h-8 mx-auto mb-2" />
          Aún no hay tarjetas en este mazo.
        </div>
      ) : (
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="cards-grid">
          {cards.map((card) => {
            const hasBg = !!card.bgImage;
            const alignClass = ALIGN_CLASS[card.textAlign] || 'text-center';
            const sizeClass = card.fontSize || 'text-base';
            const cardStyle = hasBg
              ? { backgroundImage: `url(${card.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : {};
            return (
              <div
                key={card.id}
                style={cardStyle}
                className="relative rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden bg-white"
                data-testid="flashcard-item"
              >
                {/* Overlay oscuro para legibilidad cuando hay imagen */}
                {hasBg && <span className="absolute inset-0 bg-black/55" data-testid="flashcard-overlay" />}

                <div className="relative z-10 p-5 pt-7">
                  <span className="absolute top-2 left-1/2 -translate-x-1/2 w-7 h-1.5 rounded-full bg-slate-400/40" />
                  <div className="flex justify-end gap-1 mb-1">
                    <button
                      onClick={() => handleEdit(card)}
                      className={`p-1.5 rounded-lg ${hasBg ? 'text-white hover:bg-white/20' : 'text-slate-500 hover:bg-slate-100'}`}
                      data-testid="flashcard-edit-button"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(card)}
                      className={`p-1.5 rounded-lg ${hasBg ? 'text-red-300 hover:bg-white/20' : 'text-red-600 hover:bg-red-50'}`}
                      data-testid="flashcard-delete-button"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className={`text-xs font-semibold uppercase tracking-wide ${hasBg ? 'text-white/70' : 'text-slate-400'}`}>
                    Pregunta
                  </p>
                  <p className={`mt-1 font-semibold whitespace-pre-wrap ${sizeClass} ${alignClass} ${hasBg ? 'text-white' : 'text-slate-900'}`}>
                    {card.question}
                  </p>

                  <div className={`my-4 border-t border-dashed ${hasBg ? 'border-white/30' : 'border-slate-200'}`} />

                  <p className={`text-xs font-semibold uppercase tracking-wide ${hasBg ? 'text-white/70' : 'text-slate-400'}`}>
                    Respuesta
                  </p>
                  <p className={`mt-1 whitespace-pre-wrap ${sizeClass} ${alignClass} ${hasBg ? 'text-white/90' : 'text-slate-700'}`}>
                    {card.answer}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Biblioteca
// -----------------------------------------------------------------------------
function LibrarySection({ userId }) {
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [currentDeck, setCurrentDeck] = useState(null);

  const loadDecks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/decks/${userId}`);
      if (!res.ok) throw new Error('No se pudieron cargar los mazos.');
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
    if (!res.ok) throw new Error('No se pudo guardar el mazo.');
    const saved = await res.json();
    setDecks((prev) =>
      editing ? prev.map((d) => (d.id === saved.id ? { ...d, ...saved } : d)) : [saved, ...prev]
    );
    setModal(null);
  };

  const handleDeleteDeck = async (deck) => {
    if (!window.confirm(`¿Eliminar el mazo "${deck.title}" y todas sus tarjetas?`)) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/decks/${deck.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('No se pudo eliminar el mazo.');
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
          <p className="text-slate-500 mt-1">Tus mazos de estudio.</p>
        </div>
        <button
          onClick={() => setModal({})}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium px-5 py-2.5"
          data-testid="create-deck-button"
        >
          <Plus className="w-4 h-4" /> Nuevo mazo
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-red-600" data-testid="library-error">{error}</p>}

      {loading ? (
        <div className="mt-8 flex items-center gap-2 text-slate-400" data-testid="decks-loading">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
        </div>
      ) : decks.length === 0 ? (
        <div className="mt-8 text-center border border-dashed border-slate-300 rounded-2xl py-16 text-slate-400" data-testid="decks-empty">
          <Library className="w-8 h-8 mx-auto mb-2" />
          Aún no tienes mazos. Crea tu primer mazo.
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
        <DeckModal initial={modal.editing} onClose={() => setModal(null)} onSave={handleSaveDeck} />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Ajustes
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
      if (!res.ok) throw new Error('No se pudo guardar la clave.');
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
      <h2 className="text-2xl font-bold text-slate-900">Ajustes</h2>
      <p className="text-slate-500 mt-1">Administra tu clave de API de IA.</p>

      <form
        onSubmit={handleSave}
        className="mt-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm max-w-xl"
        data-testid="settings-form"
      >
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Clave de API de IA</label>
        <div className="relative">
          <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={hasKey ? `Guardada: ${masked}` : 'sk-...'}
            className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-2.5 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
            data-testid="api-key-input"
          />
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Se guarda de forma segura en el servidor y nunca se muestra completa de nuevo.
        </p>

        <button
          type="submit"
          disabled={saving || !apiKey.trim()}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium px-5 py-2.5"
          data-testid="api-key-save-button"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Guardar clave
        </button>

        {saved && <p className="mt-3 text-sm text-green-600" data-testid="settings-saved">Clave guardada.</p>}
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
              {verified ? 'Sesión verificada' : 'Verificando…'}
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
// Auth shell (lógica de autenticación SIN cambios)
// -----------------------------------------------------------------------------
function FlashcardsApp() {
  const [user, setUser] = useState(null);
  const [verified, setVerified] = useState(false);
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
      setVerified(true);
    } catch (e) {
      setVerified(false);
      setError(e.message || 'Falló la verificación en el servidor.');
    }
  };

  const handleError = () => setError('El inicio de sesión con Google se canceló o falló.');

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
