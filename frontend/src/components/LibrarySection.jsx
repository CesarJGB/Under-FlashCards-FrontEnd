// ARCHIVO: frontend/src/components/LibrarySection.jsx
import { useRef, useState, useMemo } from 'react';
import { Upload, Plus, Library, Loader2, Sparkles, Search, MoreHorizontal, Grid, List, Check } from 'lucide-react';
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
  
  // ⚙️ ESTADO PARA EL NUEVO DROPDOWN UNIFICADO DE TRES PUNTOS
  const [optionsOpen, setOptionsOpen] = useState(false);

  // 🧠 MOTOR DE FILTRADO Y ORDENAMIENTO COMPUTADO AUTOMÁTICO
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

      {/* ✨ REINGENIERÍA DE BARRA DE CONTROLES (ESTILO COMPACTO CALCADO DE IMAGE_8.png) */}
      {decks.length > 0 && (
        <div className="mt-1.5 flex gap-2 items-center w-full relative">
          
          {/* Input de Búsqueda Súper Redondeado y Fluido */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar mazo por título..."
              className="w-full h-10 pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 placeholder:text-slate-400 shadow-3xs transition-all"
            />
          </div>

          {/* ⚙️ Botón de Tres Puntos Horizontales de Configuración de Filtros */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOptionsOpen(!optionsOpen)}
              className={`w-10 h-10 border text-slate-500 rounded-xl shadow-3xs transition-all active:scale-[0.97] flex items-center justify-center cursor-pointer ${
                optionsOpen ? 'bg-slate-100 border-slate-300 text-slate-900' : 'bg-white border-slate-200 hover:text-slate-900 hover:bg-slate-50'
              }`}
              title="Opciones de biblioteca"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {/* Desplegable Contextual Unificado (Sort + Grid View) */}
            {optionsOpen && (
              <>
                <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setOptionsOpen(false)} />
                <div className="absolute right-0 mt-2 w-60 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-1.5 animate-[slideUp_0.12s_ease-out] flex flex-col gap-0.5">
                  
                  {/* SECCIÓN 1: ORDENAMIENTO */}
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2.5 py-1 block">
                    Ordenar por
                  </span>
                  
                  {[
                    { label: 'Más recientes', value: 'recent' },
                    { label: 'Más antiguos', value: 'oldest' },
                    { label: 'Orden alfabético', value: 'alpha' },
                    { label: 'Mayor número de tarjetas', value: 'cards-desc' },
                    { label: 'Menor número de tarjetas', value: 'cards-asc' }
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { setSortBy(opt.value); setOptionsOpen(false); }}
                      className={`w-full text-left px-2.5 py-1.5 hover:bg-slate-50 text-[11px] font-bold rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                        sortBy === opt.value ? 'text-slate-950 bg-slate-50/60' : 'text-slate-600'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {sortBy === opt.value && <Check className="w-3.5 h-3.5 text-slate-900 stroke-[2.5]" />}
                    </button>
                  ))}

                  {/* SEPARATOR */}
                  <div className="my-1 border-t border-slate-100" />

                  {/* SECCIÓN 2: INTERCAMBIADOR DE VISTA */}
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2.5 py-1 block">
                    Visualización
                  </span>

                  <button
                    type="button"
                    onClick={() => { setViewMode('grid'); setOptionsOpen(false); }}
                    className={`w-full text-left px-2.5 py-1.5 hover:bg-slate-50 text-[11px] font-bold rounded-lg flex items-center gap-2 transition-colors cursor-pointer ${
                      viewMode === 'grid' ? 'text-slate-950 bg-slate-50/60' : 'text-slate-600'
                    }`}
                  >
                    <Grid className="w-3.5 h-3.5 text-slate-400" />
                    <span className="flex-1">Vista cuadrícula</span>
                    {viewMode === 'grid' && <Check className="w-3.5 h-3.5 text-slate-900 stroke-[2.5]" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setViewMode('list'); setOptionsOpen(false); }}
                    className={`w-full text-left px-2.5 py-1.5 hover:bg-slate-50 text-[11px] font-bold rounded-lg flex items-center gap-2 transition-colors cursor-pointer ${
                      viewMode === 'list' ? 'text-slate-950 bg-slate-50/60' : 'text-slate-600'
                    }`}
                  >
                    <List className="w-3.5 h-3.5 text-slate-400" />
                    <span className="flex-1">Vista lista</span>
                    {viewMode === 'list' && <Check className="w-3.5 h-3.5 text-slate-900 stroke-[2.5]" />}
                  </button>

                </div>
              </>
            )}
          </div>

        </div>
      )}

      {/* 🎴 RENDERIZADO DE LA COLECCIÓN */}
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
