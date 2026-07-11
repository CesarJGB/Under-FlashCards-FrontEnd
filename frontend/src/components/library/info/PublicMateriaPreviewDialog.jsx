import React from 'react';
import PublicMateriaProfile from '../../public/PublicMateriaProfile';
import { Dialog, DialogContent } from '../../ui/dialog';

export default function PublicMateriaPreviewDialog({ open, onOpenChange, shareId, materiaName }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-[1280px] h-[calc(100dvh-1rem)] max-h-none p-0 gap-0 overflow-hidden rounded-[28px] sm:rounded-[28px] border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
        <div className="flex h-full flex-col">
          <div className="shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur px-5 py-4 pr-12">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500 font-bold">
              Vista previa publica
            </p>
            <h2 className="mt-1 text-lg md:text-xl font-black tracking-tight text-slate-950 dark:text-slate-50">
              {materiaName || 'Materia'}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Asi la vera alguien sin iniciar sesion cuando abras el enlace compartido.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto">
            <PublicMateriaProfile shareId={shareId} embedded />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
