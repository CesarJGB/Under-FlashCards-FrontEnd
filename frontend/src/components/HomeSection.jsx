// FILE: frontend/src/components/HomeSection.jsx
import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Layers, 
  Folder, 
  GraduationCap, 
  TrendingUp, 
  Award, 
  ChevronRight, 
  AlertCircle 
} from 'lucide-react';

export default function HomeSection({ onSelectMateria, onSelectDeckLegacy }) {
  const [materias, setMaterias] = useState([]);
  const [unclassifiedDecks, setUnclassifiedDecks] = useState([]);
  const [globalStats, setGlobalStats] = useState({ totalCards: 0, globalMastery: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ESTRATEGIA HÍBRIDA (0ms): Carga síncrona inmediata desde LocalStorage
    try {
      const session = JSON.parse(localStorage.getItem('user_session'));
      const userId = session?.id;

      if (userId) {
        const localMaterias = JSON.parse(localStorage.getItem(`materias_${userId}`)) || [];
        const localDecks = JSON.parse(localStorage.getItem(`decks_${userId}`)) || [];

        // 1. Separar mazos asignados de los heredados (retrocompatibilidad)
        const unclassified = localDecks.filter(deck => !deck.materiaId);
        
        // 2. Procesar y enriquecer las materias con conteos vivos del cliente
        const enrichedMaterias = localMaterias.map(materia => {
          const materiaDecks = localDecks.filter(d => d.materiaId === materia.id || d.materiaId === materia._id);
          
          // Agregaciones flash de tarjetas y temas
          const totalCards = materiaDecks.reduce((acc, curr) => acc + (curr.cardCount || 0), 0);
          
          // El número de temas únicos se calcula de los mazos o del contador del backend
          const uniqueTemasCount = materia.themesCount || new Set(materiaDecks.map(d => d.temaId).filter(Boolean)).size;

          return {
            ...materia,
            decksCount: materiaDecks.length,
            temasCount: uniqueTemasCount,
            totalCards,
            // Recuperamos el porcentaje del nuevo motor embebido en el modelo
            masteryPercentage: materia.analytics?.masteryPercentage ?? 0
          };
        });

        // 3. Calcular Métricas Globales del Dashboard
        const totalCardsGlobal = localDecks.reduce((acc, curr) => acc + (curr.cardCount || 0), 0);
        const activeMateriasWithMastery = enrichedMaterias.filter(m => m.decksCount > 0);
        const globalMasterySum = activeMateriasWithMastery.reduce((acc, curr) => acc + curr.masteryPercentage, 0);
        const globalMastery = activeMateriasWithMastery.length > 0 
          ? Math.round(globalMasterySum / activeMateriasWithMastery.length) 
          : 0;

        setMaterias(enrichedMaterias);
        setUnclassifiedDecks(unclassified);
        setGlobalStats({ totalCards: totalCardsGlobal, globalMastery });
      }
    } catch (error) {
      console.error("Error leyendo caché local en HomeSection:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * SISTEMA DE COLOR DINÁMICO SEGÚN NIVEL DE CONOCIMIENTO
   * Mapea los rangos del motor de métricas a tokens de color de Tailwind semánticos.
   */
  const getKnowledgeStyle = (percentage) => {
    if (percentage >= 80) return {
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
      border: 'border-emerald-500/30',
      text: 'text-emerald-600 dark:text-emerald-400',
      bar: 'bg-emerald-500',
      badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    };
    if (percentage >= 50) return {
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      border: 'border-amber-500/30',
      text: 'text-amber-600 dark:text-amber-400',
      bar: 'bg-amber-500',
      badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
    };
    return {
      bg: 'bg-rose-50 dark:bg-rose-950/30',
      border: 'border-rose-500/30',
      text: 'text-rose-600 dark:text-rose-400',
      bar: 'bg-rose-500',
      badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
    };
  };

  if (loading) {
    return <div className="p-6 text-center text-gray-500 animate-pulse">Cargando tu mapa académico...</div>;
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      
      {/* 1. CABECERA UNIFICADA & RESUMEN GLOBAL */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Mi Espacio Universitario</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Estructura académica de parciales fijos y medición activa de conocimiento.</p>
        </div>
        
        <div className="flex items-center gap-6 divide-x divide-zinc-200 dark:divide-zinc-800">
          <div className="px-2">
            <span className="block text-xs font-medium text-zinc-400 uppercase tracking-wider">Tarjetas Totales</span>
            <span className="text-xl font-bold text-zinc-800 dark:text-zinc-200">{globalStats.totalCards}</span>
          </div>
          <div className="pl-6">
            <span className="block text-xs font-medium text-zinc-400 uppercase tracking-wider">Dominio General</span>
            <div className="flex items-center gap-2 mt-0.5">
              <GraduationCap className="w-5 h-5 text-indigo-500" />
              <span className="text-xl font-bold text-zinc-800 dark:text-zinc-200">{globalStats.globalMastery}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. REJILLA DE MATERIAS (FOCO PRINCIPAL) */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-500" />
          Asignaturas y Progreso de Dominio
        </h2>
        
        {materias.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
            <AlertCircle className="w-8 h-8 text-zinc-400 mx-auto mb-3" />
            <p className="text-zinc-600 dark:text-zinc-400 font-medium">No has registrado materias aún.</p>
            <p className="text-sm text-zinc-400 mt-1">Crea tu primera asignatura para estructurar tus parciales.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {materias.map((materia) => {
              const styles = getKnowledgeStyle(materia.masteryPercentage);
              
              return (
                <div 
                  key={materia.id || materia._id}
                  onClick={() => onSelectMateria(materia)}
                  className={`group relative p-5 rounded-2xl border ${styles.border} ${styles.bg} transition-all duration-200 hover:shadow-md hover:scale-[1.01] cursor-pointer flex flex-col justify-between`}
                >
                  <div>
                    {/* Header Tarjeta */}
                    <div className="flex justify-between items-start gap-3">
                      <h3 className="text-lg font-bold text-zinc-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                        {materia.title || materia.nombre}
                      </h3>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${styles.badge}`}>
                        Dominio {materia.masteryPercentage}%
                      </span>
                    </div>

                    {/* Barra de Progreso Visual */}
                    <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full mt-3 overflow-hidden">
                      <div 
                        className={`h-full ${styles.bar} transition-all duration-500`} 
                        style={{ width: `${materia.masteryPercentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Bloque Temas, Mazos y Tarjetas (Métricas Solicitadas) */}
                  <div className="mt-6 pt-4 border-t border-zinc-200/50 dark:border-zinc-800/50 grid grid-cols-3 gap-2 text-center">
                    <div className="flex flex-col items-center">
                      <Layers className="w-4 h-4 text-zinc-400 mb-1" />
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-300">{materia.temasCount}</span>
                      <span className="text-[10px] text-zinc-400 font-medium uppercase">Temas</span>
                    </div>
                    
                    <div className="flex flex-col items-center">
                      <Folder className="w-4 h-4 text-zinc-400 mb-1" />
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-300">{materia.decksCount}</span>
                      <span className="text-[10px] text-zinc-400 font-medium uppercase">Mazos</span>
                    </div>

                    <div className="flex flex-col items-center">
                      <TrendingUp className="w-4 h-4 text-zinc-400 mb-1" />
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-300">{materia.totalCards}</span>
                      <span className="text-[10px] text-zinc-400 font-medium uppercase">Tarjetas</span>
                    </div>
                  </div>

                  {/* Micro-indicador flotante de navegación */}
                  <div className="absolute top-1/2 right-2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-zinc-400">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. RETROCOMPATIBILIDAD: MAZOS SIN CLASIFICAR */}
      {unclassifiedDecks.length > 0 && (
        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Mazos Sin Clasificar ({unclassifiedDecks.length})
              </h3>
              <p className="text-xs text-zinc-400">Mazos heredados que no han sido organizados en la jerarquía académica.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {unclassifiedDecks.map((deck) => (
              <div
                key={deck.id || deck._id}
                onClick={() => onSelectDeckLegacy(deck)}
                style={{ borderLeftColor: deck.coverColor || '#zinc-400' }}
                className="p-3 bg-white dark:bg-zinc-900 border-l-4 border-y border-r border-zinc-200 dark:border-zinc-800 rounded-xl cursor-pointer hover:shadow-sm hover:translate-y-[-1px] transition-all"
              >
                <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 truncate">{deck.title}</h4>
                <p className="text-[10px] text-zinc-400 mt-1">{deck.cardCount || 0} tarjetas</p>
                {deck.analytics?.masteryPercentage !== undefined && (
                  <span className="text-[9px] font-medium text-indigo-500 block mt-0.5">
                    {deck.analytics.masteryPercentage}% dom.
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
