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

  const fabButton = !fabOpen && !isParcialesLevel && (
    <button
      type="button"
      onClick={() => setFabOpen(true)}
      className="absolute right-6 w-14 h-14 rounded-2xl bg-slate-900 text-white shadow-lg flex items-center justify-center z-50 hover:bg-slate-800 hover:scale-105 active:scale-90 transition-all duration-200 cursor-pointer md:fixed"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 6rem)' }}
    >
      <Plus className="w-6 h-6 stroke-[2.5]" />
    </button>
  );

  const fabOverlays = (
    <>
      {/* Backdrop con fade suave */}
      {fabOpen && (
        <div
          onClick={() => setFabOpen(false)}
          className="fixed inset-0 bg-slate-900/40 z-40 animate-[fadeIn_0.25s_ease-out]"
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
          {/* Contenedor blanco completo */}
          <div className="bg-white rounded-t-3xl shadow-2xl">
            
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-4">
              <div className="w-10 h-1 bg-slate-300 rounded-full" />
            </div>

            {/* Cards con animación escalonada */}
            <div className="px-4 pb-8 flex flex-col gap-3">
              
              {/* Opción 1: Crear carpeta (dinámico según nivel) */}
              {folderConfig && (
                <button
                  type="button"
                  onClick={() => { setFabOpen(false); setAcademicModal({ type: folderConfig.type }); }}
                  className="w-full bg-gradient-to-br from-indigo-100 to-violet-100 border-2 border-indigo-200 rounded-3xl p-5 text-left shadow-lg shadow-indigo-200/50 hover:shadow-xl active:scale-[0.98] transition-all duration-200"
                  style={{
                    animation: 'cardIn 0.35s cubic-bezier(0.32, 0.72, 0, 1) 0.08s both'
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
                      <FolderPlus className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-slate-900 leading-tight mb-1">
                        {folderConfig.text}
                      </h3>
                      <p className="text-sm text-slate-700 leading-snug">
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-3xl p-5 text-left hover:shadow-md active:scale-[0.98] transition-all duration-200"
                  style={{
                    animation: 'cardIn 0.35s cubic-bezier(0.32, 0.72, 0, 1) 0.14s both'
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
                      <FileText className="w-6 h-6 text-slate-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-slate-900 leading-tight mb-1">
                        Crear mazo
                      </h3>
                      <p className="text-sm text-slate-600 leading-snug">
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-3xl p-5 text-left hover:shadow-md active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
                  style={{
                    animation: 'cardIn 0.35s cubic-bezier(0.32, 0.72, 0, 1) 0.20s both'
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
                      {importing ? (
                        <Loader2 className="w-6 h-6 animate-spin text-slate-700" />
                      ) : (
                        <Upload className="w-6 h-6 text-slate-700" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-slate-900 leading-tight mb-1">
                        Importar mazo
                      </h3>
                      <p className="text-sm text-slate-600 leading-snug">
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
