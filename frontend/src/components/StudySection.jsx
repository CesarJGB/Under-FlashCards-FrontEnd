import React from 'react';
import { Flame, Play, Clock, Sparkles, Layers, CheckCircle2 } from 'lucide-react';

export default function StudySection({ decks, materias, onOpenReview }) {
  // Encontrar el primer mazo disponible para la sesión sugerida de alto impacto
  const suggestedDeck = decks.length > 0 ? decks[0] : null;

  // Encontrar la materia del mazo sugerido para el tag visual
  const suggestedMateria = suggestedDeck
    ? materias.find(m => m.id === suggestedDeck.materiaId || m._id === suggestedDeck.materiaId)
    : null;

  // Calcular métricas rápidas basadas en el estado real actual
  const totalMazos = decks.length;
  const totalMaterias = materias.length;

  return (
    <div className="space-y-6 animate-[fadeIn_0.15s_ease]">
      {/* ENCABEZADO DE SECCIÓN */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">Modo de Estudio</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Sesiones de repaso fluido diseñadas para consolidar tu memoria a largo plazo.
        </p>
      </div>

      {/* BANNER PRINCIPAL DE ACCIÓN (ALTO CONTRASTE) */}
      {suggestedDeck ? (
        <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md relative overflow-hidden group">
          {/* Elemento decorativo de fondo */}
          <div className="absolute -top-6 -right-6 p-6 opacity-10 pointer-events-none select-none transition-transform duration-300 group-hover:scale-110">
            <Flame className="w-40 h-40 stroke-[1.2]" />
          </div>
          
          <div className="relative z-10 max-w-xl space-y-4">
            <div className="inline-flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-md text-amber-300">
              <Sparkles className="w-3.5 h-3.5 fill-current" />
              <span>Sugerido para hoy</span>
            </div>
            
            <div>
              <span className="text-[11px] text-indigo-300 font-bold tracking-wider uppercase block mb-0.5">
                {suggestedMateria ? suggestedMateria.name : 'General'}
              </span>
              <h2 className="text-xl font-extrabold tracking-tight">
                {suggestedDeck.title || suggestedDeck.name}
              </h2>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed max-w-md">
                Inicia una sesión de **Repaso Continuo**. Este modo ciclará las tarjetas de forma óptima para asegurar una retención activa sin interrupciones.
              </p>
            </div>

            <button 
              onClick={() => onOpenReview(suggestedDeck, 'continuous-review')}
              className="h-10 bg-indigo-500 hover:bg-indigo-600 active:scale-[0.98] transition-all text-white font-semibold text-sm px-5 rounded-xl flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-white stroke-[0]" />
              Iniciar Repaso Continuo
            </button>
          </div>
        </div>
      ) : (
        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center bg-white">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400 mb-3">
            <Layers className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-slate-700">No hay mazos disponibles</p>
          <p className="text-xs text-slate-400 mt-0.5">Crea asignaturas y mazos en la sección de Archivos para comenzar.</p>
        </div>
      )}

      {/* GRID DE ESTADÍSTICAS RÁPIDAS */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-3xs flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 rounded-lg text-indigo-500 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="block text-xs text-slate-400 font-medium truncate">Mazos Activos</span>
            <span className="text-base font-extrabold text-slate-800 block">{totalMazos}</span>
          </div>
        </div>
        
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-3xs flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 rounded-lg text-emerald-500 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="block text-xs text-slate-400 font-medium truncate">Asignaturas</span>
            <span className="text-base font-extrabold text-slate-800 block">{totalMaterias}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-3xs col-span-2 md:col-span-1 flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 rounded-lg text-amber-500 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="block text-xs text-slate-400 font-medium truncate">Enfoque</span>
            <span className="text-base font-extrabold text-slate-800 block">Retención Activa</span>
          </div>
        </div>
      </div>

      {/* LISTADO DE SELECCIÓN DIRECTA */}
      {decks.length > 0 && (
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-0.5">
            Lanzamiento por Mazo individual
          </h3>
          
          <div className="grid gap-2">
            {decks.map((deck) => {
              const materiaVinculada = materias.find(
                m => m.id === deck.materiaId || m._id === deck.materiaId
              );
              
              return (
                <div 
                  key={deck._id || deck.id}
                  className="bg-white border border-slate-200 rounded-xl p-4 flex justify-between items-center shadow-3xs hover:border-slate-300 transition-colors group"
                >
                  <div className="space-y-0.5 min-w-0 pr-4">
                    <span className="font-bold text-slate-800 text-sm block truncate group-hover:text-indigo-600 transition-colors">
                      {deck.title || deck.name}
                    </span>
                    <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                      {materiaVinculada ? materiaVinculada.name : 'Materia General'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="hidden sm:inline-flex text-[11px] bg-slate-50 border border-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-md items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" /> Continuous Mode
                    </span>
                    
                    <button
                      onClick={() => onOpenReview(deck, 'continuous-review')}
                      className="h-8 w-8 bg-slate-50 hover:bg-slate-900 text-slate-600 hover:text-white border border-slate-200 hover:border-slate-900 rounded-lg flex items-center justify-center transition-all cursor-pointer active:scale-[0.95] shadow-3xs"
                      title="Lanzar Repaso Continuo"
                    >
                      <Play className="w-3 h-3 fill-current stroke-[0]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
