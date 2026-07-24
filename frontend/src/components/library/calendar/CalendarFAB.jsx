// ARCHIVO: frontend/src/components/library/calendar/CalendarFAB.jsx
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, CalendarPlus, GraduationCap, Clock } from 'lucide-react';

export default function CalendarFAB({ setModal, dashboardShell }) {
  const [fabOpen, setFabOpen] = useState(false);

  // FAB Con efecto Liquid Glass (Oculto cuando la lámina está abierta)
  const fabButton = !fabOpen && (
    <button
      type="button"
      onClick={() => setFabOpen(true)}
      className="absolute right-6 w-14 h-14 rounded-[1.3rem] md:fixed flex items-center justify-center z-50 cursor-pointer
      bg-white/10 dark:bg-white/5
      backdrop-blur-[3px] backdrop-saturate-100
      border border-white/50 dark:border-white/25
      ring-1 ring-inset ring-white/30 dark:ring-white/10
      shadow-[0_10px_30px_-6px_rgba(0,0,0,0.35),0_4px_10px_-2px_rgba(0,0,0,0.15),inset_0_1.5px_0.5px_0_rgba(255,255,255,0.9),inset_0_-1.5px_1px_-0.5px_rgba(0,0,0,0.18),inset_1px_0_1px_-0.5px_rgba(255,255,255,0.4),inset_-1px_0_1px_-0.5px_rgba(0,0,0,0.12)]
      hover:bg-white/15 dark:hover:bg-white/10 hover:scale-105 active:scale-95 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
      before:absolute before:inset-0 before:rounded-[1.3rem] before:pointer-events-none before:bg-[radial-gradient(80%_60%_at_50%_-5%,rgba(255,255,255,0.45)_0%,rgba(255,255,255,0.08)_35%,transparent_70%)] before:opacity-90
      after:absolute after:inset-[1px] after:rounded-[1.2rem] after:pointer-events-none after:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)] after:mix-blend-overlay"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 6rem)' }}
    >
      <Plus className="relative w-7 h-7 stroke-[3] text-slate-800 dark:text-white drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)] dark:drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
    </button>
  );

  const fabOverlays = (
    <>
      {/* Backdrop con fade */}
      {fabOpen && (
        <div
          onClick={() => setFabOpen(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 animate-[fadeIn_0.25s_ease-out]"
        />
      )}

      {/* Bottom Sheet */}
      {fabOpen && (
        <div 
          className="fixed bottom-0 inset-x-0 z-50"
          style={{
            animation: 'slideUp 0.4s cubic-bezier(0.32, 0.72, 0, 1) forwards'
          }}
        >
          <div className="bg-white dark:bg-zinc-900 rounded-t-3xl shadow-2xl border-t border-zinc-100 dark:border-zinc-800">
            
            {/* Handle táctil */}
            <div className="flex justify-center pt-3 pb-4">
              <div className="w-10 h-1 bg-slate-300 dark:bg-zinc-700 rounded-full" />
            </div>

            {/* Opciones */}
            <div className="px-4 pb-8 flex flex-col gap-3">
              
              {/* Opción Destacada: Nuevo Examen / Evaluación */}
              <button
                type="button"
                onClick={() => { setFabOpen(false); setModal({ type: 'examen' }); }}
                className="w-full bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-950/40 dark:to-violet-950/40 border-2 border-indigo-200 dark:border-indigo-800/50 rounded-3xl p-5 text-left shadow-lg shadow-indigo-200/50 dark:shadow-none hover:shadow-xl active:scale-[0.98] transition-all duration-200 cursor-pointer"
                style={{
                  animation: 'cardIn 0.35s cubic-bezier(0.32, 0.72, 0, 1) 0.08s both'
                }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white dark:bg-zinc-800 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
                    <GraduationCap className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight mb-1">
                      Agendar examen
                    </h3>
                    <p className="text-sm text-slate-700 dark:text-zinc-300 leading-snug">
                      Añade evaluaciones con fecha de repaso
                    </p>
                  </div>
                </div>
              </button>

              {/* Opción 2: Evento general */}
              <button
                type="button"
                onClick={() => { setFabOpen(false); setModal({ type: 'evento' }); }}
                className="w-full bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/60 rounded-3xl p-5 text-left hover:shadow-md active:scale-[0.98] transition-all duration-200 cursor-pointer"
                style={{
                  animation: 'cardIn 0.35s cubic-bezier(0.32, 0.72, 0, 1) 0.14s both'
                }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white dark:bg-zinc-800 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
                    <CalendarPlus className="w-6 h-6 text-slate-700 dark:text-zinc-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight mb-1">
                      Nuevo evento
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-zinc-400 leading-snug">
                      Clases, entregas o actividades personales
                    </p>
                  </div>
                </div>
              </button>

              {/* Opción 3: Recordatorio */}
              <button
                type="button"
                onClick={() => { setFabOpen(false); setModal({ type: 'recordatorio' }); }}
                className="w-full bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/60 rounded-3xl p-5 text-left hover:shadow-md active:scale-[0.98] transition-all duration-200 cursor-pointer"
                style={{
                  animation: 'cardIn 0.35s cubic-bezier(0.32, 0.72, 0, 1) 0.20s both'
                }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white dark:bg-zinc-800 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Clock className="w-6 h-6 text-slate-700 dark:text-zinc-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight mb-1">
                      Recordatorio
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-zinc-400 leading-snug">
                      Notificación rápida con hora específica
                    </p>
                  </div>
                </div>
              </button>

            </div>
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      {dashboardShell ? createPortal(fabButton, dashboardShell) : fabButton}
      {fabOverlays}
    </>
  );
}
