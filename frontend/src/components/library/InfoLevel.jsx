// FILE: frontend/src/components/library/InfoLevel.jsx
import React from 'react';
import { ArrowLeft, Calculator, FileText, BarChart3 } from 'lucide-react';

export default function InfoLevel({ materia, currentPath, setCurrentPath }) {
  // Función para regresar al nivel de parciales de esta materia
  const handleBack = () => {
    setCurrentPath({
      ...currentPath,
      parcialNumber: null // Al limpiar el parcial, regresa a la vista de la cuadrícula de parciales
    });
  };

  return (
    <div className="mt-6 animate-[fadeIn_0.15s_ease] space-y-6">
      {/* Botón de regreso rápido */}
      <button
        onClick={handleBack}
        className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors cursor-pointer group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Volver a parciales
      </button>

      {/* Cabecera del nivel */}
      <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
        <h3 className="text-xl font-bold text-slate-950 dark:text-slate-50 tracking-tight">
          Información de la Materia: <span className="text-indigo-600 dark:text-indigo-400">{materia?.name}</span>
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Gestiona tus criterios de evaluación, calcula tus notas y revisa estadísticas de estudio.
        </p>
      </div>

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
