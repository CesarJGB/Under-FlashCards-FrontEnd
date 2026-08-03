import { useState } from 'react';
import { AlertTriangle, Loader2, Minus, Plus, X } from 'lucide-react';
import ActionSheet from '../../../common/ActionSheet';
import { useBodyScrollLock } from '../../../../lib/scrollLock';
import useModalAccessibility from '../../../../hooks/useModalAccessibility';

export default function ScheduleSettingsModal({ scheduleName, daysCount, classes = [], onSave, onClose, saving = false }) {
  const [draftName, setDraftName] = useState(scheduleName);
  const [draftDays, setDraftDays] = useState(daysCount);
  const [showWarning, setShowWarning] = useState(false);
  const [formError, setFormError] = useState('');
  useBodyScrollLock(true, 'schedule-settings');
  const dialogRef = useModalAccessibility({ open: !showWarning, onClose });
  const hiddenClassesCount = classes.filter((item) => item.dayIndex >= draftDays).length;

  const saveAndClose = async () => {
    if (!draftName.trim()) {
      setFormError('El nombre del horario es requerido.');
      setShowWarning(false);
      return;
    }
    const result = await onSave({ name: draftName.trim(), daysCount: draftDays });
    if (result?.ok === false) {
      setFormError(result.error || 'No se pudieron guardar los ajustes.');
      return;
    }
    onClose();
  };

  const handleDone = () => {
    setFormError('');
    if (hiddenClassesCount > 0) setShowWarning(true);
    else void saveAndClose();
  };

  return (
    <>
      <div ref={dialogRef} tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 outline-none backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Ajustes del horario">
        <div className="w-full max-w-sm rounded-3xl bg-white p-5 text-slate-900 shadow-2xl dark:bg-slate-900 dark:text-white">
          <div className="flex items-center justify-between pb-3"><h2 className="text-base font-extrabold">Ajustes</h2><button type="button" onClick={onClose} disabled={saving} className="min-h-11 min-w-11 rounded-full p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800" aria-label="Cerrar ajustes"><X className="mx-auto h-5 w-5" /></button></div>
          {formError && <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300" role="alert">{formError}</p>}
          <div className="space-y-1">
            <p className="px-1 text-xs font-bold uppercase tracking-wide text-slate-400">Horario</p>
            <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
              <label className="flex items-center justify-between gap-3 bg-white p-3.5 dark:bg-slate-900"><span className="text-xs font-bold">Nombre</span><input type="text" value={draftName} onChange={(event) => setDraftName(event.target.value)} className="min-h-11 max-w-[170px] rounded-lg bg-transparent px-2 text-right text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600" /></label>
              <div className="flex items-center justify-between bg-white p-3.5 dark:bg-slate-900"><div><span className="block text-xs font-bold">Días</span><span className="text-[11px] text-slate-400">{draftDays} días</span></div><div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800"><button type="button" disabled={draftDays <= 5} onClick={() => setDraftDays((value) => Math.max(5, value - 1))} className="min-h-11 min-w-11 rounded-lg hover:bg-white disabled:opacity-30 dark:hover:bg-slate-700" aria-label="Reducir días"><Minus className="mx-auto h-4 w-4" /></button><button type="button" disabled={draftDays >= 7} onClick={() => setDraftDays((value) => Math.min(7, value + 1))} className="min-h-11 min-w-11 rounded-lg hover:bg-white disabled:opacity-30 dark:hover:bg-slate-700" aria-label="Aumentar días"><Plus className="mx-auto h-4 w-4" /></button></div></div>
            </div>
            {hiddenClassesCount > 0 && <p className="px-1 pt-2 text-[11px] font-semibold text-amber-600 dark:text-amber-300">{hiddenClassesCount} clase{hiddenClassesCount !== 1 ? 's quedan' : ' queda'} fuera de los días visibles. No se borrará.</p>}
          </div>
          <button type="button" disabled={saving} onClick={handleDone} className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Guardar cambios</button>
        </div>
      </div>

      <ActionSheet open={showWarning} title="Reducir días" options={[{ id: 'confirm', label: 'Continuar', description: `Se ocultarán ${hiddenClassesCount} clase(s) en los días no visibles.`, icon: AlertTriangle, danger: true, onSelect: saveAndClose }, { id: 'cancel', label: 'Cancelar' }]} onClose={() => setShowWarning(false)} />
    </>
  );
}
