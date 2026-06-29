// FILE: frontend/src/hooks/useLibraryState.js
import { useState, useEffect, useMemo, useCallback } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export function useLibraryState(userId, decks, materias, setDecks, setMaterias, loadDecks) {
  const [currentPath, setCurrentPath] = useState({
    materiaId: null,
    parcialNumber: null,
    temaId: null,
    subtemaId: null
  });

  const [temas, setTemas] = useState([]);
  const [subtemas, setSubtemas] = useState([]);
  const [academicLoading, setAcademicLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [viewMode, setViewMode] = useState('grid');

  const refreshTemas = useCallback(async () => {
    if (!currentPath.materiaId) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/academic/temas/${currentPath.materiaId}`);
      if (res.ok) setTemas(await res.json());
    } catch (e) {
      console.error("Error cargando temas:", e);
    }
  }, [currentPath.materiaId]);

  // Carga reactiva de Temas
  useEffect(() => {
    if (!currentPath.materiaId) {
      setTemas([]);
      return;
    }
    setAcademicLoading(true);
    refreshTemas().finally(() => setAcademicLoading(false));
  }, [currentPath.materiaId]);

  // Carga reactiva de Subtemas
  useEffect(() => {
    if (!currentPath.temaId) {
      setSubtemas([]);
      return;
    }
    const fetchSubtemas = async () => {
      setAcademicLoading(true);
      try {
        const res = await fetch(`${BACKEND_URL}/api/academic/subtemas/${currentPath.temaId}`);
        if (res.ok) setSubtemas(await res.json());
      } catch (e) {
        console.error("Error cargando subtemas:", e);
      } finally { setAcademicLoading(false); }
    };
    fetchSubtemas();
  }, [currentPath.temaId]);

  // Motor de Filtrado Molecular Contextual (0ms)
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

  const handleResetPath = useCallback(() => {
    setCurrentPath({ materiaId: null, parcialNumber: null, temaId: null, subtemaId: null });
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
    handleResetPath,
    refreshTemas
  };
}
