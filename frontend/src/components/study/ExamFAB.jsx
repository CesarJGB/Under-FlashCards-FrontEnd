import { useState } from 'react';
import { createPortal } from 'react-dom';
import { FilePlus, FolderPlus, Layers, Plus } from 'lucide-react';

export default function ExamFAB({
  isInsideFolder,
  onCreateFolder,
  onCreateScratch,
  onCreateFromDecks,
  dashboardShell,
}) {
  const [open, setOpen] = useState(false);
  const folderLabel = isInsideFolder ? 'Crear su carpeta' : 'Crear carpeta';

  const fabButton = !open && (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="absolute right-6 w-14 h-14 rounded-2xl bg-slate-900 text-white shadow-lg flex items-center justify-center z-50 hover:bg-slate-800 hover:scale-105 active:scale-90 transition-all duration-200 cursor-pointer md:fixed"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 6rem)' }}
      aria-label="Abrir acciones de exámenes"
    >
      <Plus className="w-6 h-6 stroke-[2.5]" />
    </button>
  );

  const actionSheet = open && (
    <>
      <div
        onClick={() => setOpen(false)}
        className="fixed inset-0 bg-slate-900/40 z-40 animate-[fadeIn_0.25s_ease-out]"
      />

      <div
        className="fixed bottom-0 inset-x-0 z-50"
        style={{ animation: 'slideUp 0.4s cubic-bezier(0.32, 0.72, 0, 1) forwards' }}
      >
        <div className="bg-white rounded-t-3xl shadow-2xl">
          <div className="flex justify-center pt-3 pb-4">
            <div className="w-10 h-1 bg-slate-300 rounded-full" />
          </div>

          <div className="px-4 pb-8 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => { setOpen(false); onCreateFolder(); }}
              className="w-full bg-gradient-to-br from-indigo-100 to-violet-100 border-2 border-indigo-200 rounded-3xl p-5 text-left shadow-lg shadow-indigo-200/50 hover:shadow-xl active:scale-[0.98] transition-all duration-200"
              style={{ animation: 'cardIn 0.35s cubic-bezier(0.32, 0.72, 0, 1) 0.08s both' }}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
                  <FolderPlus className="w-6 h-6 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-slate-900 leading-tight mb-1">{folderLabel}</h3>
                  <p className="text-sm text-slate-700 leading-snug">Organiza tus exámenes en carpetas.</p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => { setOpen(false); onCreateScratch(); }}
              className="w-full bg-slate-50 border border-slate-200 rounded-3xl p-5 text-left hover:shadow-md active:scale-[0.98] transition-all duration-200"
              style={{ animation: 'cardIn 0.35s cubic-bezier(0.32, 0.72, 0, 1) 0.14s both' }}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
                  <FilePlus className="w-6 h-6 text-slate-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-slate-900 leading-tight mb-1">Crear examen desde cero</h3>
                  <p className="text-sm text-slate-600 leading-snug">Añade tus propias preguntas en el editor.</p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => { setOpen(false); onCreateFromDecks(); }}
              className="w-full bg-slate-50 border border-slate-200 rounded-3xl p-5 text-left hover:shadow-md active:scale-[0.98] transition-all duration-200"
              style={{ animation: 'cardIn 0.35s cubic-bezier(0.32, 0.72, 0, 1) 0.20s both' }}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Layers className="w-6 h-6 text-slate-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-slate-900 leading-tight mb-1">Crear examen desde mazo o mazos</h3>
                  <p className="text-sm text-slate-600 leading-snug">Selecciona tarjetas existentes como fuente.</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {dashboardShell ? createPortal(fabButton, dashboardShell) : fabButton}
      {actionSheet}
    </>
  );
}
