// FILE: frontend/src/components/HomeSection.jsx
import React, { useMemo } from 'react';
import { 
  BookOpen, 
  Layers, 
  Folder, 
  GraduationCap, 
  TrendingUp, 
  AlertCircle,
  ChevronRight,
  Loader2
} from 'lucide-react';

export default function HomeSection({ 
  userId, 
  materias,          // 🚀 Conectado al estado vivo de App.jsx
  decks,             // 🚀 Conectado al estado vivo de App.jsx
  loading,           // 🚀 Conectado al estado vivo de App.jsx
  onSelectMateria, 
  onSelectDeckLegacy 
}) {

  // =========================================================================
  // MOTOR DE PROCESAMIENTO REACTIVO (0ms)
  // Re-calcula el mapa analítico universitario cada vez que cambien los decks o materias
  // =========================================================================
  const { enrichedMaterias, unclassifiedDecks, globalStats } = useMemo(() => {
    if (!materias || !decks) {
      return { enrichedMaterias: [], unclassifiedDecks: [], globalStats: { totalCards: 0, globalMastery: 0 } };
    }

    // 1. Enriquecer las materias del usuario mapeando la nomenclatura de la librería (.name e ._id)
    const enriched = materias.map(materia => {
      const currentMateriaId = String(materia._id || materia.id || '');
      
      // Filtrar los mazos que pertenecen a esta materia de forma segura
      const materiaDecks = decks.filter(d => String(d.materiaId || '') === currentMateriaId);
      
      // Conteo molecular de tarjetas y temas
      const totalCards = materiaDecks.reduce((acc, curr) => acc + (curr.cardCount || 0), 0);
      const uniqueTemasCount = materia.themesCount || new Set(materiaDecks.map(d => d.temaId).filter(Boolean)).size;

      return {
        ...materia,
        id: currentMateriaId,
        title: materia.name || materia.title || 'Asignatura sin nombre', // Alineado con m.name de la librería
        decksCount: materiaDecks.length,
        temasCount: uniqueTemasCount,
        totalCards,
        masteryPercentage: materia.analytics?.masteryPercentage ?? 0
      };
    });

    // 2. Aislar mazos heredados (que no tienen materia asignada o cuya materia ya no existe)
    const unclassified = decks.filter(deck => {
      if (!deck.materiaId) return true;
      return !materias.some(m => String(m._id || m.id) === String(deck.materiaId));
    });

    // 3. Computar métricas globales del Dashboard
    const totalCardsGlobal = decks.reduce((acc, curr) => acc + (curr.cardCount || 0), 0);
    const activeMaterias = enriched.filter(m => m.decksCount > 0);
    const globalMasterySum = activeMaterias.reduce((acc, curr) => acc + curr.masteryPercentage, 0);
    const globalMastery = activeMaterias.length > 0 ? Math.round(globalMasterySum / activeMaterias.length) : 0;

    return {
      enrichedMaterias: enriched,
      unclassifiedDecks: unclassified,
      globalStats: { totalCards: totalCardsGlobal, globalMastery }
    };
  }, [materias, decks]);

  /**
   * SISTEMA DE COLOR DINÁMICO SEGÚN NIVEL DE CONOCIMIENTO
   */
  const getKnowledgeStyle = (percentage) => {
    if (percentage >= 80) return {
      bg: 'bg-emerald-50 dark:bg-emerald-950/20',
      border: 'border-emerald-500/20 dark:border-emerald-500/40',
      text: 'text-emerald-600 dark:text-emerald-400',
      bar: 'bg-emerald-500',
      badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    };
    if (percentage >= 50) return {
      bg: 'bg-amber-50 dark:bg-amber-950/20',
      border: 'border-amber-500/20 dark:border-amber-500/40',
      text: 'text-amber-600 dark:text-amber-400',
      bar: 'bg-amber-500',
      badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
    };
    return {
      bg: 'bg-rose-50 dark:bg-rose-950/20',
      border: 'border-rose-500/20 dark:border-rose-500/40',
      text: 'text-rose-600 dark:text-rose-400',
      bar: 'bg-rose-500',
      badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
    };
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-zinc-500 gap-2">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        <span className="text-xs font-semibold animate-pulse">Sincronizando analíticas de conocimiento...</span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8 animate-[fadeIn_0.15s_ease]">
      
      {/* Resumen Global */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-xs border border-zinc-100 dark:border-zinc-800">
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

      {/* Rejilla Principal de Materias */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-500" />
          Asignaturas y Progreso de Dominio
        </h2>
        
        {enrichedMaterias.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
            <AlertCircle className="w-8 h-8 text-zinc-400 mx-auto mb-3" />
            <p className="text-zinc-600 dark:text-zinc-400 font-medium">No se encontraron materias creadas.</p>
            <p className="text-sm text-zinc-400 mt-1">Dirígete a la sección de "Librería" para dar de alta tu primera asignatura.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {enrichedMaterias.map((materia) => {
              const styles = getKnowledgeStyle(materia.masteryPercentage);
              
              return (
                <div 
                  key={materia.id}
                  onClick={() => onSelectMateria(materia)}
                  className={`group relative p-5 rounded-2xl border ${styles.border} ${styles.bg} transition-all duration-200 hover:shadow-md hover:scale-[1.01] cursor-pointer flex flex-col justify-between`}
                >
                  <div>
                    <div className="flex justify-between items-start gap-3">
                      <h3 className="text-lg font-bold text-zinc-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                        {materia.title}
                      </h3>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${styles.badge}`}>
                        Dominio {materia.masteryPercentage}%
                      </span>
                    </div>

                    {/* Barra de progreso visual */}
                    <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full mt-3 overflow-hidden">
                      <div 
                        className={`h-full ${styles.bar} transition-all duration-500`} 
                        style={{ width: `${materia.masteryPercentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Bloque Metatablas solicitado (Temas, Mazos, Tarjetas) */}
                  <div className="mt-6 pt-4 border-t border-zinc-200/50 dark:border-zinc-800/50 grid grid-cols-3 gap-2 text-center">
                    <div className="flex flex-col items-center">
                      <Layers className="w-4 h-4 text-zinc-400 mb-1" />
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-300">{materia.temasCount}</span>
                      <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Temas</span>
                    </div>
                    
                    <div className="flex flex-col items-center">
                      <Folder className="w-4 h-4 text-zinc-400 mb-1" />
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-300">{materia.decksCount}</span>
                      <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Mazos</span>
                    </div>

                    <div className="flex flex-col items-center">
                      <TrendingUp className="w-4 h-4 text-zinc-400 mb-1" />
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-300">{materia.totalCards}</span>
                      <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Tarjetas</span>
                    </div>
                  </div>

                  <div className="absolute top-1/2 right-2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-zinc-400">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Retrocompatibilidad: Mazos sin clasificar */}
      {unclassifiedDecks.length > 0 && (
        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Mazos Fuera de la Jerarquía ({unclassifiedDecks.length})
            </h3>
            <p className="text-xs text-zinc-400">Mazos sueltos que puedes reubicar dentro de tus materias asignadas.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {unclassifiedDecks.map((deck) => (
              <div
                key={deck.id || deck._id}
                onClick={() => onSelectDeckLegacy(deck)}
                style={{ borderLeftColor: deck.coverColor || '#a1a1aa' }}
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
