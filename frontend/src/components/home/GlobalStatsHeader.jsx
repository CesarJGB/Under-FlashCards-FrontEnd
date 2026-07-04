import React from 'react';
import { GraduationCap } from 'lucide-react';

export default function GlobalStatsHeader({ user, globalStats }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200/60 dark:border-zinc-800 shadow-3xs">
      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight">
          ¡Hola, {user?.name?.split(' ')[0] || 'Estudiante'}!
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          Este es el estado de tu mapa de conocimiento universitario.
        </p>
      </div>
      
      <div className="flex items-center gap-6 divide-x divide-zinc-200 dark:divide-zinc-800">
        <div className="px-1">
          <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
            Tarjetas Totales
          </span>
          <span className="text-lg font-black text-zinc-800 dark:text-zinc-200">
            {globalStats.totalCards}
          </span>
        </div>
        <div className="pl-6">
          <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
            Dominio Global
          </span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <GraduationCap className="w-4 h-4 text-indigo-500" />
            <span className="text-lg font-black text-zinc-800 dark:text-zinc-200">
              {globalStats.globalMastery}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

