// FILE: frontend/src/components/LibrarySection.jsx
import { useRef, useState, useMemo, useEffect } from 'react';
import { useLibraryState } from '../hooks/useLibraryState';
import DeckInterior from './DeckInterior';
import DeckModal from './DeckModal';
import LibraryToolbar from './library/LibraryToolbar';
import LibraryFAB from './library/LibraryFAB';

import Breadcrumbs from './library/Breadcrumbs';
import MateriasLevel from './library/MateriasLevel';
import ParcialesLevel from './library/ParcialesLevel';
import TemasLevel from './library/TemasLevel';
import SubtemasLevel from './library/SubtemasLevel';
import AcademicFolderModal from './library/AcademicFolderModal';
import SearchResults from './library/SearchResults';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const ADMIN_EMAIL = "cesarjaviervebe@gmail.com"; 

export default function LibrarySection({
  userId, userEmail, decks, materias, loading,
  setDecks, setMaterias, loadDecks, loadMaterias,
  currentDeck, setCurrentDeck, initialMode, setInitialMode,
  onExitToStudy,
  pendingNav,       
  clearPendingNav   
}) {
  
  useEffect(() => {
    if (typeof loadDecks === 'function') loadDecks();
    if (typeof loadMaterias === 'function') loadMaterias();
  }, [loadDecks, loadMaterias]);

  const {
    currentPath, setCurrentPath, temas, setTemas, subtemas, setSubtemas,
    academicLoading, searchQuery, setSearchQuery, sortBy, setSortBy,
    viewMode, setViewMode, processedDecks, sortedMaterias, sortedTemas, sortedSubtemas,
    searchResults, handleResetPath, refreshTemas
  } = useLibraryState(userId, decks, materias, setDecks, setMaterias, loadDecks);

  // =========================================================================
  // 🧭 MOTOR DE NAVEGACIÓN INTEGRADO ATÓMICAMENTE EN EL PATH
  // =========================================================================
  useEffect(() => {
    if (!pendingNav) return;

    setCurrentPath({
      materiaId: pendingNav.materiaId ?? null,
      parcialNumber: pendingNav.parcialNumber ?? null,
      temaId: pendingNav.temaId ?? null,
      subtemaId: pendingNav.subtemaId ?? null,
      filterActiveParciales: pendingNav.filterActiveParciales === true
    });

    clearPendingNav();
  }, [pendingNav, setCurrentPath, clearPendingNav]);

  // =========================================================================
  // 📂 HANDLERS Y CONTROLADORES DE CARPETAS ACADÉMICAS
  // =========================================================================
  const [academicModal, setAcademicModal] = useState(null); 
  const [academicInput, setAcademicInput] = useState('');
  const [modal, setModal] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const isAdmin = userEmail === ADMIN_EMAIL;

  const activeMateriaName = useMemo(() => materias.find(m => m._id === currentPath.materiaId)?.name, [materias, currentPath.materiaId]);
  const activeTemaName = useMemo(() => temas.find(t => t._id === currentPath.temaId)?.name, [temas, currentPath.temaId]);
  const activeSubtemaName = useMemo(() => subtemas.find(s => s._id === currentPath.subtemaId)?.name, [subtemas, currentPath.subtemaId]);

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
        refreshTemas();
      }
      setAcademicInput('');
      setAcademicModal(null);
    } catch { alert('Error de conexión.'); }
  };

  const handleUpdateAcademicFolder = async (e) => {
    e.preventDefault();
    if (!academicInput.trim() || !academicModal?.editing) return;

    const { type, editing } = academicModal;
    const url = `${BACKEND_URL}/api/academic/${type}s/${editing._id}`;

    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: academicInput.trim() })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error al actualizar');
      
      const updated = await res.json();

      // Actualizar estado local según tipo
      if (type === 'materia') {
        const nextMaterias = materias.map(m => m._id === updated._id ? { ...m, ...updated } : m)
          .sort((a, b) => a.name.localeCompare(b.name));
        setMaterias(nextMaterias);
        localStorage.setItem(`materias_${userId}`, JSON.stringify(nextMaterias));
      } else if (type === 'tema') {
        setTemas(prev => prev.map(t => t._id === updated._id ? { ...t, ...updated } : t)
          .sort((a, b) => a.name.localeCompare(b.name)));
      } else if (type === 'subtema') {
        setSubtemas(prev => prev.map(s => s._id === updated._id ? { ...s, ...updated } : s)
          .sort((a, b) => a.name.localeCompare(b.name)));
        refreshTemas();
      }

      setAcademicInput('');
      setAcademicModal(null);
    } catch (err) {
      alert(err.message || 'Error de conexión al actualizar.');
    }
  };

  const handleDeleteAcademicFolder = async (type, id, e) => {
    e.stopPropagation();
    if (!window.confirm('¿Eliminar contenedor? Se borrarán carpetas hijas. Los mazos se conservarán sueltos.')) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/academic/${type}s/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      
      if (type === 'materia') {
        const nextMaterias = materias.filter(m => m._id !== id);
        setMaterias(nextMaterias);
        localStorage.setItem(`materias_${userId}`, JSON.stringify(nextMaterias));
        if (currentPath.materiaId === id) handleResetPath();
      } else if (type === 'tema') setTemas(prev => prev.filter(t => t._id !== id));
      else if (type === 'subtema') {
        setSubtemas(prev => prev.filter(s => s._id !== id));
        refreshTemas();
      }
      await loadDecks();
    } catch { alert('Error al eliminar.'); }
  };

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
    
    const nextDecks = editing ? decks.map((d) => d.id === saved.id ? { ...d, ...saved } : d) : [saved, ...decks];
    setDecks(nextDecks);
    localStorage.setItem(`decks_${userId}`, JSON.stringify(nextDecks));
    setModal(null);
  };

  const handleDeleteDeck = async (deck) => {
    if (!window.confirm(`¿Eliminar "${deck.title}"?`)) return;
    try {
      await fetch(`${BACKEND_URL}/api/decks/${deck.id}`, { method: 'DELETE' });
      const nextDecks = decks.filter((d) => d.id !== deck.id);
      setDecks(nextDecks);
      localStorage.setItem(`decks_${userId}`, JSON.stringify(nextDecks));
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
    return (
      <DeckInterior 
        deck={currentDeck} 
        userId={userId} 
        initialMode={initialMode} 
        onBack={() => { 
          setCurrentDeck(null); 
          if (typeof loadDecks === 'function') loadDecks(); 
          if (typeof loadMaterias === 'function') loadMaterias();
        }} 
        onRefreshData={() => {
          if (typeof loadDecks === 'function') loadDecks();
          if (typeof loadMaterias === 'function') loadMaterias();
        }}
        onExitToStudy={onExitToStudy}
      />
    );
  }

  return (
    <div data-testid="library-section" className="relative min-h-[60vh]">
      <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />

      <Breadcrumbs 
        currentPath={currentPath}
        setCurrentPath={setCurrentPath}
        handleResetPath={handleResetPath}
        activeMateriaName={activeMateriaName}
        activeTemaName={activeTemaName}
        activeSubtemaName={activeSubtemaName}
      />

      <div className="animate-[fadeIn_0.15s_ease]">
        {currentPath.materiaId === null && (
          <LibraryToolbar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            sortBy={sortBy}
            setSortBy={setSortBy}
            viewMode={viewMode}
            setViewMode={setViewMode}
          />
        )}

        {searchResults ? (
          <SearchResults
            results={searchResults}
            setCurrentPath={setCurrentPath}
            setSearchQuery={setSearchQuery}
            setCurrentDeck={setCurrentDeck}
            setInitialMode={setInitialMode}
          />
        ) : (
          <>
            {currentPath.materiaId === null && (
              <MateriasLevel
                materias={sortedMaterias}
                processedDecks={processedDecks}
                loading={loading}
                userId={userId}
                isAdmin={isAdmin}
                viewMode={viewMode}
                currentPath={currentPath}
                setCurrentPath={setCurrentPath}
                setAcademicModal={setAcademicModal}
                handleDeleteAcademicFolder={handleDeleteAcademicFolder}
                handleDeleteDeck={handleDeleteDeck}
                handleDeckMutation={handleDeckMutation}
                setInitialMode={setInitialMode}
                setCurrentDeck={setCurrentDeck}
                setModal={setModal}
              />
            )}

            {currentPath.materiaId !== null && currentPath.parcialNumber === null && (
              <ParcialesLevel
                temas={temas}
                decks={decks}
                currentPath={currentPath}
                setCurrentPath={setCurrentPath}
                handleResetPath={handleResetPath}
                activeMateriaName={activeMateriaName}
                materia={materias.find(m => (m._id || m.id) === currentPath.materiaId)}
                onActiveParcialesChange={(materiaId, newActive) => {
                  const updated = materias.map(m =>
                    (m._id || m.id) === materiaId ? { ...m, activeParciales: newActive } : m
                  );
                  setMaterias(updated);
                  localStorage.setItem(`materias_${userId}`, JSON.stringify(updated));

                  // Invalidar solo la entrada correspondiente en domainPreviews para forzar refetch inmediato
                  try {
                    const key = `domainPreviews_${userId}`;
                    const cachedRaw = localStorage.getItem(key);
                    const cached = cachedRaw ? JSON.parse(cachedRaw) : {};
                    const id = String(materiaId);
                    if (cached && Object.prototype.hasOwnProperty.call(cached, id)) {
                      delete cached[id];
                      localStorage.setItem(key, JSON.stringify(cached));
                    }
                  } catch (err) {
                    console.error('[LibrarySection] Error invalidando domainPreviews cache', err);
                  }
                }}
                filterActiveOnly={currentPath.filterActiveParciales}
                onClearFilter={() => setCurrentPath(prev => ({ ...prev, filterActiveParciales: false }))}
              />
            )}

            {currentPath.materiaId !== null && currentPath.parcialNumber !== null && currentPath.temaId === null && (
              <TemasLevel
                temas={sortedTemas}
                decks={decks}
                processedDecks={processedDecks}
                academicLoading={academicLoading}
                userId={userId}
                isAdmin={isAdmin}
                viewMode={viewMode}
                currentPath={currentPath}
                setCurrentPath={setCurrentPath}
                setAcademicModal={setAcademicModal}
                handleDeleteAcademicFolder={handleDeleteAcademicFolder}
                handleDeleteDeck={handleDeleteDeck}
                handleDeckMutation={handleDeckMutation}
                setInitialMode={setInitialMode}
                setCurrentDeck={setCurrentDeck}
                setModal={setModal}
              />
            )}

            {currentPath.materiaId !== null && currentPath.parcialNumber !== null && currentPath.temaId !== null && (
              <SubtemasLevel
                subtemas={sortedSubtemas}
                decks={decks}
                processedDecks={processedDecks}
                userId={userId}
                isAdmin={isAdmin}
                viewMode={viewMode}
                currentPath={currentPath}
                setCurrentPath={setCurrentPath}
                setAcademicModal={setAcademicModal}
                handleDeleteAcademicFolder={handleDeleteAcademicFolder}
                handleDeleteDeck={handleDeleteDeck}
                handleDeckMutation={handleDeckMutation}
                setInitialMode={setInitialMode}
                setCurrentDeck={setCurrentDeck}
                setModal={setModal}
              />
            )}
          </>
        )}
      </div>

      {academicModal && (
        <AcademicFolderModal 
          academicModal={academicModal}
          academicInput={academicInput}
          setAcademicInput={setAcademicInput}
          setAcademicModal={setAcademicModal}
          handleCreateAcademicFolder={handleCreateAcademicFolder}
          handleUpdateAcademicFolder={handleUpdateAcademicFolder}
        />
      )}

      {modal && (
        <DeckModal 
          initial={modal.editing} 
          onClose={() => setModal(null)} 
          onSave={handleSaveDeck} 
        />
      )}

      <LibraryFAB 
        currentPath={currentPath}
        setModal={setModal} 
        setAcademicModal={setAcademicModal}
        fileInputRef={fileInputRef} 
        importing={importing}
        academicModal={academicModal}
        modal={modal}
      />
    </div>
  );
}
