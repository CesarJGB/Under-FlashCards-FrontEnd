import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Download,
  Layers,
  Pencil,
  BookOpen,
  SlidersHorizontal,
  ImagePlus,
  Check,
  Plus,
  Loader2,
  Trash2,
  AlignLeft,
  AlignCenter,
  AlignRight
} from 'lucide-react';
import ReviewMode from './ReviewMode';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

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

export default function DeckInterior({ deck, userId, onBack }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [bgImage, setBgImage] = useState('');
  const [textAlign, setTextAlign] = useState('center');
  const [fontSize, setFontSize] = useState('text-base');
  const [showStyles, setShowStyles] = useState(false);
  
  // Estados para la funcionalidad de importación por texto plano sin IA interna
  const [isBulk, setIsBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');

  const [defaultStyles, setDefaultStyles] = useState({
    bgImage: '',
    textAlign: 'center',
    fontSize: 'text-base',
  });
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('edit');

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
    setBulkText('');
    setBgImage(defaultStyles.bgImage);
    setTextAlign(defaultStyles.textAlign);
    setFontSize(defaultStyles.fontSize);
    setEditingId(null);
  };

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

  const handleExport = async () => {
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/decks/${deck.id}/export`);
      if (!res.ok) throw new Error('No se pudo exportar el mazo.');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(deck.title || 'mazo').replace(/[^\w\s-]/g, '').trim() || 'mazo'}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

       // LÓGICA DE PROCESAMIENTO MASIVO EN LOTE (MUDADA A BATCHSTYLES)
    if (isBulk && !editingId) {
      const lines = bulkText.split('\n');
      const parsedCards = [];
      let currentQuestion = '';

      lines.forEach((line) => {
        const cleanLine = line.trim();
        if (/^[pP]\s*:/i.test(cleanLine)) {
          currentQuestion = cleanLine.replace(/^[pP]\s*:/i, '').trim();
        } 
        else if (/^[rR]\s*:/i.test(cleanLine)) {
          const currentAnswer = cleanLine.replace(/^[rR]\s*:/i, '').trim();
          if (currentQuestion && currentAnswer) {
            parsedCards.push({
              question: currentQuestion,
              answer: currentAnswer
              // YA NO PARAMETRIZAMOS LOS ESTILOS AQUÍ PARA EVITAR DUPLICAR EL BASE64
            });
            currentQuestion = '';
          }
        }
      });

      if (parsedCards.length === 0) {
        setError('No se encontraron bloques con el formato correcto (P: ... R: ...)');
        setSaving(false);
        return;
      }

      try {
        const res = await fetch(`${BACKEND_URL}/api/flashcards/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // ENVIAMOS LA IMAGEN UNA SOLA VEZ EN BATCHSTYLES ARRIBA DE LAS TARJETAS
          body: JSON.stringify({ 
            userId, 
            deckId: deck.id, 
            batchStyles: { bgImage, textAlign, fontSize }, 
            cards: parsedCards 
          }),
        });
        if (!res.ok) throw new Error('No se pudo guardar el lote de tarjetas.');
        const createdBatch = await res.json();
        setCards((prev) => [...createdBatch, ...prev]);
        resetForm();
        setIsBulk(false);
      } catch (err) {
        setError(err.message);
      } finally {
        setSaving(false);
      }
      return;
    }


    // LÓGICA TRADICIONAL DE TARJETA ÚNICA
    if (!question.trim() || !answer.trim()) { setSaving(false); return; }
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
    setIsBulk(false);
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

  const isDark = (hex) => {
    if (!hex || hex.length < 7) return false;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 140;
  };

  const headerDark = deck.coverImage || isDark(deck.coverColor);

  return (
    <div data-testid="deck-interior">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          data-testid="back-to-library"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a la Biblioteca
        </button>
        {mode === 'edit' && (
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            data-testid="export-deck-button"
          >
            <Download className="w-4 h-4" />
            Exportar mazo
          </button>
        )}
      </div>

      {mode === 'edit' && (
      <div
        className="mt-3 rounded-2xl p-5 border border-slate-200"
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
        <h2 className={`mt-1.5 text-xl font-extrabold drop-shadow ${headerDark ? 'text-white' : 'text-slate-900'}`}>
          {deck.title}
        </h2>
      </div>
      )}

      <div className="mt-4 w-full max-w-xl mx-auto flex justify-center px-2">
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 w-full sm:w-auto" data-testid="mode-tabs">
          <button
            type="button"
            onClick={() => setMode('edit')}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'edit' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Pencil className="w-4 h-4" /> Modo Edición
          </button>
          <button
            type="button"
            onClick={() => setMode('review')}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'review' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <BookOpen className="w-4 h-4" /> Modo Repaso
          </button>
        </div>
      </div>

      {mode === 'review' && <ReviewMode cards={cards} loading={loading} />}

      {mode === 'edit' && (
      <>
      <form
        onSubmit={handleSubmit}
        className="mt-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm"
        data-testid="flashcard-form"
      >
        <div className="flex items-center justify-between mb-3 border-b border-slate-50 pb-2">
          <p className="text-sm font-bold text-slate-700">
            {editingId ? 'Editar tarjeta' : isBulk ? 'Creación masiva por bloque de texto' : 'Nueva tarjeta'}
          </p>
          {!editingId && (
            <button
              type="button"
              onClick={() => { setIsBulk(!isBulk); setError(''); }}
              className="text-xs font-semibold text-slate-500 hover:text-slate-900 underline transition-colors"
            >
              {isBulk ? 'Volver a tarjeta única' : 'Cambiar a creación en lote'}
            </button>
          )}
        </div>

        {isBulk && !editingId ? (
          // INTERFAZ EN LOTE (TEXTAREA ÚNICO)
          <div className="animate-[fadeIn_0.2s_ease]">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              Pega tu texto estructurado abajo:
            </label>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"P: ¿Qué día fue teóricamente ayer?\nR: 20 de junio\n\nP: ¿Cuál es el número atómico del Hidrógeno?\nR: 1"}
              className="min-h-[160px] w-full font-mono text-xs rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 placeholder:text-slate-300"
            />
            <p className="mt-1.5 text-[10px] text-slate-400 leading-relaxed">
              * Puedes pedirle a cualquier IA externa que te formatee tus temas usando exactamente <code className="bg-slate-100 px-1 rounded font-mono">P:</code> para la pregunta y <code className="bg-slate-100 px-1 rounded font-mono">R:</code> para la respuesta. Cada par creará una carta automáticamente.
            </p>
          </div>
        ) : (
          // INTERFAZ TRADICIONAL (TARJETA ÚNICA)
          <div className="grid sm:grid-cols-2 gap-3 animate-[fadeIn_0.2s_ease]">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Pregunta</label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="¿Cuál es la capital de Francia?"
                className="min-h-[90px] w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                data-testid="flashcard-question-input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Respuesta</label>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="París"
                className="min-h-[90px] w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                data-testid="flashcard-answer-input"
              />
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowStyles((s) => !s)}
          className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
          data-testid="toggle-styles-button"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Opciones de estilo {isBulk && '(Se aplicarán a todo el lote)'}
        </button>

        {showStyles && (
          <div className="mt-3 grid sm:grid-cols-3 gap-4 border-t border-slate-100 pt-3" data-testid="style-controls">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Tamaño de letra</p>
            <div className="flex flex-wrap gap-1" data-testid="font-size-controls">
              {FONT_SIZES.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFontSize(f.value)}
                  className={`rounded-lg px-2 py-1 text-xs font-medium border transition-colors ${
                    fontSize === f.value
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Alineación</p>
            <div className="flex gap-1" data-testid="align-controls">
              {ALIGNS.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  title={label}
                  onClick={() => setTextAlign(value)}
                  className={`rounded-lg p-1.5 border transition-colors ${
                    textAlign === value
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Fondo</p>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50">
                <ImagePlus className="w-3.5 h-3.5" />
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
                >
                  Quitar
                </button>
              )}
            </div>
          </div>
        </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            disabled={saving || (isBulk ? !bulkText.trim() : (!question.trim() || !answer.trim()))}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-medium px-4 py-2"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : editingId ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            {editingId ? 'Guardar cambios' : isBulk ? 'Generar lote de tarjetas' : 'Agregar tarjeta'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
          )}
        </div>
        {error && <p className="mt-2 text-xs text-red-600" data-testid="deck-interior-error">{error}</p>}
      </form>

      <div className="mt-6 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tarjetas</h3>
        <span className="text-xs font-medium text-slate-400" data-testid="flashcard-count">
          {cards.length} en total
        </span>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-slate-400" data-testid="cards-loading">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
        </div>
      ) : cards.length === 0 ? (
        <div className="mt-4 text-center border border-dashed border-slate-300 rounded-2xl py-10 text-slate-400" data-testid="cards-empty">
          <Layers className="w-6 h-6 mx-auto mb-1.5" />
          Aún no hay tarjetas en este mazo.
        </div>
      ) : (
        <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="cards-grid">
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
                {hasBg && <span className="absolute inset-0 bg-black/55" data-testid="flashcard-overlay" />}

                <div className="relative z-10 p-4 pt-6">
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

                  <p className={`text-[10px] font-semibold uppercase tracking-wide ${hasBg ? 'text-white/70' : 'text-slate-400'}`}>
                    Pregunta
                  </p>
                  <p className={`mt-0.5 font-semibold whitespace-pre-wrap ${sizeClass} ${alignClass} ${hasBg ? 'text-white' : 'text-slate-900'}`}>
                    {card.question}
                  </p>

                  <div className={`my-3 border-t border-dashed ${hasBg ? 'border-white/30' : 'border-slate-200'}`} />

                  <p className={`text-[10px] font-semibold uppercase tracking-wide ${hasBg ? 'text-white/70' : 'text-slate-400'}`}>
                    Respuesta
                  </p>
                  <p className={`mt-0.5 whitespace-pre-wrap ${sizeClass} ${alignClass} ${hasBg ? 'text-white/90' : 'text-slate-700'}`}>
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
