import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getJSON, setJSON } from '../../lib/safeLocalStorage';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const CACHE_TTL_MS = 5 * 60 * 1000;

export default function useQuickViewMaterias({ userId, enrichedMaterias }) {
  const [selectedMaterias, setSelectedMaterias] = useState([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const isMounted = useRef(false);
  const abortController = useRef(null);

  useEffect(() => {
    if (!userId) {
      setSelectedMaterias([]);
      setIsInitialLoad(false);
      return;
    }

    isMounted.current = true;
    setIsInitialLoad(true);

    const loadPreferences = async () => {
      const cached = getJSON(`quickView_materias_${userId}`);
      const cachedTimestamp = getJSON(`quickView_materias_${userId}_ts`);

      if (cached && isMounted.current) {
        setSelectedMaterias(cached);
      }

      const cacheAge = cachedTimestamp ? Date.now() - Number(cachedTimestamp) : Infinity;
      const needsSync = cacheAge > CACHE_TTL_MS;

      if (!needsSync) {
        if (isMounted.current) setIsInitialLoad(false);
        return;
      }

      if (abortController.current) abortController.current.abort();
      abortController.current = new AbortController();

      try {
        const res = await fetch(`${BACKEND_URL}/api/users/${userId}/preferences`, {
          signal: abortController.current.signal
        });

        if (!isMounted.current) return;

        if (res.ok) {
          const data = await res.json();
          const serverMaterias = data.quickViewMaterias || [];

          setSelectedMaterias((prev) => {
            if (JSON.stringify(prev) === JSON.stringify(serverMaterias)) return prev;
            setJSON(`quickView_materias_${userId}`, serverMaterias);
            setJSON(`quickView_materias_${userId}_ts`, Date.now());
            return serverMaterias;
          });
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('[useQuickViewMaterias] Error al sincronizar:', error);
        }
      } finally {
        if (isMounted.current) setIsInitialLoad(false);
      }
    };

    loadPreferences();

    return () => {
      isMounted.current = false;
      if (abortController.current) abortController.current.abort();
    };
  }, [userId]);

  const savePreferences = useCallback(async (materiasIds) => {
    if (!userId) return;

    setJSON(`quickView_materias_${userId}`, materiasIds);
    setJSON(`quickView_materias_${userId}_ts`, Date.now());

    try {
      const res = await fetch(`${BACKEND_URL}/api/users/${userId}/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quickViewMaterias: materiasIds })
      });

      if (!res.ok) throw new Error('Error al sincronizar');
    } catch (error) {
      console.error('[useQuickViewMaterias] Error en sync:', error);
    }
  }, [userId]);

  const toggleMateria = useCallback((materiaId) => {
    setSelectedMaterias((prev) => {
      const nextSelection = prev.includes(materiaId)
        ? prev.filter((id) => id !== materiaId)
        : [...prev, materiaId];

      savePreferences(nextSelection);
      return nextSelection;
    });
  }, [savePreferences]);

  const selectAll = useCallback(() => {
    const allIds = enrichedMaterias.map((materia) => materia.id);
    setSelectedMaterias(allIds);
    savePreferences(allIds);
  }, [enrichedMaterias, savePreferences]);

  const clearAll = useCallback(() => {
    setSelectedMaterias([]);
    savePreferences([]);
  }, [savePreferences]);

  const visibleMaterias = useMemo(() => {
    if (selectedMaterias.length === 0) return [];
    return enrichedMaterias.filter((materia) => selectedMaterias.includes(materia.id));
  }, [enrichedMaterias, selectedMaterias]);

  return {
    selectedMaterias,
    visibleMaterias,
    isInitialLoad,
    toggleMateria,
    selectAll,
    clearAll
  };
}
