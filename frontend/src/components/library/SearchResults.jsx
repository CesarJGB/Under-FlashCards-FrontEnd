import React from 'react';
import { Folder, FileText, ChevronRight, BookOpen } from 'lucide-react';

export default function SearchResults({ results, setCurrentPath, setSearchQuery, setCurrentDeck, setInitialMode }) {
  if (!results || results.length === 0) {
    return (
      <div className="text-center border border-dashed border-slate-200 rounded-2xl py-12 mt-6 text-slate-400 text-xs font-medium">
        No se encontraron resultados.
      </div>
    );
  }

  const iconMap = {
    materia: Folder,
    tema: Folder,
    subtema: Folder,
    deck: BookOpen
  };

  const labelMap = {
    materia: 'Materia',
    tema: 'Tema',
    subtema: 'Subtema',
    deck: 'Mazo'
  };

  const handleClick = (result) => {
    if (result.type === 'materia') {
      setCurrentPath({ materiaId: result.item._id, parcialNumber: null, temaId: null, subtemaId: null });
    } else if (result.nav) {
      if (result.type === 'deck') {
        setCurrentPath(result.nav);
      } else {
        setCurrentPath(result.nav);
      }
    }
    setSearchQuery('');
  };

  return (
    <div className="mt-6 space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
        Resultados ({results.length})
      </h3>
      <div className="space-y-1.5">
        {results.map((r, i) => {
          const Icon = iconMap[r.type];
          return (
            <div
              key={`${r.type}-${r.item._id || r.item.id}-${i}`}
              onClick={() => handleClick(r)}
              className="bg-white border border-slate-200 p-3.5 rounded-xl hover:border-indigo-200 hover:shadow-xs transition-all duration-200 cursor-pointer flex items-center gap-3 active:scale-[0.99] group"
            >
              <div className="w-9 h-9 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-indigo-50 group-hover:border-indigo-100/50 transition-all">
                <Icon className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">
                  {r.item.name || r.item.title}
                </p>
                <p className="text-[11px] text-slate-400 truncate">{r.path}</p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 shrink-0">
                {labelMap[r.type]}
              </span>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 shrink-0" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
