// ARCHIVO: frontend/src/components/DeckHeader.jsx
import { useState } from 'react';
import { ArrowLeft, ChevronDown, FileText, Download, FileJson } from 'lucide-react';

export default function DeckHeader({ deck, mode, setMode, onBack, onExport, onExportPDF }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 min-h-[60px]">
      
      {/* 1. LADO IZQUIERDO: Botón clásico de regreso limpio a la biblioteca */}
      <div className="sm:w-1/3 flex justify-start">
        <button 
          onClick={onBack} 
          className="inline-flex items-center gap-2 px-3.5 py-2 border border-slate-200 bg-white text-slate-600 hover:text-slate-900 rounded-xl text-xs font-bold shadow-3xs transition-all active:scale-95 group cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-800 transition-colors" />
          <span>Volver a la biblioteca</span>
        </button>
      </div>

      {/* 2. EJE CENTRAL: Selector de Modos ampliado y alineado */}
      <div className="sm:w-1/3 flex justify-center">
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/40 items-center">
          <button 
            onClick={() => setMode('edit')} 
            className={`px-6 py-2 text-xs font-bold rounded-lg transition-all ${
              mode === 'edit' || mode === 'fast-delete' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Editor
          </button>
          <button 
            onClick={() => setMode('review')} 
            className={`px-6 py-2 text-xs font-bold rounded-lg transition-all ${
              mode === 'review' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Repasar
          </button>
        </div>
      </div>

      {/* 3. LADO DERECHO: Botón de Opciones compacto e iconográfico (Desaparece en Repaso) */}
      <div className="sm:w-1/3 flex justify-end items-center">
        {mode !== 'review' ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              title="Opciones del mazo"
              className="p-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center cursor-pointer aspect-square"
            >
              <Download className="w-4 h-4" />
            </button>

            {isOpen && (
              <>
                {/* Capa de cierre al hacer clic afuera */}
                <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
                
                <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl z-40 p-1.5 animate-[slideUp_0.12s_ease-out] flex flex-col gap-0.5">
                  
                  {/* Opción A: Guía de estudio */}
                  <button
                    type="button"
                    onClick={() => { onExportPDF('guide'); setIsOpen(false); }}
                    className="w-full text-left p-2.5 hover:bg-slate-50 rounded-xl transition-colors flex items-start gap-2.5 group cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-slate-400 group-hover:text-slate-900 mt-0.5 shrink-0 transition-colors" />
                    <div>
                      <p className="text-xs font-bold text-slate-800 group-hover:text-slate-950">Guía de estudio</p>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5 leading-relaxed">Descarga un archivo PDF continuo con formato de lista para lectura estática.</p>
                    </div>
                  </button>

                  {/* Opción B: Tarjetas imprimibles */}
                  <button
                    type="button"
                    onClick={() => { onExportPDF('cards'); setIsOpen(false); }}
                    className="w-full text-left p-2.5 hover:bg-slate-50 rounded-xl transition-colors flex items-start gap-2.5 group cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-slate-400 group-hover:text-slate-900 mt-0.5 shrink-0 transition-colors" />
                    <div>
                      <p className="text-xs font-bold text-slate-800 group-hover:text-slate-950">Tarjetas imprimibles</p>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5 leading-relaxed">Genera un PDF con cuadrículas de tamaño real listas para imprimir y recortar.</p>
                    </div>
                  </button>

                  <div className="my-1 border-t border-slate-100" />

                  {/* Opción C: Exportar copia JSON */}
                  <button
                    type="button"
                    onClick={() => { onExport(); setIsOpen(false); }}
                    className="w-full text-left p-2.5 hover:bg-slate-50 rounded-xl transition-colors flex items-start gap-2.5 group cursor-pointer"
                  >
                    <FileJson className="w-4 h-4 text-slate-400 group-hover:text-slate-900 mt-0.5 shrink-0 transition-colors" />
                    <div>
                      <p className="text-xs font-bold text-slate-800 group-hover:text-slate-950">Exportar mazo</p>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5 leading-relaxed">Descarga una copia de seguridad en formato JSON con todas las tarjetas de este mazo.</p>
                    </div>
                  </button>

                </div>
              </>
            )}
          </div>
        ) : (
          /* Bloque fantasma invisible para bloquear la simetría del flex-layout en Repaso */
          <div className="w-9 h-9 hidden sm:block" />
        )}
      </div>

    </div>
  );
}
