// ARCHIVO: frontend/src/components/library/LibraryFAB.jsx
import { useState } from 'react';
import { Plus, Upload, Loader2, FolderPlus, Sparkles, FileText } from 'lucide-react';

export default function LibraryFAB({ 
  currentPath = { materiaId: null, parcialNumber: null, temaId: null, subtemaId: null },
  setModal, 
  setAcademicModal,
  fileInputRef, 
  importing 
}) {
  const [fabOpen, setFabOpen] = useState(false);

  const isParcialesLevel = currentPath.materiaId !== null && currentPath.parcialNumber === null;
  const isTemasLevel = currentPath.materiaId !== null && currentPath.parcialNumber !== null && currentPath.temaId === null;

  // Determinar texto de carpeta según nivel
  let folderConfig = { text: 'Nueva materia', type: 'materia' };
  if (currentPath.materiaId !== null) {
    if (currentPath.temaId === null) {
      folderConfig = { text: 'Nuevo tema', type: 'tema' };
    } else if (currentPath.subtemaId === null) {
      folderConfig = { text: 'Nuevo subtema', type: 'subtema' };
    } else {
      folderConfig = null;
    }
  }

  return (
    <div className={`fixed bottom-24 inset-x-4 max-w-xs mx-auto md:bottom-10 md:right-8 md:inset-x-auto md:max-w-none md:mx-0 z-50 flex flex-col items-end gap-3 transition-all duration-300 ${
      isParcialesLevel ? 'scale-0 opacity-0 pointer-events-none' : 'pointer-events-none'
    }`}>
      
      {/* Backdrop */}
      {fabOpen && !isParcialesLevel && (
        <div
          onClick={() => setFabOpen(false)}
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 animate-[fadeIn_0.2s_ease] pointer-events-auto"
        />
      )}

      {/* Menú desplegable */}
      {fabOpen && !isParcialesLevel && (
        <div className="flex flex-col gap-3 z-50 mb-2 animate-[slideUp_0.25s_ease-out] pointer-events-auto">
          
          {/* Opción 1: Nueva materia/carpeta */}
          {folderConfig && (
            <button
              type="button"
              onClick={() => { setFabOpen(false); setAcademicModal({ type: folderConfig.type }); }}
              className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-left shadow-lg hover:shadow-xl active:scale-[0.98] transition-all duration-200 group"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-100 transition-colors">
                  <FolderPlus className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-slate-900 leading-tight mb-0.5">
                    Crear carpeta
                  </h3>
                  <p className="text-sm text-slate-600 leading-snug">
                    Organiza tus mazos en carpetas
                  </p>
                </div>
              </div>
            </button>
          )}

          {/* Opción 2: Nuevo mazo manual */}
          {!isTemasLevel && (
            <button
              type="button"
              onClick={() => { setFabOpen(false); setModal({}); }}
              className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-left shadow-lg hover:shadow-xl active:scale-[0.98] transition-all duration-200 group"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-slate-200 transition-colors">
                  <FileText className="w-5 h-5 text-slate-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-slate-900 leading-tight mb-0.5">
                    Crear mazo manual
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
              className="w-full bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-2xl p-4 text-left shadow-lg hover:shadow-xl active:scale-[0.98] transition-all duration-200 group disabled:opacity-50"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-110 transition-transform">
                  {importing ? (
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                  ) : (
                    <Upload className="w-5 h-5 text-indigo-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-slate-900 leading-tight mb-0.5">
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
      )}

      {/* Botón principal FAB */}
      <button
        type="button"
        onClick={() => setFabOpen(!fabOpen)}
        disabled={isParcialesLevel}
        className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg z-50 transition-all duration-300 active:scale-90 cursor-pointer pointer-events-auto ${
          fabOpen 
            ? 'bg-slate-800 rotate-45 hover:bg-slate-700' 
            : 'bg-slate-900 hover:bg-slate-800 hover:scale-105 hover:shadow-xl'
        }`}
      >
        <Plus className="w-6 h-6 stroke-[2.5]" />
      </button>
    </div>
  );
}

