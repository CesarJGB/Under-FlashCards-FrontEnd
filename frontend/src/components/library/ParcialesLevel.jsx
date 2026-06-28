import React from 'react';
import { ChevronRight } from 'lucide-react';

export default function ParcialesLevel({ 
  temas = [], 
  currentPath, 
  setCurrentPath 
}) {
  const partialsConfig = [
    { num: 1, label: 'Primer parcial' },
    { num: 2, label: 'Segundo parcial' },
    { num: 3, label: 'Tercer parcial' }
  ];

  return (
    <div className="mt-6 animate-[fadeIn_0.15s_ease]">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {partialsConfig.map((p) => {
          const count = temas.filter(
            t => String(t.materiaId || '') === String(currentPath.materiaId) && t.parcialNumber === p.num
          ).length;

          return (
            <div 
              key={p.num} 
              onClick={() => setCurrentPath({ ...currentPath, parcialNumber: p.num })} 
              className="bg-white border border-slate-200 p-5 rounded-2xl hover:border-indigo-200 hover:shadow-xs transition-all duration-200 cursor-pointer flex flex-col justify-between h-32 active:scale-[0.98] group"
            >
              <div>
                <h4 className="text-base font-bold text-slate-950 tracking-tight mt-1 group-hover:text-indigo-600 transition-colors">
                  {p.label}
                </h4>
              </div>
              
              <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                <span>{count} tema(s)</span>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all duration-200" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
