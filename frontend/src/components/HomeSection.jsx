// FILE: frontend/src/components/HomeSection.jsx
import React, { useMemo } from 'react';
import { 
  BookOpen, 
  Layers, 
  Folder, 
  GraduationCap, 
  TrendingUp, 
  AlertCircle,
  ChevronRight
} from 'lucide-react';
import RadarDebugPanel from './RadarDebugPanel'; // 👈 NUEVO: Importación del panel de control analítico

export default function HomeSection({ 
  user,          
  decks,         
  materias,      
  onOpenReview,  
  onLogout,
  loadDecks,     // 👈 NUEVO: Propagación de refresco de caché de red
  loadMaterias   // 👈 NUEVO: Propagación de refresco de caché de red
}) {

  // =========================================================================
  // MOTOR DE PROCESAMIENTO REACTIVO EN MEMORIA (0ms)
  // =========================================================================
  const { enrichedMaterias, unclassifiedDecks, globalStats } = useMemo(() => {
    if (!materias || !decks) {
      return { enrichedMaterias: [], unclassifiedDecks: [], globalStats: { totalCards: 0, globalMastery: 0 } };
    }

    const enriched = materias.map(materia => {
      const currentMateriaId = String(materia._id || materia.id || '');
      const materiaDecks = decks.filter(d => String(d.materiaId || '') === currentMateriaId);
      const totalCards = materiaDecks.reduce((acc, curr) => acc + (curr.cardCount || 0), 0);
      const uniqueTemasCount = materia.themesCount || new Set(materiaDecks.map(d => d.temaId).filter(Boolean)).size;

      return {
        ...materia,
        id: currentMateriaId,
        title: materia.name || materia.title || 'Asignatura sin nombre',
        decksCount: materiaDecks.length,
        temasCount: uniqueTemasCount,
        totalCards,
        masteryPercentage: materia.analytics?.masteryPercentage ?? 0
      };
    });

    const unclassified = decks.filter(deck => {
      if (!deck.materiaId) return true;
      return !materias.some(m => String(m._id || m.id) === String(deck.materiaId));
    });

    const totalCardsGlobal = decks.reduce((acc, curr) => acc + (curr.cardCount || 0), 0);
    const activeMaterias = enriched.filter(m => m.decksCount > 0);
    const globalMasterySum = activeMaterias.reduce((acc, curr) => acc + curr.masteryPercentage, 0);
    const globalMastery = activeMaterias.length > 0 ? Math.round(globalMasterySum / activeMaterias.length) : 0;

    return {
      enrichedMaterias: enriched,
      unclassifiedDecks: unclassified,
      globalStats: { totalCards: totalCardsGlobal, globalMastery }
    };
  }, [materias, decks, user]);

  /**
   * REFACTORIZACIÓN DE ESTILOS: Control de acentos semánticos de alta legibilidad
   * Mantiene el fondo neutro y distribuye el color únicamente en componentes clave.
   */
  const getKnowledgeAccent = (percentage) => {
    if (percentage >= 80) return {
      borderLeft: 'border-l-emerald-500',
      badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      bar: 'bg-emerald-500'
    };
    if (percentage >= 50) return {
      borderLeft: 'border-l-amber-500',
      badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      bar: 'bg-amber-500'
    };
    return {
      borderLeft: 'border-l-rose-500',
      badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400', 
      bar: 'bg-rose-500'
    };
  };

  return (
    <div className="w-full space-y-8 animate-[fadeIn_0.15s_ease]">
      
      {/* Resumen Global */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 shadow-3xs">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight">
            ¡Hola, {user?.name?.split(' ')[0] || 'Estudiante'}!
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Este es el estado de tu mapa de conocimiento universitario.</p>
        </div>
        
        <div className="flex items-center gap-6 divide-x divide-zinc-200 dark:divide-zinc-800">
          <div className="px-1">
            <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Tarjetas Totales</span>
            <span className="text-lg font-black text-zinc-800 dark:text-zinc-200">{globalStats.totalCards}</span>
          </div>
          <div className="pl-6">
            <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Dominio Global</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <GraduationCap className="w-4 h-4 text-indigo-500" />
              <span className="text-lg font-black text-zinc-800 dark:text-zinc-200">{globalStats.globalMastery}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Rejilla de Materias */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-500" />
          Tus Asignaturas
        </h2>
        
        {enrichedMaterias.length === 0 ? (
          <div className="p-10 text-center rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
            <AlertCircle className="w-7 h-7 text-zinc-400 mx-auto mb-2" />
            <p className="text-zinc-700 dark:text-zinc-300 text-xs font-bold">No tienes materias configuradas.</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">Ve a la sección de Archivos para crear tu primera materia raíz.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {enrichedMaterias.map((materia) => {
              const accent = getKnowledgeAccent(materia.masteryPercentage);
              
              return (
                <div 
                  key={materia.id}
                  className={`group relative bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200/70 dark:border-zinc-800 border-l-4 ${accent.borderLeft} transition-all duration-200 hover:shadow-sm flex flex-col justify-between`}
                >
                  <div>
                    <div className="flex justify-between items-start gap-3">
                      <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate max-w-[70%]">
                        {materia.title}
                      </h3>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md shrink-0 tracking-wide ${accent.badge}`}>
                        {materia.masteryPercentage}% DOMINIO
                      </span>
                    </div>

                    <div className="w-full bg-zinc-100 dark:bg-zinc-800/80 h-1.5 rounded-full mt-3 overflow-hidden">
                      <div 
                        className={`h-full ${accent.bar} rounded-full transition-all duration-500`} 
                        style={{ width: `${materia.masteryPercentage}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-5 pt-3.5 border-t border-zinc-100 dark:border-zinc-800/60 grid grid-cols-3 gap-1 text-center">
                    <div>
                      <span className="block text-xs font-bold text-zinc-700 dark:text-zinc-200">{materia.temasCount}</span>
                      <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Temas</span>
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-zinc-700 dark:text-zinc-200">{materia.decksCount}</span>
                      <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Mazos</span>
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-zinc-700 dark:text-zinc-200">{materia.totalCards}</span>
                      <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Tarjetas</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Retrocompatibilidad: Mazos sueltos */}
      {unclassifiedDecks.length > 0 && (
        <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800">
          <div className="mb-3">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Mazos Fuera de la Jerarquía ({unclassifiedDecks.length})
            </h3>
            <p className="text-[11px] text-zinc-400">Presiona un mazo para iniciar un repaso de contingencia inmediato.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {unclassifiedDecks.map((deck) => (
              <div
                key={deck.id || deck._id}
                onClick={() => onOpenReview(deck)} 
                style={{ borderLeftColor: deck.coverColor || '#cbd5e1' }}
                className="p-3 bg-white dark:bg-zinc-900 border-l-4 border-y border-r border-zinc-200 dark:border-zinc-800 rounded-xl cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-600 hover:translate-y-[-1px] transition-all group flex flex-col justify-between min-h-[70px]"
              >
                <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 truncate group-hover:text-indigo-600 transition-colors">{deck.title}</h4>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-zinc-400 font-medium">{deck.cardCount || 0} cards</span>
                  {deck.analytics?.masteryPercentage !== undefined && (
                    <span className="text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded">
                      {deck.analytics.masteryPercentage}% d.
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ⚡ PANEL DE TELEMETRÍA Y DEBUGGING DEL RADAR DE CONOCIMIENTO (Abajo del todo) */}
      <RadarDebugPanel 
        userId={user?.id}
        decks={decks}
        loadDecks={loadDecks}
        loadMaterias={loadMaterias}
      />

    </div>
  );
}
