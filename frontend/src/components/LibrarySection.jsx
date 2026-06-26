// FILE: frontend/src/components/LibrarySection.jsx
import { useRef, useState, useMemo } from 'react';
import { Library, Loader2, Folder, ChevronRight, ArrowLeft, Plus, Trash2, Layers, Bookmark } from 'lucide-react';
import { useLibraryState } from '../hooks/useLibraryState';
import DeckCard from './DeckCard';
import DeckModal from './DeckModal';
import DeckInterior from './DeckInterior';
import LibraryToolbar from './library/LibraryToolbar';
import LibraryFAB from './library/LibraryFAB';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const ADMIN_EMAIL = "cesarjaviervebe@gmail.com"; 

export default function LibrarySection({ 
  userId, userEmail, decks, materias, loading, 
  setDecks, setMaterias, loadDecks, loadMaterias,
  currentDeck, setCurrentDeck, initialMode, setInitialMode
}) {
  
  // Consumo del Hook de Estado e Inteligencia de Negocio
  const {
    currentPath, setCurrentPath, temas, setTemas, subtemas, setSubtemas,
    academicLoading, searchQuery, setSearchQuery, sortBy, setSortBy,
    viewMode, setViewMode, processedDecks, handleResetPath
  } = useLibraryState(userId, decks, materias, setDecks, setMaterias, loadDecks);

  // Estados locales específicos de ventanas emergentes (Modales elementales)
  const [academicModal, setAcademicModal] = useState(null); 
  const [academicInput, setAcademicInput] = useState('');
  const [modal, setModal] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const isAdmin = userEmail === ADMIN_EMAIL;

  // --- Resolutores de Nombres (Breadcrumbs) ---
  const activeMateriaName = useMemo(() => materias.find(m => m._id === currentPath.materiaId)?.name, [materias, currentPath.materiaId]);
  const activeTemaName = useMemo(() => temas.find(t => t._id === currentPath.temaId)?.name, [temas, currentPath.temaId]);
  const activeSubtemaName = useMemo(() => subtemas.find(s => s._id === currentPath.subtemaId)?.name, [subtemas, currentPath.subtemaId]);

  // --- Operaciones CRUD de Carpetas Estructurales ---
  const handleCreateAcademicFolder = async (e) => {
    e.preventDefault();
    if (!academicInput.trim()) return;

    let url = `${BACKEND_URL}/api/academic/`;
    let body = { userId, name: academicInput.trim() };

    if (academicModal.type === 'materia') url += 'materias';
    else if (academicModal.type === 'tema') {
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
      if (!res.ok) return alert((await res.json()).error || 'Ocurrió un error.');
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
    } catch { alert('Error de conexión.'); }
  };

  const handleDeleteAcademicFolder = async (type, id, e) => {
    e.stopPropagation();
    if (!window.confirm(`¿Eliminar contenedor? Se borrarán carpetas hijas. Los mazos se conservarán sueltos.`)) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/academic/${type}s/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      
      if (type === 'materia') {
        const nextMaterias = materias.filter(m => m._id !== id);
        setMaterias(nextMaterias);
        localStorage.setItem(`materias_${userId}`, JSON.stringify(nextMaterias));
        if (currentPath.materiaId === id) handleResetPath();
      } else if (type === 'tema') setTemas(prev => prev.filter(t => t._id !== id));
      else if (type === 'subtema') setSubtemas(prev => prev.filter(s => s._id !== id));
      await loadDecks();
    } catch { alert('Error al eliminar.'); }
  };

  // --- Operaciones Atómicas de Mazos ---
  const handleDeckMutation = async (deckId, endpoint, bodyPayload, updateFields) => {
    const updatedDecks = decks.map((d) => d.id === deckId ? { ...d, ...updateFields } : d);
    setDecks(updatedDecks);
    localStorage.setItem(`decks_${userId}`, JSON.stringify(updatedDecks));
    try {
      await fetch(`${BACKEND_URL}/api/decks/${deckId}/${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });
    } catch { await loadDecks(); }
  };

  const handleSaveDeck = async (payload) => {
    const editing = modal?.editing;
    const url = editing ? `${BACKEND_URL}/api/decks/${editing.id}` : `${BACKEND_URL}/api/decks`;
    
    const fullPayload = editing ? payload : {
      userId, ...payload,
      materiaId: currentPath.materiaId,
      parcialNumber: currentPath.parcialNumber,
      temaId: currentPath.temaId,
      subtemaId: currentPath.subtemaId
    };

    const res = await fetch(url, {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullPayload),
    });
    if (!res.ok) throw new Error();
    const saved = await res.json();
    
    setDecks(editing ? decks.map((d) => d.id === saved.id ? { ...d, ...saved } : d) : [saved, ...decks]);
    localStorage.setItem(`decks_${userId}`, JSON.stringify(editing ? decks.map((d) => d.id === saved.id ? { ...d, ...saved } : d) : [saved, ...decks]));
    setModal(null);
  };

  const handleDeleteDeck = async (deck) => {
    if (!window.confirm(`¿Eliminar "${deck.title}"?`)) return;
    try {
      await fetch(`${BACKEND_URL}/api/decks/${deck.id}`, { method: 'DELETE' });
      setDecks(decks.filter((d) => d.id !== deck.id));
      localStorage.setItem(`decks_${userId}`, JSON.stringify(decks.filter((d) => d.id !== deck.id)));
    } catch {}
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed?.deck?.title) throw new Error();
      await fetch(`${BACKEND_URL}/api/decks/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId, 
          deck: { ...parsed.deck, ...currentPath }, 
          cards: parsed.cards || [] 
        }),
      });
      await loadDecks(true);
    } catch {} finally { setImporting(false); e.target.value = ''; }
  };

  if (currentDeck) {
    return <DeckInterior deck={currentDeck} userId={userId} initialMode={initialMode} onBack={() => { setCurrentDeck(null); loadDecks(); }} />;
  }

  return (
    <div data-testid="library-section" className="relative min-h-[60vh]">
      <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />

      {/* 🗺️ BREADCRUMBS MÓVILES/ESCRITORIO */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-500 bg-white border border-slate-200/60 p-2.5 rounded-xl shadow-3xs mb-4">
        <button onClick={handleResetPath} className="hover:text-slate-900 flex items-center gap-1 cursor-pointer"><Library className="w-3.5 h-3.5" /> Biblioteca</button>
        {currentPath.materiaId && (
          <><ChevronRight className="w-3 h-3 text-slate-300" /><button onClick={() => setCurrentPath({ ...currentPath, parcialNumber: null, temaId: null, subtemaId: null })} className="hover:text-slate-900 truncate max-w-[140px] cursor-pointer">{activeMateriaName}</button></>
        )}
        {currentPath.parcialNumber && (
          <><ChevronRight className="w-3 h-3 text-slate-300" /><button onClick={() => setCurrentPath({ ...currentPath, temaId: null, subtemaId: null })} className="hover:text-slate-900 cursor-pointer">Parcial {currentPath.parcialNumber}</button></>
        )}
        {currentPath.temaId && (
          <><ChevronRight className="w-3 h-3 text-slate-300" /><button onClick={() => setCurrentPath({ ...currentPath, subtemaId: null })} className="hover:text-slate-900 truncate max-w-[140px] cursor-pointer">{activeTemaName}</button></>
        )}
        {currentPath.subtemaId && (
          <><ChevronRight className="w-3 h-3 text-slate-300" /><span className="text-slate-900 font-bold truncate max-w-[140px]">{activeSubtemaName}</span></>
        )}
      </div>

      <div className="animate-[fadeIn_0.15s_ease]">
        {decks.length > 0 && <LibraryToolbar searchQuery={searchQuery} setSearchQuery={setSearchQuery} sortBy={sortBy} setSortBy={setSortBy} viewMode={viewMode} setViewMode={setViewMode} />}

        {/* ==========================================
            RENDERIZADO CONDICIONAL DE NIVELES ACADÉMICOS
            ========================================== */}
        
        {/* NIVEL 1: MATERIAS RAÍZ */}
        {currentPath.materiaId === null && (
          <div className="space-y-6 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Tus Materias</h3>
              <button onClick={() => setAcademicModal({ type: 'materia' })} className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"><Plus className="w-3.5 h-3.5" /> Nueva Materia</button>
            </div>
            {loading && materias.length === 0 ? (
              <div className="flex items-center gap-2 text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> Cargando asignaturas…</div>
            ) : materias.length === 0 ? (
              <div className="text-center border border-dashed border-slate-200 rounded-2xl py-10 text-slate-400 text-xs font-medium">No tienes materias configuradas.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {materias.map((m) => (
                  <div key={m._id} onClick={() => setCurrentPath({ ...currentPath, materiaId: m._id })} className="group bg-white border border-slate-200 p-4 rounded-xl shadow-3xs hover:border-slate-400 transition-all flex items-center justify-between cursor-pointer active:scale-[0.99]">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center shrink-0 text-slate-600 group-hover:bg-slate-900 group-hover:text-white transition-colors"><Folder className="w-4 h-4" /></div>
                      <span className="text-sm font-bold text-slate-800 truncate">{m.name}</span>
                    </div>
                    <button onClick={(e) => handleDeleteAcademicFolder('materia', m._id, e)} className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
            
            {/* RETROCOMPATIBILIDAD */}
            <div className="pt-4 border-t border-slate-200">
              <div className="flex items-center gap-1.5 mb-3"><Bookmark className="w-3.5 h-3.5 text-slate-400" /><h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Mazos sueltos</h4></div>
              {processedDecks.length === 0 ? <div className="text-xs text-slate-400 italic">No hay mazos huérfanos.</div> : (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  {processedDecks.map((d) => <DeckCard key={d.id} deck={d} currentUserId={userId} isAdmin={isAdmin} isList={viewMode === 'list'} onOpen={(dk) => { setInitialMode('edit'); setCurrentDeck(dk); }} onEdit={(dk) => setModal({ editing: dk })} onDelete={handleDeleteDeck} onToggleStar={(dk) => handleDeckMutation(dk.id, 'star', { isStarred: !dk.isStarred }, { isStarred: !dk.isStarred })} onToggleDefault={(dk) => handleDeckMutation(dk.id, 'default', { isDefault: !dk.isDefault }, { isDefault: !dk.isDefault, isPublicReadOnly: false })} onTogglePublicReadOnly={(dk) => handleDeckMutation(dk.id, 'public-readonly', { isPublicReadOnly: !dk.isPublicReadOnly }, { isPublicReadOnly: !dk.isPublicReadOnly, isDefault: false })} />)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* NIVEL 2: TRES PARCIALES FIJOS */}
        {currentPath.materiaId !== null && currentPath.parcialNumber === null && (
          <div className="space-y-4 mt-4">
            <div className="flex items-center gap-2">
              <button onClick={handleResetPath} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"><ArrowLeft className="w-4 h-4" /></button>
              <h3 className="text-sm font-black text-slate-800">Estructura Trimestral: <span className="text-slate-500 font-bold">{activeMateriaName}</span></h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((num) => {
                const count = decks.filter(d => String(d.materiaId || '') === String(currentPath.materiaId) && d.parcialNumber === num).length;
                return (
                  <div key={num} onClick={() => setCurrentPath({ ...currentPath, parcialNumber: num })} className="bg-white border-2 border-slate-200/70 p-6 rounded-2xl hover:border-slate-900 transition-all cursor-pointer flex flex-col justify-between h-36 active:scale-[0.99] group">
                    <div><span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Evaluación Oficial</span><h4 className="text-base font-extrabold text-slate-900 mt-1">Parcial 0{num}</h4></div>
                    <div className="flex items-center justify-between text-xs text-slate-400 font-medium"><span>{count} mazo(s)</span><ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-all" /></div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* NIVEL 3: TEMARIOS DEL PARCIAL */}
        {currentPath.materiaId !== null && currentPath.parcialNumber !== null && currentPath.temaId === null && (
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPath({ ...currentPath, parcialNumber: null })} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"><ArrowLeft className="w-4 h-4" /></button>
                <h3 className="text-sm font-black text-slate-800">Temarios ➔ Parcial {currentPath.parcialNumber}</h3>
              </div>
              <button onClick={() => setAcademicModal({ type: 'tema' })} className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer"><Plus className="w-3.5 h-3.5" /> Agregar Tema</button>
            </div>
            {academicLoading ? <div className="text-slate-400 text-xs"><Loader2 className="w-4 h-4 animate-spin inline mr-1" /> Descargando temario…</div> : temas.length === 0 ? <div className="text-center border border-dashed border-slate-200 rounded-2xl py-12 text-slate-400 text-xs">No hay temas registrados.</div> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {temas.map((t) => (
                  <div key={t._id} onClick={() => setCurrentPath({ ...currentPath, temaId: t._id })} className="group bg-white border border-slate-200 p-4 rounded-xl shadow-3xs hover:border-slate-500 transition-all flex items-center justify-between cursor-pointer active:scale-[0.99]">
                    <div className="flex items-center gap-2.5 min-w-0"><div className="w-2.5 h-2.5 rounded-full bg-slate-300 group-hover:bg-indigo-500 shrink-0 transition-colors" /><span className="text-sm font-bold text-slate-800 truncate">{t.name}</span></div>
                    <button onClick={(e) => handleDeleteAcademicFolder('tema', t._id, e)} className="p-1.5 text-slate-300 hover:text-red-600 rounded-lg opacity-0 group-hover:opacity-100 transition-all cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
            {processedDecks.length > 0 && (
              <div className="pt-4 border-t border-slate-200 mt-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Mazos generales del parcial</h4>
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  {processedDecks.map((d) => <DeckCard key={d.id} deck={d} currentUserId={userId} isAdmin={isAdmin} isList={viewMode === 'list'} onOpen={(dk) => { setInitialMode('edit'); setCurrentDeck(dk); }} onEdit={(dk) => setModal({ editing: dk })} onDelete={handleDeleteDeck} onToggleStar={(dk) => handleDeckMutation(dk.id, 'star', { isStarred: !dk.isStarred }, { isStarred: !dk.isStarred })} onToggleDefault={(dk) => handleDeckMutation(dk.id, 'default', { isDefault: !dk.isDefault }, { isDefault: !dk.isDefault, isPublicReadOnly: false })} onTogglePublicReadOnly={(dk) => handleDeckMutation(dk.id, 'public-readonly', { isPublicReadOnly: !dk.isPublicReadOnly }, { isPublicReadOnly: !dk.isPublicReadOnly, isDefault: false })} />)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* NIVEL 4: NÚCLEO HOJA - SUBTEMAS Y MAZOS FINALIZADOS */}
        {currentPath.materiaId !== null && currentPath.parcialNumber !== null && currentPath.temaId !== null && (
          <div className="space-y-6 mt-4">
            <div className="bg-slate-100/60 border border-slate-200 p-4 rounded-2xl">
              <div className="flex items-center justify-between mb-3"><h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Subtemas Especializados</h4><button onClick={() => setAcademicModal({ type: 'subtema' })} className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"><Plus className="w-3 h-3" /> Añadir Subtema</button></div>
              {subtemas.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setCurrentPath({ ...currentPath, subtemaId: null })} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${currentPath.subtemaId === null ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-600'}`}>Ver Todo</button>
                  {subtemas.map((sub) => (
                    <div key={sub._id} className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${currentPath.subtemaId === sub._id ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-600'}`}><span onClick={() => setCurrentPath({ ...currentPath, subtemaId: sub._id })} className="cursor-pointer truncate max-w-[150px]">{sub.name}</span><button onClick={(e) => handleDeleteAcademicFolder('subtema', sub._id, e)} className="p-0.5 ml-1 text-slate-300 hover:text-red-500 cursor-pointer"><Trash2 className="w-3 h-3" /></button></div>
                  ))}
                </div>
              ) : <p className="text-[11px] text-slate-400 italic">No hay subtemas de desglose.</p>}
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Mazos Disponibles</h3>
              {processedDecks.length === 0 ? <div className="text-center border border-dashed border-slate-300 rounded-2xl py-12 text-slate-400 text-xs bg-white">No hay mazos aquí. Usa el botón (+) para crear uno.</div> : (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 pb-12">
                  {processedDecks.map((d) => <DeckCard key={d.id} deck={d} currentUserId={userId} isAdmin={isAdmin} isList={viewMode === 'list'} onOpen={(dk) => { setInitialMode('edit'); setCurrentDeck(dk); }} onEdit={(dk) => setModal({ editing: dk })} onDelete={handleDeleteDeck} onToggleStar={(dk) => handleDeckMutation(dk.id, 'star', { isStarred: !dk.isStarred }, { isStarred: !dk.isStarred })} onToggleDefault={(dk) => handleDeckMutation(dk.id, 'default', { isDefault: !dk.isDefault }, { isDefault: !dk.isDefault, isPublicReadOnly: false })} onTogglePublicReadOnly={(dk) => handleDeckMutation(dk.id, 'public-readonly', { isPublicReadOnly: !dk.isPublicReadOnly }, { isPublicReadOnly: !dk.isPublicReadOnly, isDefault: false })} />)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL ESTRUCTURAL UNIFICADO */}
      {academicModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white p-5 rounded-2xl shadow-xl w-full max-w-sm mx-4">
            <h4 className="text-sm font-black text-slate-900 capitalize">Crear Nueva {academicModal.type}</h4>
            <form onSubmit={handleCreateAcademicFolder} className="mt-3 space-y-3">
              <input type="text" autoFocus required placeholder="Nombre de la carpeta..." value={academicInput} onChange={(e) => setAcademicInput(e.target.value)} className="w-full text-xs font-medium border border-slate-200 rounded-xl px-3.5 h-11 focus:outline-hidden focus:border-slate-900" />
              <div className="flex gap-2 justify-end text-xs font-bold">
                <button type="button" onClick={() => { setAcademicModal(null); setAcademicInput(''); }} className="px-4 h-10 border border-slate-200 text-slate-600 rounded-xl cursor-pointer">Cancelar</button>
                <button type="submit" className="px-4 h-10 bg-slate-900 text-white rounded-xl cursor-pointer">Crear Carpeta</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal && <DeckModal initial={modal.editing} onClose={() => setModal(null)} onSave={handleSaveDeck} />}
      <LibraryFAB setModal={setModal} fileInputRef={fileInputRef} importing={importing} disabled={currentPath.materiaId !== null && currentPath.parcialNumber === null} />
    </div>
  );
}
