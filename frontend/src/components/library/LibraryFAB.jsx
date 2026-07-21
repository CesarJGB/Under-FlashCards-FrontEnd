// ARCHIVO: frontend/src/components/library/LibraryFAB.jsx
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Upload, Loader2, FolderPlus, FileText } from 'lucide-react';

export default function LibraryFAB({ 
  currentPath = { materiaId: null, parcialNumber: null, temaId: null, subtemaId: null },
  setModal, 
  setAcademicModal,
  fileInputRef, 
  importing,
  dashboardShell
}) {
  const [fabOpen, setFabOpen] = useState(false);

  const isParcialesLevel = currentPath.materiaId !== null && currentPath.parcialNumber === null;

  // Determinar texto de carpeta según nivel
  let folderConfig = { text: 'Nueva materia', subtitle: 'Organiza tus mazos en carpetas', type: 'materia' };
  if (currentPath.materiaId !== null) {
    if (currentPath.temaId === null) {
      folderConfig = { text: 'Nuevo tema', subtitle: 'Agrupa temas del parcial', type: 'tema' };
    } else if (currentPath.subtemaId === null) {
      folderConfig = { text: 'Nuevo subtema', subtitle: 'Divide el tema en partes', type: 'subtema' };
    } else {
      folderConfig = null;
    }
  }

  const isTemasLevel = currentPath.materiaId !== null && currentPath.parcialNumber !== null && currentPath.temaId === null;

  // FAB Con efecto Liquid Glass Corregido (Visible sobre fondos coloridos)
  const fabButton = !fabOpen && !isParcialesLevel && (
    <button
      type="button"
      onClick={() => setFabOpen(true)}
      className="absolute right-6 w-14 h-14 rounded-[1.3rem] md:fixed flex items-center justify-center z-50 cursor-pointer
      /* Degradado de vidrio: Brillante arriba, con cuerpo abajo para no perderse */
      bg-gradient-to-b from-white/70 to-white/30 dark:from-white/30 dark:to-white/10
      /* Blur fuerte para difuminar los colores de atrás */
      backdrop-blur-xl backdrop-saturate-150
      /* Bordes brillantes */
      border border-white/60 dark:border-white/20
      /* Sombras: Sombra exterior profunda + brillo superior interno + sombra inferior interna */
      shadow-[0_10px_30px_-5px_rgba(0,0,0,0.3),0_4px_12px_-4px_rgba(0,0,0,0.2),inset_0_1.5px_1.5px_0_rgba(255,255,255,0.9),inset_0_-2px_3px_0_rgba(0,0,0,0.1)]
      /* Animaciones */
      hover:from-white/80 hover:to-white/40 hover:scale-105 active:scale-95 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 6rem)' }}
    >
      {/* Ícono más grande, grueso y con sombra fuerte para máxima legibilidad */}
      <Plus className="w-7 h-7 stroke-[3] text-zinc-900 dark:text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" />
    </button>
  );

  const fabOverlays = (
    <>
      {/* Backdrop oscurecido para enfocar en el menú */}
      {fabOpen && (
        <div
          onClick={() => setFabOpen(false)}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 animate-[fadeIn_0.25s_ease-out]"
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
          {/* Contenedor: Subimos la opacidad al 95% para que el texto sea 100% legible */}
          <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl backdrop-saturate-150 rounded-t-3xl shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.2)] border-t border-white/40 dark:border-white/10">
            
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-4">
              <div className="w-10 h-1 bg-slate-300 dark:bg-zinc-700 rounded-full" />
            </div>

            {/* Cards con animación escalonada */}
            <div className="px-4 pb-8 flex flex-col gap-3">
              
              {/* Opción 1: Crear carpeta (dinámico según nivel) */}
              {folderConfig && (
                <button
                  type="button"
                  onClick={() => { setFabOpen(false); setAcademicModal({ type: folderConfig.type }); }}
                  className="w-full bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-950/40 dark:to-violet-950/40 border-2 border-indigo-200 dark:border-indigo-800/50 rounded-3xl p-5 text-left shadow-lg shadow-indigo-200/50 dark:shadow-none hover:shadow-xl active:scale-[0.98] transition-all duration-200 cursor-pointer"
                  style={{
                    animation: 'cardIn 0.35s cubic-bezier(0.32, 0.72, 0, 1) 0.08s both'
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white dark:bg-zinc-800 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
                      <FolderPlus className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight mb-1">
                        {folderConfig.text}
                      </h3>
                      <p className="text-sm text-slate-700 dark:text-zinc-300 leading-snug">
                        {folderConfig.subtitle}
                      </p>
                    </div>
                  </div>
                </button>
              )}

              {/* Opción 2: Crear mazo */}
              {!isTemasLevel && (
                <button
                  type="button"
                  onClick={() => { setFabOpen(false); setModal({}); }}
                  className="w-full bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/60 rounded-3xl p-5 text-left hover:shadow-md active:scale-[0.98] transition-all duration-200 cursor-pointer"
                  style={{
                    animation: 'cardIn 0.35s cubic-bezier(0.32,0.72,0,1) 0.14s both'
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white dark:bg-zinc-800 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
                      <FileText className="w-6 h-6 text-slate-700 dark:text-zinc-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight mb-1">
                        Crear mazo
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-zinc-400 leading-snug">
                        Escribe tus propias tarjetas desde cero
                      </p>
                    </div>
                  </div>
                </button>
              )}

              {/* Opción 3: Importar mazo */}
              {!isTemasLevel && (
                <button
                  type="button"
                  onClick={() => { setFabOpen(false); fileInputRef.current?.click(); }}
                  disabled={importing}
                  className="w-full bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/60 rounded-3xl p-5 text-left hover:shadow-md active:scale-[0.98] transition-all duration-200 disabled:opacity-50 cursor-pointer"
                  style={{
                    animation: 'cardIn 0.35s cubic-bezier(0.32,0.72,0,1) 0.20s both'
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white dark:bg-zinc-800 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
                      {importing ? (
                        <Loader2 className="w-6 h-6 animate-spin text-slate-700 dark:text-zinc-300" />
                      ) : (
                        <Upload className="w-6 h-6 text-slate-700 dark:text-zinc-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight mb-1">
                        Importar mazo
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-zinc-400 leading-snug">
                        Sube un archivo JSON existente
                      </p>
                    </div>
                  </div>
                </button>
              )}
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
