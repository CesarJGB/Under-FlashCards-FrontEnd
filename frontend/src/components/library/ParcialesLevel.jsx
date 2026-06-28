import React from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';

export default function ParcialesLevel({ decks, currentPath, setCurrentPath, handleResetPath, activeMateriaName }) {
  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center gap-2">
        <button onClick={handleResetPath} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h3 className="text-sm font-black text-slate-800">
          Estructura Trimestral: <span className="text-slate-500 font-bold">{activeMateriaName}</span>
        </h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((num) => {
          const count = decks.filter(d => String(d.materiaId || '') === String(currentPath.materiaId) && d.parcialNumber === num).length;
          return (
            <div key={num} onClick={() => setCurrentPath({ ...currentPath, parcialNumber: num })} className="bg-white border-2 border-slate-200/70 p-6 rounded-2xl hover:border-slate-900 transition-all cursor-pointer flex flex-col justify-between h-36 active:scale-[0.99] group">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Evaluación Oficial</span>
                <h4 className="text-base font-extrabold text-slate-900 mt-1">Parcial 0{num}</h4>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                <span>{count} mazo(s)</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
