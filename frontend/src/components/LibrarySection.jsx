import { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, Plus, Library, Loader2, Sparkles } from 'lucide-react';
import DeckCard from './DeckCard';
import DeckModal from './DeckModal';
import DeckInterior from './DeckInterior';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export default function LibrarySection({ userId }) {
  // ⚡ OPTIMIZACIÓN: Inicializa los mazos directo desde el caché local si existen
  const [decks, setDecks] = useState(() => {
    const cached = localStorage.getItem(`decks_${userId}`);
    return cached ? JSON.parse(cached) : [];
  });

  // ⚡ OPTIMIZACIÓN: Si ya hay caché, no mostramos el spinner de carga inicial
  const [loading, setLoading] = useState(() => {
    const cached = localStorage.getItem(`decks_${userId}`);
    return !cached; 
  });

  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [currentDeck, setCurrentDeck] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);
  const [fabOpen, setFabOpen] = useState(false);

  // Carga silenciosa en segundo plano (Stale-While-Revalidate)
  const loadDecks = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/decks/${userId}`);
      if (!res.ok) throw new Error('No se pudieron cargar los mazos.');
      const data = await res.json();
      
      setDecks(data);
      // Actualiza el almacenamiento local con los datos más recientes del servidor
      localStorage.setItem(`decks_${userId}`, JSON.stringify(data));
    } catch (e) {
      // Si la red falla pero tenemos datos locales, no bloqueamos al estudiante
      if (decks.length === 0) setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [userId, decks.length]);

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
    
    const updatedDecks = editing 
      ? decks.map((d) => (d.id === saved.id ? { ...d, ...saved } : d))
      : [saved, ...decks];

    setDecks(updatedDecks);
    localStorage.setItem(`decks_${userId}`, JSON.stringify(updatedDecks));
    setModal(null);
  };

  const handleDeleteDeck = async (deck) => {
    if (!window.confirm(`¿Eliminar el mazo "${deck.title}" y todas sus tarjetas?`)) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/decks/${deck.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('No se pudo eliminar el mazo.');
      
      const updatedDecks = decks.filter((d) => d.id !== deck.id);
      setDecks(updatedDecks);
      localStorage.setItem(`decks_${userId}`, JSON.stringify(updatedDecks));
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
      
      // Forzamos recarga desde el servidor para traer el mazo importado con sus contadores reales
      await loadDecks(true);
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
    <div data-testid="library-section" className="relative min-h-[60vh]">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImport}
        className="hidden"
        data-testid="import-file-input"
      />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Biblioteca</h2>
          <p className="text-slate-500 mt-1">Tus mazos de estudio.</p>
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
          Aún no tienes mazos. Crea tu primer mazo usando el botón inferior.
        </div>
      ) : (
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-12" data-testid="decks-grid">
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

      {/* 📱 MENU ACCION FLOTANTE SIMÉTRICO (FAB) */}
      <div className="fixed bottom-20 right-4 md:bottom-8 md:right-8 z-50 flex flex-col items-end gap-2">
        {fabOpen && (
          <div
            onClick={() => setFabOpen(false)}
            className="fixed inset-0 bg-slate-900/10 backdrop-blur-xs z-40 animate-[fadeIn_0.15s_ease]"
          />
        )}

        {fabOpen && (
          <div className="flex flex-col items-end gap-2 z-50 mb-2 animate-[slideUp_0.15s_ease-out]">
            <button
              onClick={() => { setFabOpen(false); }}
              className="w-44 flex items-center justify-between bg-slate-800 text-white pl-3.5 pr-1.5 py-1.5 rounded-2xl text-xs font-bold shadow-lg hover:bg-slate-700 active:scale-95 transition-all border border-slate-700/50"
            >
              <span>Generar con IA</span>
              <div className="w-7 h-7 bg-slate-700/60 rounded-xl flex items-center justify-center shadow-inner">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              </div>
            </button>

            <button
              onClick={() => { setFabOpen(false); fileInputRef.current?.click(); }}
              disabled={importing}
              className="w-44 flex items-center justify-between bg-white text-slate-700 border border-slate-200/80 pl-3.5 pr-1.5 py-1.5 rounded-2xl text-xs font-bold shadow-lg hover:bg-slate-50 active:scale-95 transition-all"
            >
              <span>Importar mazo</span>
              <div className="w-7 h-7 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100">
                {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" /> : <Upload className="w-3.5 h-3.5 text-slate-500" />}
              </div>
            </button>

            <button
              onClick={() => { setFabOpen(false); setModal({}); }}
              className="w-44 flex items-center justify-between bg-white text-slate-700 border border-slate-200/80 pl-3.5 pr-1.5 py-1.5 rounded-2xl text-xs font-bold shadow-lg hover:bg-slate-50 active:scale-95 transition-all"
            >
              <span>Nuevo mazo</span>
              <div className="w-7 h-7 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100">
                <Plus className="w-3.5 h-3.5 text-slate-500" />
              </div>
            </button>
          </div>
        )}

        <button
          onClick={() => setFabOpen(!fabOpen)}
          className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-xl z-50 transition-all duration-200 active:scale-90 ${
            fabOpen ? 'bg-slate-800 rotate-45' : 'bg-slate-900 hover:bg-slate-800 hover:scale-105'
          }`}
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
