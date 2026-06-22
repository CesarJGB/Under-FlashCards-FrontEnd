// ARCHIVO: frontend/src/components/DeckHeader.jsx
import { useState } from 'react';
import { ArrowLeft, ChevronDown, FileText, Download, FileJson } from 'lucide-react';

export default function DeckHeader({ deck, mode, setMode, onBack, onExport, onExportPDF }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3.5 pb-4 border-b border-slate-200">
      
      {/* 1. FILA SUPERIOR (MÓVIL): Muestra el botón de regresar arriba solo en pantallas chicas */}
      <div className="flex sm:hidden justify-start">
        <button 
          onClick={onBack} 
          className="inline-flex items-center gap-2 px-3.5 py-2 border border-slate-200 bg-white text-slate-600 hover:text-slate-900 rounded-xl text-xs font-bold shadow-3xs transition-all active:scale-[0.97] group cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-800 transition-colors" />
          <span>Volver a la biblioteca</span>
        </button>
      </div>

      {/* 2. FILA DE CONTROLES ABSOLUTA: Garantiza centrado matemático puro del selector */}
      <div className="relative w-full flex items-center justify-center min-h-[42px]">
        
        {/* LADO IZQUIERDO (ESCRITORIO): Extraído del flujo para no alterar el centro geométrico */}
        <div className="hidden sm:block absolute left-0">
          <button 
            onClick={onBack} 
            className="inline-flex items-center gap-2 px-3.5 py-2 border border-slate-200 bg-white text-slate-600 hover:text-slate-900 rounded-xl text-xs font-bold shadow-3xs transition-all active:scale-[0.97] group cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-800 transition-colors" />
            <span>Volver a la biblioteca</span>
          </button>
        </div>

        {/* EJE CENTRAL (FLUJO NORMAL): Centrado perfecto respecto al mazo general */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/40 items-center z-10">
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

        {/* LADO DERECHO: Botón de opciones anclado de forma absoluta en el extremo derecho */}
        <div className="absolute right-0 flex items-center justify-end z-20">
          {mode !== 'review' && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                title="Opciones del mazo"
                className="p-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-sm transition-all active:scale-[0.97] flex items-center justify-center cursor-pointer aspect-square"
              >
                <Download className="w-4 h-4" />
              </button>

              {isOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
                  
                  <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl z-40 p-1.5 animate-[slideUp_0.12s_ease-out] flex flex-col gap-0.5">
                    
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
          )}
        </div>

      </div>
    </div>
  );
}
