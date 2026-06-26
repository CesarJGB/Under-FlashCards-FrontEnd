// ARCHIVO: frontend/src/components/LibrarySection.jsx
import { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { Library, Loader2, Folder, ChevronRight, ArrowLeft, Plus, Trash2, Layers, Bookmark } from 'lucide-react';
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
  materias, // 🚀 Inyectado desde App.jsx
  loading, 
  setDecks, 
  setMaterias, // 🚀 Inyectado desde App.jsx
  loadDecks,
  loadMaterias, // 🚀 Inyectado desde App.jsx
  currentDeck,
  setCurrentDeck,
  initialMode,
  setInitialMode
}) {
  // --- Estados de la Nueva Jerarquía ---
  const [currentPath, setCurrentPath] = useState({
    materiaId: null,
    parcialNumber: null,
    temaId: null,
    subtemaId: null
  });
  
  const [temas, setTemas] = useState([]);
  const [subtemas, setSubtemas] = useState([]);
  const [academicLoading, setAcademicLoading] = useState(false);
  
  // Estado único para creación de carpetas estructurales
  const [academicModal, setAcademicModal] = useState(null); // null o { type: 'materia'|'tema'|'subtema' }
  const [academicInput, setAcademicInput] = useState('');

  const [modal, setModal] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [viewMode, setViewMode] = useState('grid');

  const isAdmin = userEmail === ADMIN_EMAIL;

  // --- Efectos de Carga de sub-niveles (Temas y Subtemas) ---
  useEffect(() => {
    if (!currentPath.materiaId) {
      setTemas([]);
      return;
    }
    const fetchTemas = async () => {
      setAcademicLoading(true);
      try {
        const res = await fetch(`${BACKEND_URL}/api/academic/temas/${currentPath.materiaId}`);
        if (res.ok) {
          const data = await res.json();
          setTemas(data);
        }
      } catch (e) {} finally { setAcademicLoading(false); }
    };
    fetchTemas();
  }, [currentPath.materiaId]);

  useEffect(() => {
    if (!currentPath.temaId) {
      setSubtemas([]);
      return;
    }
    const fetchSubtemas = async () => {
      setAcademicLoading(true);
      try {
        const res = await fetch(`${BACKEND_URL}/api/academic/subtemas/${currentPath.temaId}`);
        if (res.ok) {
          const data = await res.json();
          setSubtemas(data);
        }
      } catch (e) {} finally { setAcademicLoading(false); }
    };
    fetchSubtemas();
  }, [currentPath.temaId]);

  // --- Motor de Filtrado y Ordenamiento Contextual (0ms) ---
  const processedDecks = useMemo(() => {
    let result = decks.filter((deck) => {
      // Búsqueda por título global o por carpeta
      const matchesSearch = deck.title?.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      // Filtrado por jerarquía posicional exacta
      if (currentPath.materiaId === null) {
        // En la raíz, renderizamos los mazos que no tienen materia asignada (Retrocompatibilidad total)
        return deck.materiaId === null;
      }
      if (currentPath.parcialNumber === null) return false; // Bloque intermedio de Parciales 1,2,3
      if (currentPath.temaId === null) {
        // Mazos vinculados a la materia y parcial, pero sin tema específico
        return deck.materiaId === currentPath.materiaId && deck.parcialNumber === currentPath.parcialNumber && deck.temaId === null;
      }
      if (currentPath.subtemaId === null) {
        // Mazos dentro del tema principal (o subtemas si se decide mezclar)
        return deck.temaId === currentPath.temaId && deck.subtemaId === null;
      }
      // Mazos dentro de un subtema específico
      return deck.subtemaId === currentPath.subtemaId;
    });

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
  }, [decks, searchQuery, sortBy, currentPath]);

  // --- Controladores de Creación Estructural Académica ---
  const handleCreateAcademicFolder = async (e) => {
    e.preventDefault();
    if (!academicInput.trim()) return;

    let url = `${BACKEND_URL}/api/academic/`;
    let body = { userId, name: academicInput.trim() };

    if (academicModal.type === 'materia') {
      url += 'materias';
    } else if (academicModal.type === 'tema') {
      url += 'temas';
      body.materiaId = currentPath.materiaId;
      body.parcialNumber = currentPath.parcialNumber;
    } else if (academicModal.type === 'subtema') {
      url += 'subtemas';
      body.temaId = currentPath.temaId;
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const errData = await res.json();
        alert(errData.error || 'Ocurrió un error.');
        return;
      }
      const saved = await res.json();

      if (academicModal.type === 'materia') {
        const nextMaterias = [...materias, saved].sort((a, b) => a.name.localeCompare(b.name));
        setMaterias(nextMaterias);
        localStorage.setItem(`materias_${userId}`, JSON.stringify(nextMaterias));
      } else if (academicModal.type === 'tema') {
        setTemas((prev) => [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)));
      } else if (academicModal.type === 'subtema') {
        setSubtemas((prev) => [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)));
      }
      
      setAcademicInput('');
      setAcademicModal(null);
    } catch (err) {
      alert('Error de conexión con el servidor.');
    }
  };

  const handleDeleteAcademicFolder = async (type, id, e) => {
    e.stopPropagation(); // Evita detonar la navegación de la tarjeta/fila
    if (!window.confirm(`¿Seguro que deseas eliminar este elemento? Se borrarán sus contenedores internos e hijos. Los mazos se conservarán sin clasificar.`)) return;
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/academic/${type}s/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      
      if (type === 'materia') {
        const nextMaterias = materias.filter(m => m._id !== id);
        setMaterias(nextMaterias);
        localStorage.setItem(`materias_${userId}`, JSON.stringify(nextMaterias));
        if (currentPath.materiaId === id) handleResetPath();
      } else if (type === 'tema') {
        setTemas(prev => prev.filter(t => t._id !== id));
      } else if (type === 'subtema') {
        setSubtemas(prev => prev.filter(s => s._id !== id));
      }
      await loadDecks(); // Recargar para asimilar la desvinculación de mazos en cascada
    } catch {
      alert('No se pudo eliminar el contenedor.');
    }
  };

  // --- Reubicación del Reset de Navegación ---
  const handleResetPath = () => {
    setCurrentPath({ materiaId: null, parcialNumber: null, temaId: null, subtemaId: null });
  };

  // --- Controladores Core de Mazos Existentes (Ajustados al Contexto Activo) ---
  const handleToggleDefault = async (deck) => {
    const nextState = !deck.isDefault;
    const updatedDecks = decks.map((d) => d.id === deck.id ? { ...d, isDefault: nextState, isPublicReadOnly: false } : d);
    setDecks(updatedDecks);
    localStorage.setItem(`decks_${userId}`, JSON.stringify(updatedDecks));
    try {
      await fetch(`${BACKEND_URL}/api/decks/${deck.id}/default`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: nextState }),
      });
    } catch { await loadDecks(); }
  };

  const handleTogglePublicReadOnly = async (deck) => {
    const nextState = !deck.isPublicReadOnly;
    const updatedDecks = decks.map((d) => d.id === deck.id ? { ...d, isPublicReadOnly: nextState, isDefault: false } : d);
    setDecks(updatedDecks);
    localStorage.setItem(`decks_${userId}`, JSON.stringify(updatedDecks));
    try {
      await fetch(`${BACKEND_URL}/api/decks/${deck.id}/public-readonly`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublicReadOnly: nextState }),
      });
    } catch { await loadDecks(); }
  };

  const handleSaveDeck = async (payload) => {
    const editing = modal?.editing;
    const url = editing ? `${BACKEND_URL}/api/decks/${editing.id}` : `${BACKEND_URL}/api/decks`;
    const method = editing ? 'PUT' : 'POST';
    
    // Inyección automática del contexto geográfico actual en la base de datos
    const fullPayload = editing ? payload : {
      userId,
      ...payload,
      materiaId: currentPath.materiaId,
      parcialNumber: currentPath.parcialNumber,
      temaId: currentPath.temaId,
      subtemaId: currentPath.subtemaId
    };

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullPayload),
    });
    if (!res.ok) throw new Error();
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
      await fetch(`${BACKEND_URL}/api/decks/${deck.id}`, { method: 'DELETE' });
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
      await fetch(`${BACKEND_URL}/api/decks/${deck.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isStarred: nextState }),
      });
    } catch { await loadDecks(); }
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
        body: JSON.stringify({ 
          userId, 
          deck: {
            ...parsed.deck,
            materiaId: currentPath.materiaId,
            parcialNumber: currentPath.parcialNumber,
            temaId: currentPath.temaId,
            subtemaId: currentPath.subtemaId
          }, 
          cards: parsed.cards || [] 
        }),
      });
      await loadDecks(true);
    } catch (err) {} finally { setImporting(false); }
  };

  // --- Resolutores de Nombres de Migas de Pan (Breadcrumbs) ---
  const activeMateriaName = useMemo(() => materias.find(m => m._id === currentPath.materiaId)?.name, [materias, currentPath.materiaId]);
  const activeTemaName = useMemo(() => temas.find(t => t._id === currentPath.temaId)?.name, [temas, currentPath.temaId]);
  const activeSubtemaName = useMemo(() => subtemas.find(s => s._id === currentPath.subtemaId)?.name, [subtemas, currentPath.subtemaId]);

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

      {/* 🗺️ BREADCRUMBS: Barra de control de flujo e historial líquido */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-500 bg-white border border-slate-200/60 p-2.5 rounded-xl shadow-3xs mb-4">
        <button onClick={handleResetPath} className="hover:text-slate-900 transition-colors cursor-pointer flex items-center gap-1">
          <Library className="w-3.5 h-3.5" /> Biblioteca
        </button>
        
        {currentPath.materiaId && (
          <>
            <ChevronRight className="w-3 h-3 text-slate-300" />
            <button onClick={() => setCurrentPath({ ...currentPath, parcialNumber: null, temaId: null, subtemaId: null })} className="hover:text-slate-900 transition-colors max-w-[140px] truncate cursor-pointer">
              {activeMateriaName}
            </button>
          </>
        )}

        {currentPath.parcialNumber && (
          <>
            <ChevronRight className="w-3 h-3 text-slate-300" />
            <button onClick={() => setCurrentPath({ ...currentPath, temaId: null, subtemaId: null })} className="hover:text-slate-900 transition-colors cursor-pointer">
              Parcial {currentPath.parcialNumber}
            </button>
          </>
        )}

        {currentPath.temaId && (
          <>
            <ChevronRight className="w-3 h-3 text-slate-300" />
            <button onClick={() => setCurrentPath({ ...currentPath, subtemaId: null })} className="hover:text-slate-900 transition-colors max-w-[140px] truncate cursor-pointer">
              {activeTemaName}
            </button>
          </>
        )}

        {currentPath.subtemaId && (
          <>
            <ChevronRight className="w-3 h-3 text-slate-300" />
            <span className="text-slate-900 font-bold max-w-[140px] truncate">{activeSubtemaName}</span>
          </>
        )}
      </div>

      <div className="animate-[fadeIn_0.15s_ease]">
        
        {/* Renderizador de Barra de herramientas estándar de búsqueda para mazos */}
        {decks.length > 0 && (
          <LibraryToolbar
            searchQuery={searchQuery} setSearchQuery={setSearchQuery}
            sortBy={sortBy} setSortBy={setSortBy}
            viewMode={viewMode} setViewMode={setViewMode}
          />
        )}

        {/* =========================================================================
            NIVEL 1: VISTA DE MATERIAS (RAÍZ PRINCIPAL)
            ========================================================================= */}
        {currentPath.materiaId === null && (
          <div className="space-y-6 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Tus Materias</h3>
              <button 
                onClick={() => setAcademicModal({ type: 'materia' })}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Nueva Materia
              </button>
            </div>

            {loading && materias.length === 0 ? (
              <div className="flex items-center gap-2 text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> Cargando asignaturas…</div>
            ) : materias.length === 0 ? (
              <div className="text-center border border-dashed border-slate-200 rounded-2xl py-10 text-slate-400 text-xs font-medium">
                No tienes materias configuradas. Agrega una asignatura para segmentar tus parciales.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {materias.map((m) => (
                  <div 
                    key={m._id} 
                    onClick={() => setCurrentPath({ ...currentPath, materiaId: m._id })}
                    className="group bg-white border border-slate-200 p-4 rounded-xl shadow-3xs hover:border-slate-400 transition-all flex items-center justify-between cursor-pointer active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center shrink-0 text-slate-600 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                        <Folder className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-bold text-slate-800 group-hover:text-slate-950 truncate">{m.name}</span>
                    </div>
                    <button 
                      onClick={(e) => handleDeleteAcademicFolder('materia', m._id, e)}
                      className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all shrink-0 cursor-pointer"
                      title="Eliminar Materia"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* SECCIÓN RETROCOMPATIBILIDAD: Mazos sin clasificar en carpetas */}
            <div className="pt-4 border-t border-slate-200">
              <div className="flex items-center gap-1.5 mb-3">
                <Bookmark className="w-3.5 h-3.5 text-slate-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Mazos sueltos / Sin clasificar</h4>
              </div>
              {processedDecks.length === 0 ? (
                <div className="text-left text-xs font-medium text-slate-400 italic">No hay mazos huérfanos fuera de carpetas.</div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  {processedDecks.map((deck) => (
                    <DeckCard
                      key={deck.id} deck={deck} currentUserId={userId} isAdmin={isAdmin} isList={viewMode === 'list'}
                      onOpen={(d) => { setInitialMode('edit'); setCurrentDeck(d); }}
                      onEdit={(d) => setModal({ editing: d })} onDelete={handleDeleteDeck}
                      onToggleStar={handleToggleStar} onToggleDefault={handleToggleDefault} onTogglePublicReadOnly={handleTogglePublicReadOnly}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            NIVEL 2: REJILLA DE LOS 3 PARCIALES OBLIGATORIOS (SISTEMA MEXICANO)
            ========================================================================= */}
        {currentPath.materiaId !== null && currentPath.parcialNumber === null && (
          <div className="space-y-4 mt-4">
            <div className="flex items-center gap-2">
              <button onClick={handleResetPath} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-900 cursor-pointer"><ArrowLeft className="w-4 h-4" /></button>
              <h3 className="text-sm font-black text-slate-800">Estructura Trimestral de: <span className="text-slate-500 font-bold">{activeMateriaName}</span></h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((num) => {
                const countOfDecksInParcial = decks.filter(d => d.materiaId === currentPath.materiaId && d.parcialNumber === num).length;
                return (
                  <div 
                    key={num}
                    onClick={() => setCurrentPath({ ...currentPath, parcialNumber: num })}
                    className="bg-white border-2 border-slate-200/70 p-6 rounded-2xl shadow-3xs hover:border-slate-900 transition-all cursor-pointer flex flex-col justify-between h-36 active:scale-[0.99] group"
                  >
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Evaluación Oficial</span>
                      <h4 className="text-base font-extrabold text-slate-900 mt-1">Parcial 0{num}</h4>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                      <span>{countOfDecksInParcial} {countOfDecksInParcial === 1 ? 'mazo asociado' : 'mazos asociados'}</span>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* =========================================================================
            NIVEL 3: VISTA DE TEMAS DEL PARCIAL SELECCIONADO
            ========================================================================= */}
        {currentPath.materiaId !== null && currentPath.parcialNumber !== null && currentPath.temaId === null && (
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPath({ ...currentPath, parcialNumber: null })} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-900 cursor-pointer"><ArrowLeft className="w-4 h-4" /></button>
                <h3 className="text-sm font-black text-slate-800">Temarios de <span className="text-slate-500">{activeMateriaName}</span> ➔ Parcial {currentPath.parcialNumber}</h3>
              </div>
              <button 
                onClick={() => setAcademicModal({ type: 'tema' })}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar Tema
              </button>
            </div>

            {academicLoading ? (
              <div className="flex items-center gap-2 text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> Descargando temario…</div>
            ) : temas.length === 0 ? (
              <div className="text-center border border-dashed border-slate-200 rounded-2xl py-12 text-slate-400 text-xs font-medium">
                No hay temas registrados en este parcial. Da de alta el primer módulo de estudio.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {temas.map((t) => (
                  <div 
                    key={t._id}
                    onClick={() => setCurrentPath({ ...currentPath, temaId: t._id })}
                    className="group bg-white border border-slate-200 p-4 rounded-xl shadow-3xs hover:border-slate-500 transition-all flex items-center justify-between cursor-pointer active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-300 group-hover:bg-indigo-500 shrink-0 transition-colors" />
                      <span className="text-sm font-bold text-slate-800 group-hover:text-slate-950 truncate">{t.name}</span>
                    </div>
                    <button 
                      onClick={(e) => handleDeleteAcademicFolder('tema', t._id, e)}
                      className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Renderizador de Mazos que se crearon a nivel parcial general sin tema */}
            {processedDecks.length > 0 && (
              <div className="pt-4 border-t border-slate-200 mt-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Mazos generales de este parcial</h4>
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  {processedDecks.map((deck) => (
                    <DeckCard
                      key={deck.id} deck={deck} currentUserId={userId} isAdmin={isAdmin} isList={viewMode === 'list'}
                      onOpen={(d) => { setInitialMode('edit'); setCurrentDeck(d); }}
                      onEdit={(d) => setModal({ editing: d })} onDelete={handleDeleteDeck}
                      onToggleStar={handleToggleStar} onToggleDefault={handleToggleDefault} onTogglePublicReadOnly={handleTogglePublicReadOnly}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            NIVEL 4: NÚCLEO HOJA - SUBTEMAS (OPCIONALES) Y REJILLA DE MAZOS
            ========================================================================= */}
        {currentPath.materiaId !== null && currentPath.parcialNumber !== null && currentPath.temaId !== null && (
          <div className="space-y-6 mt-4">
            
            {/* Sección de Subtemas Opcionales */}
            <div className="bg-slate-100/60 border border-slate-200 p-4 rounded-2xl">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Subtemas Especializados (Opcional)</h4>
                <button 
                  onClick={() => setAcademicModal({ type: 'subtema' })}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Añadir Subtema
                </button>
              </div>

              {subtemas.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setCurrentPath({ ...currentPath, subtemaId: null })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                      currentPath.subtemaId === null 
                        ? 'bg-slate-900 border-slate-900 text-white' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Ver Todo el Tema
                  </button>
                  {subtemas.map((sub) => (
                    <div 
                      key={sub._id}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        currentPath.subtemaId === sub._id 
                          ? 'bg-indigo-600 border-indigo-600 text-white' 
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <span onClick={() => setCurrentPath({ ...currentPath, subtemaId: sub._id })} className="cursor-pointer truncate max-w-[150px]">{sub.name}</span>
                      <button 
                        onClick={(e) => handleDeleteAcademicFolder('subtema', sub._id, e)}
                        className={`p-0.5 rounded-md shrink-0 ml-1 cursor-pointer ${currentPath.subtemaId === sub._id ? 'text-indigo-200 hover:text-white' : 'text-slate-300 hover:text-red-600'}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {subtemas.length === 0 && <p className="text-[11px] text-slate-400 font-medium italic">No hay subtemas de desglose en esta sección.</p>}
            </div>

            {/* Listado de Tarjetas de Mazos Finales del Contexto */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Mazos Disponibles</h3>
              {processedDecks.length === 0 ? (
                <div className="text-center border border-dashed border-slate-300 rounded-2xl py-12 text-slate-400 text-xs font-medium bg-white">
                  No hay tarjetas de mazos en este nodo. Usa el botón flotante (+) para crear un mazo aquí.
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 pb-12">
                  {processedDecks.map((deck) => (
                    <DeckCard
                      key={deck.id} deck={deck} currentUserId={userId} isAdmin={isAdmin} isList={viewMode === 'list'}
                      onOpen={(d) => { setInitialMode('edit'); setCurrentDeck(d); }}
                      onEdit={(d) => setModal({ editing: d })} onDelete={handleDeleteDeck}
                      onToggleStar={handleToggleStar} onToggleDefault={handleToggleDefault} onTogglePublicReadOnly={handleTogglePublicReadOnly}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* 📁 MODAL DE CREACIÓN DE CARPETAS MAESTRO (Materias, Temas, Subtemas) */}
      {academicModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs animate-[fadeIn_0.1s_ease]">
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xl w-full max-w-sm mx-4 animate-[slideUp_0.12s_ease-out]">
            <h4 className="text-sm font-black text-slate-900 capitalize">Crear Nueva {academicModal.type}</h4>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5 leading-normal">
              {academicModal.type === 'materia' && 'Asigna el nombre de la materia oficial de tu universidad.'}
              {academicModal.type === 'tema' && `El tema se agrupará de manera fija dentro del Parcial ${currentPath.parcialNumber}.`}
              {academicModal.type === 'subtema' && 'Desglosa ramificaciones finas para clasificar sets mecánicos muy precisos.'}
            </p>
            <form onSubmit={handleCreateAcademicFolder} className="mt-3 space-y-3">
              <input 
                type="text" autoFocus required placeholder={`Ej. ${academicModal.type === 'materia' ? 'Farmacología Médica' : academicModal.type === 'tema' ? 'Farmacocinética' : 'Vías de Administración'}`}
                value={academicInput} onChange={(e) => setAcademicInput(e.target.value)}
                className="w-full text-xs font-medium border border-slate-200 rounded-xl px-3.5 h-11 focus:outline-hidden focus:border-slate-900 shadow-3xs"
              />
              <div className="flex gap-2 justify-end text-xs font-bold">
                <button type="button" onClick={() => { setAcademicModal(null); setAcademicInput(''); }} className="px-4 h-10 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 cursor-pointer">Cancelar</button>
                <button type="submit" className="px-4 h-10 bg-slate-900 hover:bg-slate-800 text-white rounded-xl cursor-pointer">Crear Carpeta</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal && <DeckModal initial={modal.editing} onClose={() => setModal(null)} onSave={handleSaveDeck} />}
      
      {/* 🚀 FAB INTELIGENTE: Al crear un mazo mediante este botón, se inyectará automáticamente en la carpeta abierta */}
      <LibraryFAB 
        setModal={setModal} 
        fileInputRef={fileInputRef} 
        importing={importing} 
        disabled={currentPath.materiaId !== null && currentPath.parcialNumber === null} // Deshabilitado solo en la rejilla selectora de parciales
      />
    </div>
  );
}
