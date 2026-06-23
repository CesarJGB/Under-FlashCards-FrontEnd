// ARCHIVO: frontend/src/components/LibrarySection.jsx
import { useRef, useState, useMemo } from 'react';
import { Library, Loader2 } from 'lucide-react';
import DeckCard from './DeckCard';
import DeckModal from './DeckModal';
import DeckInterior from './DeckInterior';

// 🔌 IMPORTACIÓN DE COMPONENTES MODULARES NUEVOS
import LibraryToolbar from './library/LibraryToolbar';
import LibraryFAB from './library/LibraryFAB';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export default function LibrarySection({ 
  userId, 
  decks, 
  loading, 
  setDecks, 
  loadDecks,
  currentDeck,
  setCurrentDeck,
  initialMode,
  setInitialMode
}) {
  const [modal, setModal] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  // 🔎 ESTADOS COMPARTIDOS DE CONTROL FILTRADO Y VISTA
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [viewMode, setViewMode] = useState('grid');

  // 🧠 MOTOR DE FILTRADO Y ORDENAMIENTO COMPUTADO AUTOMÁTICO (0ms Lag)
  const processedDecks = useMemo(() => {
    let result = decks.filter((deck) => 
      deck.title?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getCount = (d) => d.cardCount ?? d.cards?.length ?? d.cardsCount ?? 0;

    if (sortBy === 'recent') {
      result.sort((a, b) => new Date(b.createdAt || b.id) - new Date(a.createdAt || a.id));
    } else if (sortBy === 'oldest') {
      result.sort((a, b) => new Date(a.createdAt || a.id) - new Date(b.createdAt || b.id));
    } else if (sortBy === 'alpha') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'cards-desc') {
      result.sort((a, b) => getCount(b) - getCount(a));
    } else if (sortBy === 'cards-asc') {
      result.sort((a, b) => getCount(a) - getCount(b));
    }

    return result;
  }, [decks, searchQuery, sortBy]);

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
      // Fallback silencioso
    }
  };

  const handleToggleStar = async (deck) => {
    const nextState = !deck.isStarred;
    
    const updatedDecks = decks.map((d) => d.id === deck.id ? { ...d, isStarred: nextState } : d);
    setDecks(updatedDecks);
    localStorage.setItem(`decks_${userId}`, JSON.stringify(updatedDecks));

    try {
      const res = await fetch(`${BACKEND_URL}/api/decks/${deck.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isStarred: nextState }),
      });
      if (!res.ok) throw new Error('No se pudo actualizar el favorito.');
    } catch (err) {
      await loadDecks();
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
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
      await loadDecks(true);
    } catch (err) {
      /* ignore */
    } finally {
      setImporting(false);
    }
  };

  // Enrutamiento interno si hay un mazo abierto
  if (currentDeck) {
    return (
      <DeckInterior
        deck={currentDeck}
        userId={userId}
        initialMode={initialMode}
        onBack={() => {
          setCurrentDeck(null);
          loadDecks();
        }}
      />
    );
  }

  return (
    <div data-testid="library-section" className="relative min-h-[60vh] animate-[fadeIn_0.15s_ease]">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImport}
        className="hidden"
        data-testid="import-file-input"
      />

      {/* 🔍 BARRA DE HERRAMIENTAS MODULAR COMPACTA */}
      {decks.length > 0 && (
        <LibraryToolbar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          sortBy={sortBy}
          setSortBy={setSortBy}
          viewMode={viewMode}
          setViewMode={setViewMode}
        />
      )}

      {/* 🎴 RENDERIZADO DE LA COLECCIÓN DE MAZOS */}
      {loading && decks.length === 0 ? (
        <div className="mt-6 flex items-center gap-2 text-slate-400" data-testid="decks-loading">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
        </div>
      ) : decks.length === 0 ? (
        <div className="mt-6 text-center border border-dashed border-slate-300 rounded-2xl py-16 text-slate-400" data-testid="decks-empty">
          <Library className="w-8 h-8 mx-auto mb-2" />
          Aún no tienes mazos. Crea tu primer mazo usando el botón inferior.
        </div>
      ) : processedDecks.length === 0 ? (
        <div className="mt-6 text-center border border-dashed border-slate-200 rounded-2xl py-14 bg-white text-slate-400 text-xs font-medium animate-[fadeIn_0.1s_ease]">
          No se encontraron mazos que coincidan con la búsqueda.
        </div>
      ) : (
        <div 
          data-testid="decks-grid" 
          className={
            viewMode === 'grid'
              ? "mt-4 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 pb-12"
              : "mt-4 flex flex-col gap-3 pb-12"
          }
        >
          {processedDecks.map((deck) => (
            <DeckCard
              key={deck.id}
              deck={deck}
              isList={viewMode === 'list'}
              onOpen={(d) => { setInitialMode('edit'); setCurrentDeck(d); }}
              onEdit={(d) => setModal({ editing: d })}
              onDelete={handleDeleteDeck}
              onToggleStar={handleToggleStar}
            />
          ))}
        </div>
      )}

      {/* MODAL CONFIGURACIÓN DE MAZO */}
      {modal && (
        <DeckModal initial={modal.editing} onClose={() => setModal(null)} onSave={handleSaveDeck} />
      )}

      {/* 📱 MENÚ ACCIÓN FLOTANTE MODULAR (FAB) */}
      <LibraryFAB 
        setModal={setModal} 
        fileInputRef={fileInputRef} 
        importing={importing} 
      />
    </div>
  );
}
