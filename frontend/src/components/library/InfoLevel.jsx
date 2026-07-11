// FILE: frontend/src/components/library/InfoLevel.jsx
import React, { useState } from 'react';
import { FileText, BarChart3 } from 'lucide-react';
import EvaluacionLevel from './info/EvaluacionLevel'; // 👈 Importamos el nuevo componente
import MetricsLevel from './info/MetricsLevel';
import PublicProfileCard from './info/PublicProfileCard';

export default function InfoLevel({ materia, currentPath, setCurrentPath, materias, setMaterias, userId }) {
  // 💡 Estado local para controlar el sub-apartado dentro de Info
  const [view, setView] = useState('menu'); // 'menu' | 'evaluacion' | 'metricas'

  // Si el usuario entra a evaluación, renderizamos ese componente
  if (view === 'evaluacion') {
    return (
      <EvaluacionLevel
        materia={materia}
        onBack={() => setView('menu')}
        materias={materias}
        setMaterias={setMaterias}
        userId={userId}
      />
    );
  }

  if (view === 'metricas') {
    return (
      <MetricsLevel
        materia={materia}
        userId={userId}
        onBack={() => setView('menu')}
      />
    );
  }

  // Vista por defecto: Menú de opciones
  return (
    <div className="mt-4 animate-[fadeIn_0.15s_ease] space-y-6">
      
      {/* Grid de Secciones Interiores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        <PublicProfileCard
          materia={materia}
          materias={materias}
          setMaterias={setMaterias}
          userId={userId}
        />

        {/* Bloque 2: Criterios / Información (¡Ahora es interactivo! 👈) */}
        <div
          onClick={() => setView('evaluacion')} // 💡 Cambia la vista local al hacer clic
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-3 shadow-xs hover:border-emerald-500/50 dark:hover:border-emerald-500/30 transition-all duration-200 cursor-pointer active:scale-[0.99]"
        >
          <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40">
              <FileText className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-950 dark:text-slate-50">Criterios de Evaluación</h4>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Anota las reglas del profesor, fechas clave de entregas y el desglose de porcentajes del temario oficial.
          </p>
          <div className="pt-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30">
              Configurar
            </span>
          </div>
        </div>

        {/* Bloque 3: Analytics Expandido */}
        <div
          onClick={() => setView('metricas')}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-3 shadow-xs hover:border-purple-500/50 dark:hover:border-purple-500/30 transition-all duration-200 cursor-pointer active:scale-[0.99]"
        >
          <div className="flex items-center gap-3 text-purple-600 dark:text-purple-400">
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-950 dark:text-slate-50">Métricas de Estudio</h4>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Filtra uno o varios parciales para ver dominio actual, precisión, velocidad y desglose por tema dentro de esta materia.
          </p>
          <div className="pt-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-100 dark:border-purple-900/30">
              Explorar métricas
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
