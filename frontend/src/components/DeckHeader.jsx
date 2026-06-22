import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Download, Pencil, BookOpen, FileText, ChevronDown } from 'lucide-react';

export default function DeckHeader({ deck, mode, setMode, onBack, onExport, onExportPDF }) {
  const [pdfMenuOpen, setPdfMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setPdfMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a la Biblioteca
        </button>
        
        {mode === 'edit' && (
          <div className="flex gap-2 relative" ref={menuRef}>
            {/* Botón desplegable de PDF */}
            <button
              onClick={() => setPdfMenuOpen(!pdfMenuOpen)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm active:scale-95"
            >
              <FileText className="w-4 h-4 text-slate-500" />
              <span className="hidden sm:inline">Descargar PDF</span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${pdfMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Opciones del Dropdown */}
            {pdfMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-white border border-slate-200 p-1.5 shadow-xl z-50 animate-[slideUp_0.12s_ease-out]">
                <button
                  onClick={() => { setPdfMenuOpen(false); onExportPDF('guide'); }}
                  className="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-xl flex flex-col gap-0.5"
                >
                  <span>📝 Guía de Texto Plano</span>
                  <span className="text-[10px] font-normal text-slate-400">Formato de lista limpia y compacta</span>
                </button>
                <button
                  onClick={() => { setPdfMenuOpen(false); onExportPDF('cards'); }}
                  className="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-xl flex flex-col gap-0.5 border-t border-slate-100 mt-1 pt-2"
                >
                  <span>🎴 Tarjetas Visuales Completas</span>
                  <span className="text-[10px] font-normal text-slate-400">Con fondos, estilos y rejilla imprimible</span>
                </button>
              </div>
            )}
            
            <button
              onClick={onExport}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span className="hidden sm:inline">Exportar JSON</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabs de Modo (Edición vs Repaso) */}
      <div className="mt-4 w-full max-w-xl mx-auto flex justify-center px-2">
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setMode('edit')}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'edit' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Pencil className="w-4 h-4" /> Modo Edición
          </button>
          <button
            type="button"
            onClick={() => setMode('review')}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'review' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <BookOpen className="w-4 h-4" /> Modo Repaso
          </button>
        </div>
      </div>
    </>
  );
}
