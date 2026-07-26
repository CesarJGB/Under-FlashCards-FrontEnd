// FILE: frontend/src/components/library/calendar/modals/ScheduleSettingsModal.jsx
import { useState } from 'react';
import { X, Minus, Plus, AlertTriangle } from 'lucide-react';
import ActionSheet from '../../../common/ActionSheet';

export default function ScheduleSettingsModal({ 
  scheduleName, 
  daysCount, 
  classes = [], 
  onSave, 
  onClose 
}) {
  const [draftName, setDraftName] = useState(scheduleName);
  const [draftDays, setDraftDays] = useState(daysCount);
  const [showWarning, setShowWarning] = useState(false);

  const hiddenClassesCount = classes.filter((c) => c.dayIndex >= draftDays).length;

  const saveAndClose = () => {
    onSave({ name: draftName, daysCount: draftDays });
    onClose();
  };

  const handleDone = () => {
    if (hiddenClassesCount > 0) {
      setShowWarning(true); // Abre el ActionSheet de advertencia si hay clases en días a ocultar
    } else {
      saveAndClose(); // Guarda directo si no hay clases afectadas
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-[fadeIn_0.15s_ease]">
        <div className="w-full max-w-sm bg-slate-100 rounded-3xl p-5 shadow-2xl space-y-4">
          
          <div className="flex items-center justify-between pb-2">
            <h3 className="text-base font-extrabold text-slate-900">Ajustes</h3>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide px-1">
              Horario
            </p>
            
            <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden">
              <div className="p-3.5 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  Nombre del horario
                </span>
                <input
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="text-xs font-medium text-slate-500 text-right bg-transparent focus:outline-none focus:text-slate-900 max-w-[130px]"
                />
              </div>

              <div className="p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Días</span>
                  <span className="text-[11px] font-medium text-slate-400">{draftDays} días</span>
                </div>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    disabled={draftDays <= 5}
                    onClick={() => setDraftDays((prev) => Math.max(5, prev - 1))}
                    className="p-1 rounded-lg hover:bg-white disabled:opacity-30 cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5 text-slate-700" />
                  </button>
                  <button
                    type="button"
                    disabled={draftDays >= 7}
                    onClick={() => setDraftDays((prev) => Math.min(7, prev + 1))}
                    className="p-1 rounded-lg hover:bg-white disabled:opacity-30 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-slate-700" />
                  </button>
                </div>
              </div>
            </div>

            {hiddenClassesCount > 0 && (
              <p className="text-[11px] font-semibold text-amber-600 px-1 pt-1">
                Ocultarás {hiddenClassesCount} clase{hiddenClassesCount !== 1 ? 's' : ''} (no se borran, solo dejan de verse).
              </p>
            )}
          </div>

          <div className="pt-4">
            <button
              type="button"
              onClick={handleDone}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 rounded-xl text-sm font-bold text-white cursor-pointer transition-colors"
            >
              Guardar Cambios
            </button>
          </div>

        </div>
      </div>

      {/* ActionSheet de advertencia al reducir días */}
      <ActionSheet
        open={showWarning}
        title="Reducir días"
        options={[
          {
            id: 'confirm',
            label: 'Entendido, continuar',
            description: `Ocultarás ${hiddenClassesCount} clase(s) en los días que ya no serán visibles. No se borrarán.`,
            icon: AlertTriangle,
            danger: true,
            onSelect: saveAndClose,
          },
          {
            id: 'cancel',
            label: 'Cancelar',
          },
        ]}
        onClose={() => setShowWarning(false)}
      />
    </>
  );
}
