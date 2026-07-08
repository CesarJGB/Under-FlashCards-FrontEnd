// FILE: frontend/src/components/library/info/EvaluacionLevel.jsx
import React from 'react';
import { ArrowLeft, FileText, Plus, Milestone } from 'lucide-react';

export default function EvaluacionLevel({ onBack, materia }) {
  return (
    <div className="animate-[fadeIn_0.15s_ease] space-y-6">
      {/* Botón para volver al menú de info */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors cursor-pointer group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Volver a información
      </button>

      {/* Cabecera interna */}
      <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40">
          <FileText className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-950 dark:text-slate-50 tracking-tight">
            Criterios de Evaluación
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {materia?.name} • Reglas, porcentajes y entregables oficiales
          </p>
        </div>
      </div>

      {/* Contenido / Cascarón de los criterios */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs text-center space-y-4 max-w-2xl mx-auto py-12">
        <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500">
          <Milestone className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-slate-950 dark:text-slate-50">No hay criterios registrados</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Aquí podrás anotar los porcentajes de tareas, asistencia, proyectos y las fechas de entrega acordadas con tu profesor.
          </p>
        </div>
        <button className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors cursor-pointer shadow-xs">
          <Plus className="w-4 h-4" /> Agregar criterio oficial
        </button>
      </div>
    </div>
  );
}
