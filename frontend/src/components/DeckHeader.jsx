// ARCHIVO: frontend/src/components/DeckHeader.jsx
import { useState } from 'react';
import { ArrowLeft, ChevronDown, FileJson, FileText, Download, Upload } from 'lucide-react';

export default function DeckHeader({ deck, mode, setMode, onBack, onExport, onExportPDF, onImport }) {
  const [isOpen, setIsOpen] = useState(false);

  // Procesa el archivo JSON seleccionado y lo envía al mazo administrador
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (onImport) onImport(file);
    setIsOpen(false);
    e.target.value = ''; // Resetea el input
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
      
      {/* Lado Izquierdo: Retorno y metadatos */}
      <div className="flex items-center gap-3">
        <button 
          onClick={onBack} 
          className="p-2 hover:bg-slate-100 rounded-xl transition-colors group"
          title="Volver a los mazos"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600 group-hover:text-slate-900 transition-colors" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{deck?.title || 'Mazo'}</h1>
          <p className="text-xs text-slate-500">Configuración y herramientas del mazo</p>
        </div>
      </div>

      {/* Lado Derecho: Controles de flujo y barra de acciones */}
      <div className="flex items-center gap-2.5 self-end md:self-auto">
        
        {/* Selector de Modos (Editor / Repaso) */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/40">
          <button 
            onClick={() => setMode('edit')} 
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              mode === 'edit' || mode === 'fast-delete' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Editor
          </button>
          <button 
            onClick={() => setMode('review')} 
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              mode === 'review' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Repasar
          </button>
        </div>

        {/* 📄 Botón del Documento (Exportación JSON) ocupando el lugar anterior de importar */}
        <button
          type="button"
          onClick={onExport}
          title="Exportar copia de seguridad (JSON)"
          className="p-2 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl shadow-3xs transition-all active:scale-95 flex items-center justify-center cursor-pointer"
        >
          <FileJson className="w-4 h-4" />
        </button>

        {/* ⬇️ Dropdown Unificado Avanzado (Sin Emojis) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Opciones</span>
            <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          {isOpen && (
            <>
              {/* Capa de cierre al hacer clic afuera */}
              <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
              
              <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl z-40 p-1.5 animate-[slideUp_0.12s_ease-out] flex flex-col gap-0.5">
                
                {/* Opción 1: Guía de estudio */}
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

                {/* Opción 2: Tarjetas recortables */}
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

                {/* Opción 3: Importar archivo de tarjetas (Nueva Ubicación) */}
                <label
                  className="w-full text-left p-2.5 hover:bg-slate-50 rounded-xl transition-colors flex items-start gap-2.5 group cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-slate-400 group-hover:text-slate-900 mt-0.5 shrink-0 transition-colors" />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-800 group-hover:text-slate-950">Importar tarjetas</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5 leading-relaxed">Carga un archivo JSON estructurado para añadir flashcards de golpe a este mazo.</p>
                  </div>
                  <input 
                    type="file" 
                    accept=".json" 
                    onChange={handleFileChange} 
                    className="hidden" 
                  />
                </label>

              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
