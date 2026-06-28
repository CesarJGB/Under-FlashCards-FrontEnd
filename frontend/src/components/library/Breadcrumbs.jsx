import React from 'react';
import { Library, ChevronRight } from 'lucide-react';

export default function Breadcrumbs({ 
  currentPath, setCurrentPath, handleResetPath, 
  activeMateriaName, activeTemaName, activeSubtemaName 
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-500 bg-white border border-slate-200/60 p-2.5 rounded-xl shadow-3xs mb-4">
      <button onClick={handleResetPath} className="hover:text-slate-900 flex items-center gap-1 cursor-pointer">
        <Library className="w-3.5 h-3.5" /> Biblioteca
      </button>
      {currentPath.materiaId && (
        <>
          <ChevronRight className="w-3 h-3 text-slate-300" />
          <button 
            onClick={() => setCurrentPath({ ...currentPath, parcialNumber: null, temaId: null, subtemaId: null })} 
            className="hover:text-slate-900 truncate max-w-[140px] cursor-pointer"
          >
            {activeMateriaName}
          </button>
        </>
      )}
      {currentPath.parcialNumber && (
        <>
          <ChevronRight className="w-3 h-3 text-slate-300" />
          <button 
            onClick={() => setCurrentPath({ ...currentPath, temaId: null, subtemaId: null })} 
            className="hover:text-slate-900 cursor-pointer"
          >
            Parcial {currentPath.parcialNumber}
          </button>
        </>
      )}
      {currentPath.temaId && (
        <>
          <ChevronRight className="w-3 h-3 text-slate-300" />
          <button 
            onClick={() => setCurrentPath({ ...currentPath, subtemaId: null })} 
            className="hover:text-slate-900 truncate max-w-[140px] cursor-pointer"
          >
            {activeTemaName}
          </button>
        </>
      )}
      {currentPath.subtemaId && (
        <>
          <ChevronRight className="w-3 h-3 text-slate-300" />
          <span className="text-slate-900 font-bold truncate max-w-[140px]">
            {activeSubtemaName}
          </span>
        </>
      )}
    </div>
  );
}
