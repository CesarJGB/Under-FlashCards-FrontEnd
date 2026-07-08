// FILE: frontend/src/components/library/InfoLevel.jsx
import React from 'react';
import { Calculator, FileText, BarChart3 } from 'lucide-react'; // 👈 Se eliminó ArrowLeft

export default function InfoLevel({ materia, currentPath, setCurrentPath }) {
  return (
    <div className="mt-4 animate-[fadeIn_0.15s_ease] space-y-6">
      
      {/* Grid de Secciones Interiores (Cascarones para la calculadora, notas, etc.) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Bloque 1: Calculadora */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-3 shadow-xs">
          <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40">
              <Calculator className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-950 dark:text-slate-50">Calculadora de Notas</h4>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Calcula cuánto necesitas en el examen final ingresando los pesos de tus tareas, proyectos y parciales.
          </p>
          <div className="pt-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30">
              Próximamente
            </span>
          </div>
        </div>

        {/* Bloque 2: Criterios / Información */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-3 shadow-xs">
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
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30">
              Próximamente
            </span>
          </div>
        </div>

        {/* Bloque 3: Analytics Expandido */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-3 shadow-xs">
          <div className="flex items-center gap-3 text-purple-600 dark:text-purple-400">
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-950 dark:text-slate-50">Métricas de Estudio</h4>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Visualización profunda de tus tarjetas retenidas, velocidad de respuesta y consistencia semanal en esta materia.
          </p>
          <div className="pt-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30">
              Próximamente
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
