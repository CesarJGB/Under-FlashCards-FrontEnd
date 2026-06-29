// ARCHIVO: frontend/src/components/library/LibraryFAB.jsx
import { useState } from 'react';
import { Plus, Upload, Loader2, FolderPlus } from 'lucide-react';

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

  let folderConfig = { text: 'Nueva materia', type: 'materia' };
  if (currentPath.materiaId !== null) {
    if (currentPath.temaId === null) {
      folderConfig = { text: 'Nuevo tema', type: 'tema' };
    } else {
      folderConfig = { text: 'Nuevo subtema', type: 'subtema' };
    }
  }

  return (
    <div className={`fixed bottom-24 inset-x-4 max-w-xs mx-auto md:bottom-10 md:right-8 md:inset-x-auto md:max-w-none md:mx-0 z-50 flex flex-col items-end gap-2.5 transition-all duration-200 ${
      isParcialesLevel ? 'scale-0 opacity-0 pointer-events-none' : 'pointer-events-none'
    }`}>
      
      {fabOpen && !isParcialesLevel && (
        <div
          onClick={() => setFabOpen(false)}
          className="fixed inset-0 bg-slate-900/10 backdrop-blur-xs z-40 animate-[fadeIn_0.15s_ease] pointer-events-auto"
        />
      )}

      {fabOpen && !isParcialesLevel && (
        <div className="flex flex-col items-end gap-2 z-50 mb-1.5 animate-[slideUp_0.15s_ease-out] pointer-events-auto">
          <button
            type="button"
            onClick={() => { setFabOpen(false); setAcademicModal({ type: folderConfig.type }); }}
            className="w-44 flex items-center justify-between bg-white text-slate-700 border border-slate-200/80 pl-3.5 pr-1.5 py-1.5 rounded-2xl text-xs font-bold shadow-sm hover:bg-slate-50 active:scale-[0.98] transition-all duration-200 cursor-pointer"
          >
            <span>{folderConfig.text}</span>
            <div className="w-7 h-7 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100/50">
              <FolderPlus className="w-3.5 h-3.5 text-indigo-500" />
            </div>
          </button>

          {!isTemasLevel && (
            <button
              type="button"
              onClick={() => { setFabOpen(false); fileInputRef.current?.click(); }}
              disabled={importing}
              className="w-44 flex items-center justify-between bg-white text-slate-700 border border-slate-200/80 pl-3.5 pr-1.5 py-1.5 rounded-2xl text-xs font-bold shadow-sm hover:bg-slate-50 active:scale-[0.98] transition-all duration-200 cursor-pointer disabled:opacity-50"
            >
              <span>Importar mazo</span>
              <div className="w-7 h-7 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100">
                {importing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                ) : (
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                )}
              </div>
            </button>
          )}

          {!isTemasLevel && (
            <button
              type="button"
              onClick={() => { setFabOpen(false); setModal({}); }}
              className="w-44 flex items-center justify-between bg-white text-slate-700 border border-slate-200/80 pl-3.5 pr-1.5 py-1.5 rounded-2xl text-xs font-bold shadow-sm hover:bg-slate-50 active:scale-[0.98] transition-all duration-200 cursor-pointer"
            >
              <span>Nuevo mazo</span>
              <div className="w-7 h-7 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100">
                <Plus className="w-3.5 h-3.5 text-slate-500" />
              </div>
            </button>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setFabOpen(!fabOpen)}
        disabled={isParcialesLevel}
        className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-sm z-50 transition-all duration-200 active:scale-90 cursor-pointer pointer-events-auto ${
          fabOpen ? 'bg-slate-800' : 'bg-slate-900 hover:bg-slate-800 hover:scale-105'
        }`}
      >
        <Plus className="w-6 h-6 stroke-[2.5]" />
      </button>
    </div>
  );
}
