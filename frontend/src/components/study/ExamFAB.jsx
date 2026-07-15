import { useState } from 'react';
import { createPortal } from 'react-dom';
import { FilePlus, FolderPlus, Layers, Plus } from 'lucide-react';
import ActionSheet from '../common/ActionSheet';

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
      className="absolute right-6 z-50 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg transition-all duration-200 hover:scale-105 hover:bg-slate-800 active:scale-90 md:fixed"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 6rem)' }}
      aria-label="Abrir acciones de exámenes"
    >
      <Plus className="h-6 w-6 stroke-[2.5]" />
    </button>
  );

  return (
    <>
      {dashboardShell ? createPortal(fabButton, dashboardShell) : fabButton}
      <ActionSheet
        open={open}
        title="Crear"
        onClose={() => setOpen(false)}
        options={[
          {
            id: 'folder',
            label: folderLabel,
            description: 'Organiza tus exámenes en carpetas.',
            icon: FolderPlus,
            onSelect: onCreateFolder,
          },
          {
            id: 'scratch',
            label: 'Crear examen desde cero',
            description: 'Añade tus propias preguntas en el editor.',
            icon: FilePlus,
            onSelect: onCreateScratch,
          },
          {
            id: 'from_deck',
            label: 'Crear examen desde mazo o mazos',
            description: 'Selecciona tarjetas existentes como fuente.',
            icon: Layers,
            onSelect: onCreateFromDecks,
          },
        ]}
      />
    </>
  );
}
