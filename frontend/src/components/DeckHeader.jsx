import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, FileText, Download, FileJson, Loader2, X } from 'lucide-react';

export default function DeckHeader({
  deck,
  mode,
  setMode,
  onBack,
  onExport,
  onExportPDF,
  isExportingPdf = false,
  pdfProgress,
  pdfError,
  pdfWarnings = [],
  onCancelPdfExport,
  onHeightChange,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const headerRef = useRef(null);

  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header || typeof onHeightChange !== 'function') return undefined;

    const updateHeight = () => {
      onHeightChange(Math.ceil(header.getBoundingClientRect().height));
    };

    updateHeight();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateHeight);
      return () => window.removeEventListener('resize', updateHeight);
    }

    const observer = new ResizeObserver(updateHeight);
    observer.observe(header);
    return () => observer.disconnect();
  }, [onHeightChange]);

  return (
    /* ð position: fixed fuerza al header a pegar con el borde superior del viewport */
    <header
      ref={headerRef}
      className="fixed top-0 left-0 right-0 z-50 w-full flex items-center justify-center bg-white/95 backdrop-blur-xl px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 border-b border-slate-200 min-h-[64px] isolate"
    >
      
      {/* 1. LADO IZQUIERDO */}
      {mode !== 'review' && (
        <div className="absolute left-4 flex items-center z-20 animate-[fadeIn_0.1s_ease]">
          <button 
            onClick={onBack} 
            title="Volver a la biblioteca"
            className="min-h-11 min-w-11 p-2.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl shadow-3xs transition-all active:scale-[0.97] flex items-center justify-center aspect-square cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. EJE CENTRAL */}
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

      {/* 3. LADO DERECHO */}
      <div className="absolute right-4 flex items-center z-20">
        {mode !== 'review' && (
          <div className="relative">
            <button
              type="button"
              onClick={() => !isExportingPdf && setIsOpen(!isOpen)}
              disabled={isExportingPdf}
              title="Opciones del mazo"
              className="min-h-11 min-w-11 p-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-sm transition-all active:scale-[0.97] flex items-center justify-center aspect-square cursor-pointer disabled:cursor-wait disabled:opacity-80"
            >
              {isExportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
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
                      <p className="text-xs font-bold text-slate-800 group-hover:text-slate-950">GuÃ­a de estudio</p>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5 leading-relaxed">Descarga un archivo PDF continuo con formato de lista para lectura estÃ¡tica.</p>
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
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5 leading-relaxed">Genera un PDF con cuadrÃ­culas de tamaÃ±o real listas para imprimir y recortar.</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => { onExportPDF('questions'); setIsOpen(false); }}
                    className="w-full text-left p-2.5 hover:bg-slate-50 rounded-xl transition-colors flex items-start gap-2.5 group cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-slate-400 group-hover:text-slate-900 mt-0.5 shrink-0 transition-colors" />
                    <div>
                      <p className="text-xs font-bold text-slate-800 group-hover:text-slate-950">Banco de preguntas</p>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5 leading-relaxed">Exporta Ãºnicamente las preguntas numeradas con soporte para imÃ¡genes frontales.</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => { onExportPDF('answers'); setIsOpen(false); }}
                    className="w-full text-left p-2.5 hover:bg-slate-50 rounded-xl transition-colors flex items-start gap-2.5 group cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-slate-400 group-hover:text-slate-900 mt-0.5 shrink-0 transition-colors" />
                    <div>
                      <p className="text-xs font-bold text-slate-800 group-hover:text-slate-950">Banco de respuestas</p>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5 leading-relaxed">Genera una hoja con las respuestas numeradas correspondientes para autoevaluaciÃ³n.</p>
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

        {isExportingPdf && (
          <div className="absolute right-0 top-full z-30 mt-2 flex w-72 items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 shadow-sm">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            <span className="min-w-0 flex-1 truncate">{pdfProgress?.message || 'Generando PDF...'}</span>
            {typeof onCancelPdfExport === 'function' && (
              <button
                type="button"
                onClick={onCancelPdfExport}
                className="rounded-lg p-1 text-indigo-500 transition-colors hover:bg-indigo-100 hover:text-indigo-700 cursor-pointer"
                title="Cancelar exportaciÃ³n"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {!isExportingPdf && pdfError && (
          <div role="alert" className="absolute right-0 top-full z-30 mt-2 w-72 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 shadow-sm">
            {pdfError}
          </div>
        )}

        {!isExportingPdf && pdfWarnings.length > 0 && (
          <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 shadow-sm">
            {pdfWarnings.length === 1 ? pdfWarnings[0].message : `El PDF se generÃ³ con ${pdfWarnings.length} advertencias.`}
          </div>
        )}
      </div>
    </header>
  );
}
