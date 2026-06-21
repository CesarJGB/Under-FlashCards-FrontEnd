import { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, Plus, Library, Loader2 } from 'lucide-react';
import DeckCard from './DeckCard';
import DeckModal from './DeckModal';
import DeckInterior from './DeckInterior';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export default function LibrarySection({ userId }) {
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [currentDeck, setCurrentDeck] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

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

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed?.deck?.title) throw new Error('Formato de archivo inválido.');
      const res = await fetch(`${BACKEND_URL}/api/decks/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, deck: parsed.deck, cards: parsed.cards || [] }),
      });
      if (!res.ok) throw new Error('No se pudo importar el mazo.');
      await loadDecks();
    } catch (err) {
      setError(err.message || 'Archivo inválido o no se pudo importar.');
    } finally {
      setImporting(false);
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
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
            data-testid="import-file-input"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-slate-700 font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
            data-testid="import-deck-button"
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Importar mazo
          </button>
          <button
            onClick={() => setModal({})}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium px-5 py-2.5"
            data-testid="create-deck-button"
          >
            <Plus className="w-4 h-4" /> Nuevo mazo
          </button>
        </div>
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
