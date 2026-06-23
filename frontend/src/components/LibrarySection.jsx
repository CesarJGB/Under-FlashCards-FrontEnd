// ARCHIVO: frontend/src/components/LibrarySection.jsx
import { useRef, useState, useMemo } from 'react';
import { Upload, Plus, Library, Loader2, Sparkles, Search, ArrowUpDown, Grid, List } from 'lucide-react';
import DeckCard from './DeckCard';
import DeckModal from './DeckModal';
import DeckInterior from './DeckInterior';

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
  const [fabOpen, setFabOpen] = useState(false);

  // 🔎 ESTADOS LOCALES DE BÚSQUEDA, ORDENAMIENTO Y VISTA
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent'); // 'recent' | 'oldest' | 'alpha' | 'cards-desc' | 'cards-asc'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'

  // 🧠 MOTOR DE FILTRADO Y ORDENAMIENTO COMPUTADO AUTOMÁTICO
  const processedDecks = useMemo(() => {
    // 1. Filtrado por Barra de Búsqueda de Mazos
    let result = decks.filter((deck) => 
      deck.title?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Helper robusto para extraer el número exacto de tarjetas del mazo
    const getCount = (d) => d.cardCount ?? d.cards?.length ?? d.cardsCount ?? 0;

    // 2. Aplicación de Criterios de Ordenamiento Estrictos
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

      {/* 🔍 PANEL DE CONTROLES (ACOPLADO DE FORMA PURA ABAJO DEL STICKY HEADER) */}
      {decks.length > 0 && (
        <div className="mt-2 flex flex-col md:flex-row gap-3 items-center justify-between bg-slate-50 border border-slate-200/60 p-3 rounded-2xl shadow-2xs">
          
          {/* Input de Búsqueda de Mazos */}
          <div className="relative w-full md:flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar mazo por título..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 placeholder:text-slate-400 shadow-3xs transition-all"
            />
          </div>

          {/* Grupo de Controles */}
          <div className="w-full md:w-auto flex flex-col sm:flex-row items-center gap-3 shrink-0">
            
            {/* Dropdown de Ordenamiento */}
            <div className="relative w-full sm:w-auto flex items-center gap-2">
              <label htmlFor="sort-decks" className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden lg:inline">
                Ordenar:
              </label>
              <div className="relative w-full sm:w-auto flex-1 sm:flex-initial">
                <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                <select
                  id="sort-decks"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full sm:w-48 pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none appearance-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 cursor-pointer shadow-3xs transition-all"
                >
                  <option value="recent">Más recientes</option>
                  <option value="oldest">Más antiguos</option>
                  <option value="alpha">Orden alfabético</option>
                  <option value="cards-desc">Mayor número de tarjetas</option>
                  <option value="cards-asc">Menor número de tarjetas</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">
                  ▼
                </div>
              </div>
            </div>

            {/* Alternador de Vista */}
            <div className="flex bg-slate-200/50 p-1 rounded-xl border border-slate-200/40 items-center w-full sm:w-auto justify-center shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'grid' ? 'bg-white text-slate-900 shadow-3xs' : 'text-slate-400 hover:text-slate-600'
                }`}
                title="Vista cuadrícula"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'list' ? 'bg-white text-slate-900 shadow-3xs' : 'text-slate-400 hover:text-slate-600'
                }`}
                title="Vista lista"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 🎴 RENDERIZADO CONDICIONAL DE LA COLECCIÓN */}
      {loading && decks.length === 0 ? (
        <div className="mt-8 flex items-center gap-2 text-slate-400" data-testid="decks-loading">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
        </div>
      ) : decks.length === 0 ? (
        <div className="mt-8 text-center border border-dashed border-slate-300 rounded-2xl py-16 text-slate-400" data-testid="decks-empty">
          <Library className="w-8 h-8 mx-auto mb-2" />
          Aún no tienes mazos. Crea tu primer mazo usando el botón inferior.
        </div>
      ) : processedDecks.length === 0 ? (
        <div className="mt-8 text-center border border-dashed border-slate-200 rounded-2xl py-14 bg-white text-slate-400 text-xs font-medium animate-[fadeIn_0.1s_ease]">
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

      {modal && (
        <DeckModal initial={modal.editing} onClose={() => setModal(null)} onSave={handleSaveDeck} />
      )}

      {/* 📱 MENU ACCION FLOTANTE (FAB) */}
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
              className="w-44 flex items-center justify-between bg-slate-800 text-white pl-3.5 pr-1.5 py-1.5 rounded-2xl text-xs font-bold shadow-lg hover:bg-slate-700 active:scale-95 transition-all border border-slate-700/50 cursor-pointer"
            >
              <span>Generar con IA</span>
              <div className="w-7 h-7 bg-slate-700/60 rounded-xl flex items-center justify-center shadow-inner">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              </div>
            </button>

            <button
              onClick={() => { setFabOpen(false); fileInputRef.current?.click(); }}
              disabled={importing}
              className="w-44 flex items-center justify-between bg-white text-slate-700 border border-slate-200/80 pl-3.5 pr-1.5 py-1.5 rounded-2xl text-xs font-bold shadow-lg hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
            >
              <span>Importar mazo</span>
              <div className="w-7 h-7 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100">
                {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" /> : <Upload className="w-3.5 h-3.5 text-slate-500" />}
              </div>
            </button>

            <button
              onClick={() => { setFabOpen(false); setModal({}); }}
              className="w-44 flex items-center justify-between bg-white text-slate-700 border border-slate-200/80 pl-3.5 pr-1.5 py-1.5 rounded-2xl text-xs font-bold shadow-lg hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
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
          className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-xl z-50 transition-all duration-200 active:scale-90 cursor-pointer ${
            fabOpen ? 'bg-slate-800 rotate-45' : 'bg-slate-900 hover:bg-slate-800 hover:scale-105'
          }`}
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
