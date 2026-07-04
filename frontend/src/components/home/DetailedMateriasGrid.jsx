import React from 'react';
import { BookOpen, AlertCircle } from 'lucide-react';

export default function DetailedMateriasGrid({ 
  enrichedMaterias, 
  getKnowledgeAccent, 
  getParcialesLabel 
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-indigo-500" />
        Tus Asignaturas (Detalle)
      </h2>
      
      {enrichedMaterias.length === 0 ? (
        <div className="p-10 text-center rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
          <AlertCircle className="w-7 h-7 text-zinc-400 mx-auto mb-2" />
          <p className="text-zinc-700 dark:text-zinc-300 text-xs font-bold">
            No tienes materias configuradas.
          </p>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Ve a la sección de Archivos para crear tu primera materia raíz.
          </p>
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
                  {getParcialesLabel(materia.activeParciales) && (
                    <span className="inline-block mt-1.5 text-[9px] font-bold text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded">
                      {getParcialesLabel(materia.activeParciales)}
                    </span>
                  )}
                </div>

                <div className="mt-5 pt-3.5 border-t border-zinc-100 dark:border-zinc-800/60 grid grid-cols-3 gap-1 text-center">
                  <div>
                    <span className="block text-xs font-bold text-zinc-700 dark:text-zinc-200">
                      {materia.temasCount}
                    </span>
                    <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider">
                      Temas
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-zinc-700 dark:text-zinc-200">
                      {materia.decksCount}
                    </span>
                    <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider">
                      Mazos
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-zinc-700 dark:text-zinc-200">
                      {materia.totalCards}
                    </span>
                    <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider">
                      Tarjetas
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

