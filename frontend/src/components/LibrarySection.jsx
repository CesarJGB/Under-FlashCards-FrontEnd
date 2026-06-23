// ARCHIVO: frontend/src/components/LibrarySection.jsx
import { useRef, useState, useMemo } from 'react';
import { Library, Loader2 } from 'lucide-react';
import DeckCard from './DeckCard';
import DeckModal from './DeckModal';
import DeckInterior from './DeckInterior';
import LibraryToolbar from './library/LibraryToolbar';
import LibraryFAB from './library/LibraryFAB';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const ADMIN_EMAIL = "cesarjaviervebe@gmail.com"; 

export default function LibrarySection({ 
  userId, 
  userEmail, 
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

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [viewMode, setViewMode] = useState('grid');

  const isAdmin = userEmail === ADMIN_EMAIL;

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

  // CONTROLADOR 1: Compartir con permisos de edición total
  const handleToggleDefault = async (deck) => {
    const nextState = !deck.isDefault;
    
    const updatedDecks = decks.map((d) => 
      d.id === deck.id ? { ...d, isDefault: nextState, isPublicReadOnly: false } : d
    );
    setDecks(updatedDecks);
    localStorage.setItem(`decks_${userId}`, JSON.stringify(updatedDecks));

    try {
      const res = await fetch(`${BACKEND_URL}/api/decks/${deck.id}/default`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: nextState }),
      });
      if (!res.ok) throw new Error();
    } catch (err) {
      await loadDecks();
    }
  };

  // 🚀 CONTROLADOR 2: Compartir en modo Protegido de Solo Lectura
  const handleTogglePublicReadOnly = async (deck) => {
    const nextState = !deck.isPublicReadOnly;
    
    const updatedDecks = decks.map((d) => 
      d.id === deck.id ? { ...d, isPublicReadOnly: nextState, isDefault: false } : d
    );
    setDecks(updatedDecks);
    localStorage.setItem(`decks_${userId}`, JSON.stringify(updatedDecks));

    try {
      const res = await fetch(`${BACKEND_URL}/api/decks/${deck.id}/public-readonly`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublicReadOnly: nextState }),
      });
      if (!res.ok) throw new Error();
    } catch (err) {
      await loadDecks();
    }
  };

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
    } catch (e) {}
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
      if (!res.ok) throw new Error();
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
      if (!parsed?.deck?.title) throw new Error();
      await fetch(`${BACKEND_URL}/api/decks/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, deck: parsed.deck, cards: parsed.cards || [] }),
      });
      await loadDecks(true);
    } catch (err) {} finally { setImporting(false); }
  };

  if (currentDeck) {
    return (
      <DeckInterior
        deck={currentDeck}
        userId={userId}
        initialMode={initialMode}
        onBack={() => { setCurrentDeck(null); loadDecks(); }}
      />
    );
  }

  return (
    <div data-testid="library-section" className="relative min-h-[60vh]">
      <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />

      <div className="animate-[fadeIn_0.15s_ease]">
        {decks.length > 0 && (
          <LibraryToolbar
            searchQuery={searchQuery} setSearchQuery={setSearchQuery}
            sortBy={sortBy} setSortBy={setSortBy}
            viewMode={viewMode} setViewMode={setViewMode}
          />
        )}

        {loading && decks.length === 0 ? (
          <div className="mt-6 flex items-center gap-2 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
          </div>
        ) : decks.length === 0 ? (
          <div className="mt-6 text-center border border-dashed border-slate-300 rounded-2xl py-16 text-slate-400">
            Aún no tienes mazos. Crea tu primer mazo usando el botón inferior.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 pb-12">
            {processedDecks.map((deck) => (
              <DeckCard
                key={deck.id}
                deck={deck}
                currentUserId={userId}
                isAdmin={isAdmin}
                isList={viewMode === 'list'}
                onOpen={(d) => { setInitialMode('edit'); setCurrentDeck(d); }}
                onEdit={(d) => setModal({ editing: d })}
                onDelete={handleDeleteDeck}
                onToggleStar={handleToggleStar}
                onToggleDefault={handleToggleDefault}
                onTogglePublicReadOnly={handleTogglePublicReadOnly} // 👈 Inyección de prop
              />
            ))}
          </div>
        )}
      </div>

      {modal && <DeckModal initial={modal.editing} onClose={() => setModal(null)} onSave={handleSaveDeck} />}
      <LibraryFAB setModal={setModal} fileInputRef={fileInputRef} importing={importing} />
    </div>
  );
}
