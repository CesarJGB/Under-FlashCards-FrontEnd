import React from 'react';

export default function AcademicFolderModal({ 
  academicModal, academicInput, setAcademicInput, 
  setAcademicModal, handleCreateAcademicFolder 
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white p-5 rounded-2xl shadow-xl w-full max-w-sm mx-4">
        <h4 className="text-sm font-black text-slate-900 capitalize">
          Crear Nueva {academicModal.type}
        </h4>
        <form onSubmit={handleCreateAcademicFolder} className="mt-3 space-y-3">
          <input 
            type="text" 
            autoFocus 
            required 
            placeholder="Nombre de la carpeta..." 
            value={academicInput} 
            onChange={(e) => setAcademicInput(e.target.value)} 
            className="w-full text-xs font-medium border border-slate-200 rounded-xl px-3.5 h-11 focus:outline-hidden focus:border-slate-900" 
          />
          <div className="flex gap-2 justify-end text-xs font-bold">
            <button 
              type="button" 
              onClick={() => { setAcademicModal(null); setAcademicInput(''); }} 
              className="px-4 h-10 border border-slate-200 text-slate-600 rounded-xl cursor-pointer"
            >
              Cancelar
            </button>
            <button type="submit" className="px-4 h-10 bg-slate-900 text-white rounded-xl cursor-pointer">
              Crear Carpeta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
