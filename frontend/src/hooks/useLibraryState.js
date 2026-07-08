// FILE: frontend/src/components/library/InfoLevel.jsx
import React, { useState } from 'react';
import { ArrowLeft, Calculator, Plus, Trash2, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function InfoLevel({ materia, currentPath, setCurrentPath }) {
  // --- ESTADOS PARA LA CALCULADORA DE CALIFICACIONES ---
  const [criterios, setCriterios] = useState([
    { id: 1, nombre: 'Exámenes Parciales', porcentaje: 50, nota: 80 },
    { id: 2, nombre: 'Tareas y Trabajos', porcentaje: 20, nota: 90 },
    { id: 3, nombre: 'Proyecto Final', porcentaje: 30, nota: 0 },
  ]);
  
  const [notaAprobatoria, setNotaAprobatoria] = useState(70);

  const handleBack = () => {
    setCurrentPath({ ...currentPath, parcialNumber: null });
  };

  // --- LÓGICA DE LA CALCULADORA ---
  const handleAgregarCriterio = () => {
    const nuevoId = criterios.length > 0 ? Math.max(...criterios.map(c => c.id)) + 1 : 1;
    setCriterios([...criterios, { id: nuevoId, nombre: 'Nuevo Criterio', porcentaje: 0, nota: 0 }]);
  };

  const handleEliminarCriterio = (id) => {
    setCriterios(criterios.filter(c => c.id !== id));
  };

  const handleEditarCriterio = (id, campo, valor) => {
    setCriterios(criterios.map(c => {
      if (c.id === id) {
        let v = valor;
        if (campo === 'porcentaje' || campo === 'nota') {
          v = valor === '' ? '' : Math.max(0, Math.min(100, Number(valor)));
        }
        return { ...c, [campo]: v };
      }
      return c;
    }));
  };

  // Cálculos dinámicos
  const totalPorcentaje = criterios.reduce((sum, c) => sum + (Number(c.porcentaje) || 0), 0);
  
  const notaActualAcumulada = criterios.reduce((sum, c) => {
    return sum + (((Number(c.nota) || 0) * (Number(c.porcentaje) || 0)) / 100);
  }, 0);

  // Determinar si hay un criterio en "0" o por evaluar para calcular el "Requerido"
  const criteriosPorEvaluar = criterios.filter(c => (Number(c.nota) || 0) === 0 && (Number(c.porcentaje) || 0) > 0);
  const porcentajePendiente = criteriosPorEvaluar.reduce((sum, c) => sum + Number(c.porcentaje), 0);
  
  let notaNecesariaParaAprobar = 0;
  if (porcentajePendiente > 0) {
    const notaYaGanada = criterios
      .filter(c => (Number(c.nota) || 0) > 0)
      .reduce((sum, c) => sum + ((Number(c.nota) * Number(c.porcentaje)) / 100), 0);
    
    notaNecesariaParaAprobar = ((notaAprobatoria - notaYaGanada) / porcentajePendiente) * 100;
  }

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
          Panel de Información: <span className="text-indigo-600 dark:text-indigo-400">{materia?.name}</span>
        </h3>
      </div>

      {/* SECCIÓN PRINCIPAL: CALCULADORA INTERACTIVA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Formulario y tabla de criterios */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-indigo-600 dark:text-indigo-400">
              <Calculator className="w-5 h-5" />
              <h4 className="font-bold text-slate-950 dark:text-slate-50">Criterios de Evaluación</h4>
            </div>
            
            <button
              onClick={handleAgregarCriterio}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 rounded-xl transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Añadir renglón
            </button>
          </div>

          <div className="space-y-3">
            {/* Encabezados de tabla simples */}
            <div className="grid grid-cols-12 gap-2 px-2 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <span className="col-span-6">Concepto / Actividad</span>
              <span className="col-span-3 text-center">Peso (%)</span>
              <span className="col-span-2 text-center">Tu Nota</span>
              <span className="col-span-1"></span>
            </div>

            {/* Renderizado de filas */}
            {criterios.map((crit) => (
              <div key={crit.id} className="grid grid-cols-12 gap-2 items-center bg-slate-50/50 dark:bg-slate-950/20 p-2 rounded-xl border border-slate-100 dark:border-slate-800/60 group">
                <input
                  type="text"
                  value={crit.nombre}
                  onChange={(e) => handleEditarCriterio(crit.id, 'nombre', e.target.value)}
                  className="col-span-6 px-3 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-hidden focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                  placeholder="Ej. Tareas"
                />
                <input
                  type="number"
                  value={crit.porcentaje}
                  onChange={(e) => handleEditarCriterio(crit.id, 'porcentaje', e.target.value)}
                  className="col-span-3 px-2 py-1.5 text-sm text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-hidden focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                  placeholder="0"
                />
                <input
                  type="number"
                  value={crit.nota}
                  onChange={(e) => handleEditarCriterio(crit.id, 'nota', e.target.value)}
                  className="col-span-2 px-2 py-1.5 text-sm text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-hidden focus:border-indigo-500 text-slate-800 dark:text-slate-200"
                  placeholder="0"
                />
                <div className="col-span-1 flex justify-center">
                  <button
                    onClick={() => handleEliminarCriterio(crit.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-500 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Barra de validación de porcentaje total */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-medium">
            <span className="text-slate-500 dark:text-slate-400">Configuración de la nota mínima para pasar:</span>
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                value={notaAprobatoria} 
                onChange={(e) => setNotaAprobatoria(Number(e.target.value))}
                className="w-12 px-1 py-0.5 text-center font-bold bg-slate-100 dark:bg-slate-800 border-none rounded-md focus:outline-hidden focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
        </div>

        {/* Panel de resultados analíticos */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <h5 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Diagnóstico de Calificación
            </h5>
            
            {/* Indicador 1: Suma de porcentajes */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-600 dark:text-slate-400">Distribución del Temario:</span>
                <span className={totalPorcentaje === 100 ? "text-emerald-600 font-bold" : "text-amber-600"}>
                  {totalPorcentaje}% de 100%
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${totalPorcentaje === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{ width: `${Math.min(100, totalPorcentaje)}%` }}
                />
              </div>
            </div>

            {/* Indicador 2: Calificación Acumulada actual */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase">Nota Acumulada Actual</p>
                <p className="text-2xl font-black text-slate-950 dark:text-slate-50 tracking-tight mt-0.5">
                  {notaActualAcumulada.toFixed(1)}
                </p>
              </div>
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                <RefreshCw className="w-5 h-5" />
              </div>
            </div>

            {/* Mensaje predictivo dinámico */}
            {totalPorcentaje !== 100 ? (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 text-amber-800 dark:text-amber-400 text-xs flex gap-2.5 items-start">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>Asegúrate de que tus criterios sumen exactamente 100% para obtener predicciones precisas.</p>
              </div>
            ) : porcentajePendiente > 0 ? (
              <div className="p-3.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100/70 dark:border-indigo-900/30 text-slate-700 dark:text-slate-300 text-xs space-y-1">
                <p className="font-semibold text-indigo-700 dark:text-indigo-400">Meta de aprobación:</p>
                <p>
                  Necesitas promediar un <span className="font-bold text-slate-950 dark:text-white text-sm">{Math.max(0, notaNecesariaParaAprobar).toFixed(1)}</span> en tus criterios restantes ({porcentajePendiente}% pendiente) para salvar la materia con {notaAprobatoria}.
                </p>
              </div>
            ) : (
              <div className={`p-3.5 rounded-xl text-xs flex gap-2.5 items-start ${notaActualAcumulada >= notaAprobatoria ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 border border-emerald-100' : 'bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-400 border border-rose-100'}`}>
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <p>{notaActualAcumulada >= notaAprobatoria ? '¡Felicidades! Con las notas registradas ya has acreditado la materia de forma satisfactoria.' : 'El puntaje acumulado total no alcanza la nota aprobatoria requerida.'}</p>
              </div>
            )}
          </div>

          <div className="text-[10px] text-slate-400 dark:text-slate-500 text-center leading-relaxed">
            Las calificaciones no se guardan en el servidor; puedes usarlas de forma libre para simular escenarios.
          </div>
        </div>

      </div>
    </div>
  );
}
