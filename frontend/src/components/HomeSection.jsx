// FILE: frontend/src/components/HomeSection.jsx
import React, { useMemo, useEffect, useState, useCallback } from 'react';
import RadarDebugPanel from './RadarDebugPanel';
import GlobalStatsHeader from './home/GlobalStatsHeader';
import QuickViewGrid from './home/QuickViewGrid';
import DetailedMateriasGrid from './home/DetailedMateriasGrid';
import UnclassifiedDecksSection from './home/UnclassifiedDecksSection';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export default function HomeSection({ 
  user,          
  decks,         
  materias,      
  onOpenReview,  
  onLogout,
  loadDecks,     
  loadMaterias   
}) {
  const [homeVisibility, setHomeVisibility] = useState({
    quickView: true,
    detailedView: false,
    unclassifiedDecks: false
  });

  // =========================================================================
  // 🔄 DISPARADOR DE SINCRONIZACIÓN PASIVA EN SEGUNDO PLANO
  // =========================================================================
  useEffect(() => {
    if (typeof loadDecks === 'function') loadDecks();
    if (typeof loadMaterias === 'function') loadMaterias();
  }, [loadDecks, loadMaterias]);

  // Cargar preferencias de visibilidad del home
  useEffect(() => {
    if (!user?.id) return;
    
    const loadVisibility = async () => {
      try {
        const res = await fetch(`<LaTex>id_2</LaTex>{user.id}/preferences`);
        if (res.ok) {
          const data = await res.json();
          if (data.homeSectionVisibility) {
            setHomeVisibility(data.homeSectionVisibility);
          }
        }
      } catch (error) {
        console.error('Error al cargar visibilidad del home:', error);
      }
    };
    
    loadVisibility();
  }, [user?.id]);

  const [domainPreviews, setDomainPreviews] = useState({});

  const fetchDomainPreviews = useCallback(async () => {
    if (!materias) return;
    const filtered = materias.filter(m => {
      const ap = m.activeParciales;
      return ap && ap.length > 0 && ap.length < 3;
    });
    if (filtered.length === 0) return;

    const results = {};
    await Promise.all(filtered.map(async (m) => {
      try {
        const id = m._id || m.id;
        const res = await fetch(`<LaTex>id_1</LaTex>{id}/domain-preview?parciales=${m
