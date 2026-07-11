// FILE: frontend/src/hooks/useLibraryState.js
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

function getObjectIdTimestamp(id) {
  if (!id || typeof id !== 'string' || id.length !== 24) return 0;
  return parseInt(id.substring(0, 8), 16) * 1000;
}

function sortFolders(items, sortBy, decks, getDecksForItem) {
  const sorted = [...items];
  if (sortBy === 'alpha') {
    sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } else if (sortBy === 'recent') {
    sorted.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : getObjectIdTimestamp(a._id);
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : getObjectIdTimestamp(b._id);
      return tb - ta;
    });
  } else if (sortBy === 'oldest') {
    sorted.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : getObjectIdTimestamp(a._id);
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : getObjectIdTimestamp(b._id);
      return ta - tb;
    });
  } else if (sortBy === 'cards-desc' || sortBy === 'cards-asc') {
    const countMap = new Map();
    sorted.forEach(item => {
      const itemDecks = getDecksForItem(item);
      const total = itemDecks.reduce((sum, d) => sum + (d.cardCount ?? d.cards?.length ?? d.cardsCount ?? 0), 0);
      countMap.set(item._id, total);
    });
    sorted.sort((a, b) => sortBy === 'cards-desc'
      ? (countMap.get(b._id) || 0) - (countMap.get(a._id) || 0)
      : (countMap.get(a._id) || 0) - (countMap.get(b._id) || 0)
    );
  }
  return sorted;
}

export function useLibraryState(userId, decks, materias, setDecks, setMaterias, loadDecks) {
  const [currentPath, setCurrentPath] = useState({
    materiaId: null,
    parcialNumber: null,
    temaId: null,
    subtemaId: null,
    filterActiveParciales: false 
  });

  const [temas, setTemasState] = useState([]);
  const [subtemas, setSubtemasState] = useState([]);
  const [academicLoading, setAcademicLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [viewMode, setViewMode] = useState('grid');
  const temasCacheRef = useRef(new Map());
  const subtemasCacheRef = useRef(new Map());

  const setTemas = useCallback((nextValue) => {
    setTemasState((prev) => {
      const nextTemas = typeof nextValue === 'function' ? nextValue(prev) : nextValue;
      if (currentPath.materiaId) {
        temasCacheRef.current.set(String(currentPath.materiaId), nextTemas);
      }
      return nextTemas;
    });
  }, [currentPath.materiaId]);

  const setSubtemas = useCallback((nextValue) => {
    setSubtemasState((prev) => {
      const nextSubtemas = typeof nextValue === 'function' ? nextValue(prev) : nextValue;
      if (currentPath.temaId) {
        subtemasCacheRef.current.set(String(currentPath.temaId), nextSubtemas);
      }
      return nextSubtemas;
    });
  }, [currentPath.temaId]);

  const refreshTemas = useCallback(async () => {
    if (!currentPath.materiaId) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/academic/temas/${currentPath.materiaId}`);
      if (res.ok) {
        const data = await res.json();
        temasCacheRef.current.set(String(currentPath.materiaId), data);
        setTemasState(data);
      }
    } catch (e) {
      console.error("Error cargando temas:", e);
    }
  }, [currentPath.materiaId]);

  useEffect(() => {
    if (!currentPath.materiaId) {
      setAcademicLoading(false);
      setTemasState([]);
      return;
    }

    const cachedTemas = temasCacheRef.current.get(String(currentPath.materiaId));
    if (cachedTemas) {
      setAcademicLoading(false);
      setTemasState(cachedTemas);
      return;
    }

    setTemasState([]);
    setAcademicLoading(true);
    refreshTemas().finally(() => setAcademicLoading(false));
  }, [currentPath.materiaId, refreshTemas]);

  const refreshSubtemas = useCallback(async () => {
    if (!currentPath.temaId) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/academic/subtemas/${currentPath.temaId}`);
      if (res.ok) {
        const data = await res.json();
        subtemasCacheRef.current.set(String(currentPath.temaId), data);
        setSubtemasState(data);
      }
    } catch (e) {
      console.error("Error cargando subtemas:", e);
    }
  }, [currentPath.temaId]);

  useEffect(() => {
    if (!currentPath.temaId) {
      setAcademicLoading(false);
      setSubtemasState([]);
      return;
    }

    const cachedSubtemas = subtemasCacheRef.current.get(String(currentPath.temaId));
    if (cachedSubtemas) {
      setAcademicLoading(false);
      setSubtemasState(cachedSubtemas);
      return;
    }

    setSubtemasState([]);
    setAcademicLoading(true);
    refreshSubtemas().finally(() => setAcademicLoading(false));
  }, [currentPath.temaId, refreshSubtemas]);

  const processedDecks = useMemo(() => {
    let result = decks.filter((deck) => {
      const matchesSearch = deck.title?.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (currentPath.materiaId === null) return deck.materiaId === null;
      if (currentPath.parcialNumber === null) return false;
      if (currentPath.temaId === null) {
        return deck.materiaId === currentPath.materiaId && deck.parcialNumber === currentPath.parcialNumber && deck.temaId === null;
      }
      if (currentPath.subtemaId === null) {
        return deck.temaId === currentPath.temaId && deck.subtemaId === null;
      }
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

  const sortedMaterias = useMemo(() => {
    return sortFolders(materias, sortBy, decks, (m) => decks.filter(d => d.materiaId === m._id));
  }, [materias, sortBy, decks]);

  const sortedTemas = useMemo(() => {
    const filtered = temas.filter(t => t.parcialNumber === (currentPath.parcialNumber));
    return sortFolders(filtered, sortBy, decks, (t) => decks.filter(d => d.temaId === t._id));
  }, [temas, sortBy, decks, currentPath.parcialNumber]);

  const sortedSubtemas = useMemo(() => {
    return sortFolders(subtemas, sortBy, decks, (s) => decks.filter(d => d.subtemaId === s._id));
  }, [subtemas, sortBy, decks]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    const results = [];

    materias.forEach(m => {
      if (m.name?.toLowerCase().includes(q)) {
        results.push({ type: 'materia', item: m, path: m.name });
      }
    });

    temas.forEach(t => {
      if (t.name?.toLowerCase().includes(q)) {
        const materia = materias.find(m => m._id === t.materiaId);
        results.push({
          type: 'tema', item: t,
          path: `${materia?.name || 'Materia'} > P${t.parcialNumber} > ${t.name}`,
          nav: { materiaId: t.materiaId, parcialNumber: t.parcialNumber, temaId: t._id, subtemaId: null }
        });
      }
    });

    subtemas.forEach(s => {
      if (s.name?.toLowerCase().includes(q)) {
        const tema = temas.find(t => t._id === s.temaId);
        const materia = tema ? materias.find(m => m._id === tema.materiaId) : null;
        results.push({
          type: 'subtema', item: s,
          path: `${materia?.name || '?'} > P${tema?.parcialNumber || '?'} > ${tema?.name || '?'} > ${s.name}`,
          nav: { materiaId: tema?.materiaId, parcialNumber: tema?.parcialNumber, temaId: s.temaId, subtemaId: s._id }
        });
      }
    });

    decks.forEach(d => {
      if (!d.materiaId) return;
      if (!d.title?.toLowerCase().includes(q)) return;
      const materia = materias.find(m => m._id === d.materiaId);
      const tema = d.temaId ? temas.find(t => t._id === d.temaId) : null;
      const subtema = d.subtemaId ? subtemas.find(s => s._id === d.subtemaId) : null;
      let path = materia?.name || 'Materia';
      if (d.parcialNumber) path += ` > P${d.parcialNumber}`;
      if (tema) path += ` > ${tema.name}`;
      if (subtema) path += ` > ${subtema.name}`;
      results.push({
        type: 'deck', item: d, path,
        nav: { materiaId: d.materiaId, parcialNumber: d.parcialNumber, temaId: d.temaId, subtemaId: d.subtemaId }
      });
    });

    return results;
  }, [searchQuery, materias, temas, subtemas, decks]);

  const handleResetPath = useCallback(() => {
    setCurrentPath({ 
      materiaId: null, 
      parcialNumber: null, 
      temaId: null, 
      subtemaId: null,
      filterActiveParciales: false 
    });
  }, []);

  return {
    currentPath,
    setCurrentPath,
    temas,
    setTemas,
    subtemas,
    setSubtemas,
    academicLoading,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
    processedDecks,
    sortedMaterias,
    sortedTemas,
    sortedSubtemas,
    searchResults,
    handleResetPath,
    refreshTemas
  };
}
