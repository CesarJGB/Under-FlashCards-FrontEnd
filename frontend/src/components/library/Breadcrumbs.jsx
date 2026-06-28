import React from 'react';
import { Library, ChevronRight } from 'lucide-react';

export default function Breadcrumbs({ 
  currentPath, setCurrentPath, handleResetPath, 
  activeMateriaName, activeTemaName, activeSubtemaName 
}) {
  const isRoot = !currentPath.materiaId;

  if (isRoot) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-500 mb-5 py-1 animate-[fadeIn_0.1s_ease]">
      <button 
        type="button"
        onClick={handleResetPath} 
        className="hover:text-slate-900 transition-colors flex items-center gap-1 cursor-pointer"
      >
        <Library className="w-3.5 h-3.5 text-slate-400" /> Biblioteca
      </button>
      
      {currentPath.materiaId && (
        <>
          <ChevronRight className="w-3 h-3 text-slate-300" />
          <button 
            type="button"
            onClick={() => setCurrentPath({ ...currentPath, parcialNumber: null, temaId: null, subtemaId: null })} 
            className="hover:text-slate-900 transition-colors truncate max-w-[140px] cursor-pointer font-semibold"
          >
            {activeMateriaName}
          </button>
        </>
      )}
      
      {currentPath.parcialNumber && (
        <>
          <ChevronRight className="w-3 h-3 text-slate-300" />
          <button 
            type="button"
            onClick={() => setCurrentPath({ ...currentPath, temaId: null, subtemaId: null })} 
            className="hover:text-slate-900 transition-colors cursor-pointer font-semibold"
          >
            Parcial {currentPath.parcialNumber}
          </button>
        </>
      )}
      
      {currentPath.temaId && (
        <>
          <ChevronRight className="w-3 h-3 text-slate-300" />
          <button 
            type="button"
            onClick={() => setCurrentPath({ ...currentPath, subtemaId: null })} 
            className="hover:text-slate-900 transition-colors truncate max-w-[140px] cursor-pointer font-semibold"
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
