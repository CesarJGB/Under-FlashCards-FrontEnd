// ARCHIVO: frontend/src/components/library/LibraryFAB.jsx
import { useState } from 'react';
import { Plus, Sparkles, Upload, Loader2 } from 'lucide-react';

export default function LibraryFAB({ 
  setModal, 
  fileInputRef, 
  importing 
}) {
  const [fabOpen, setFabOpen] = useState(false);

  return (
    <div className="fixed bottom-24 right-4 md:bottom-10 md:right-8 z-50 flex flex-col items-end gap-2.5">
      {/* Fondo difuminado sutil para cuando el FAB esté abierto */}
      {fabOpen && (
        <div
          onClick={() => setFabOpen(false)}
          className="fixed inset-0 bg-slate-900/10 backdrop-blur-xs z-40 animate-[fadeIn_0.15s_ease]"
        />
      )}

      {/* Menú de Opciones Desplegables */}
      {fabOpen && (
        <div className="flex flex-col items-end gap-2 z-50 mb-1.5 animate-[slideUp_0.15s_ease-out]">
          <button
            type="button"
            onClick={() => { setFabOpen(false); }}
            className="w-44 flex items-center justify-between bg-slate-800 text-white pl-3.5 pr-1.5 py-1.5 rounded-2xl text-xs font-bold shadow-lg hover:bg-slate-700 active:scale-95 transition-all border border-slate-700/50 cursor-pointer"
          >
            <span>Generar con IA</span>
            <div className="w-7 h-7 bg-slate-700/60 rounded-xl flex items-center justify-center shadow-inner">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => { setFabOpen(false); fileInputRef.current?.click(); }}
            disabled={importing}
            className="w-44 flex items-center justify-between bg-white text-slate-700 border border-slate-200/80 pl-3.5 pr-1.5 py-1.5 rounded-2xl text-xs font-bold shadow-lg hover:bg-slate-50 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
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

          <button
            type="button"
            onClick={() => { setFabOpen(false); setModal({}); }}
            className="w-44 flex items-center justify-between bg-white text-slate-700 border border-slate-200/80 pl-3.5 pr-1.5 py-1.5 rounded-2xl text-xs font-bold shadow-lg hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
          >
            <span>Nuevo mazo</span>
            <div className="w-7 h-7 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100">
              <Plus className="w-3.5 h-3.5 text-slate-500" />
            </div>
          </button>
        </div>
      )}

      {/* ✨ ACTUALIZADO: Botón Gatillo Cuadrado, Más Grande (h-14) y con Bordes Suaves */}
      <button
        type="button"
        onClick={() => setFabOpen(!fabOpen)}
        className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-xl z-50 transition-all duration-200 active:scale-90 cursor-pointer ${
          fabOpen ? 'bg-slate-800 rotate-45' : 'bg-slate-900 hover:bg-slate-800 hover:scale-105'
        }`}
      >
        <Plus className="w-6 h-6 stroke-[2.5]" />
      </button>
    </div>
  );
}
