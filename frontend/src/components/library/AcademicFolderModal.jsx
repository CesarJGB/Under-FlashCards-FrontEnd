import React from 'react';

export default function AcademicFolderModal({ 
  academicModal, academicInput, setAcademicInput, 
  setAcademicModal, handleCreateAcademicFolder 
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-[fadeIn_0.2s_ease]">
      <div className="bg-white p-6 rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm mx-4 animate-[slideUp_0.25s_ease-out]">
        <h4 className="text-base font-bold text-slate-900 capitalize tracking-tight">
          Crear nueva {academicModal.type}
        </h4>
        
        <form onSubmit={handleCreateAcademicFolder} className="mt-4 space-y-3">
          <input 
            type="text" 
            autoFocus 
            required 
            placeholder="Nombre de la carpeta..." 
            value={academicInput} 
            onChange={(e) => setAcademicInput(e.target.value)} 
            className="w-full text-sm font-medium border border-slate-200 rounded-xl px-4 h-11 bg-slate-50 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all duration-200" 
          />
          
          <div className="flex gap-2 justify-end text-sm font-bold pt-2">
            <button 
              type="button" 
              onClick={() => { setAcademicModal(null); setAcademicInput(''); }} 
              className="px-4 h-10 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 active:scale-[0.98] transition-all duration-200 cursor-pointer"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="px-4 h-10 bg-slate-900 text-white rounded-xl hover:bg-slate-800 active:scale-[0.98] transition-all duration-200 cursor-pointer shadow-sm"
            >
              Crear carpeta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

