import { useMemo, useState } from 'react';
import { Calendar, CalendarDays, Download, List, Plus, Settings2 } from 'lucide-react';
import ActionSheet from '../common/ActionSheet';
import PdfExportOverlay from '../PdfExportOverlay';
import useSchedulePdfExport from '../../hooks/useSchedulePdfExport';
import { getSubjectKey, resolveScheduleClassColor } from './calendar/scheduleUtils';
import { SHORT_WEEKDAYS, useScheduleCalendar, WEEKDAYS } from './calendar/useScheduleCalendar';
import ScheduleHeader from './calendar/ScheduleHeader';
import DayTabs from './calendar/DayTabs';
import ClassList from './calendar/ClassList';
import ScheduleDaySummary from './calendar/ScheduleDaySummary';
import ScheduleViewSwitcher from './calendar/ScheduleViewSwitcher';
import ScheduleWeekView from './calendar/ScheduleWeekView';
import DayPickerModal from './calendar/modals/DayPickerModal';
import ClassFormModal from './calendar/modals/ClassFormModal';
import ClassDetailModal from './calendar/modals/ClassDetailModal';
import ScheduleSettingsModal from './calendar/modals/ScheduleSettingsModal';
import ScheduleMobileFooter from './calendar/ScheduleMobileFooter';
import { estimateSchedulePdfPages } from '../../utils/pdf/schedule/schedulePdfLayout';

export default function ScheduleCalendar({ userId, scheduleId, onBack, dashboardShell, onOpenSwitcher, isSwitcherOpen = false }) {
  const {
    schedule,
    loading,
    error,
    detailError,
    scheduleName,
    daysCount,
    classes,
    subjectProfiles,
    subjectColors,
    activeDayIndex,
    setActiveDayIndex,
    currentDayClasses,
    showSettings,
    setShowSettings,
    showDayPicker,
    setShowDayPicker,
    showClassForm,
    setShowClassForm,
    handleCloseClassForm: closeClassForm,
    selectedDayForForm,
    setSelectedDayForForm,
    selectedClassDetail,
    setSelectedClassDetail,
    editingClass,
    handleEditClassClick,
    handleSaveClass: saveClass,
    handleDeleteClass,
    handleUpdateAttendance,
    handleUpdateSettings,
    savingClass,
    savingSettings,
    updatingAttendance,
    reload,
  } = useScheduleCalendar(userId, scheduleId);

  const pdfExport = useSchedulePdfExport();
  const [showFabSheet, setShowFabSheet] = useState(false);
  const [showExportSheet, setShowExportSheet] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [showScheduleNameActions, setShowScheduleNameActions] = useState(false);
  const [showModeSheet, setShowModeSheet] = useState(false);
  const [pendingClassSave, setPendingClassSave] = useState(null);
  const [classFormError, setClassFormError] = useState('');
  const [viewMode, setViewMode] = useState('day');
  const isAnyModalOpen = showSettings || showDayPicker || showClassForm || !!selectedClassDetail || showFabSheet || showExportSheet || showMobileActions || showScheduleNameActions || showModeSheet || Boolean(pendingClassSave) || isSwitcherOpen || pdfExport.isExporting;

  const classesWithColors = useMemo(() => classes.map((item) => ({
    ...item,
    resolvedColor: resolveScheduleClassColor(item, subjectColors),
  })), [classes, subjectColors]);

  const exportPageEstimates = useMemo(() => ({
    landscape: estimateSchedulePdfPages({ classes, daysCount, orientation: 'landscape' }),
    portrait: estimateSchedulePdfPages({ classes, daysCount, orientation: 'portrait' }),
  }), [classes, daysCount]);

  if (loading && !schedule) {
    return <div className="mx-auto w-full max-w-2xl px-2 py-20 text-center text-sm text-slate-400 dark:text-slate-500" role="status">Cargando horario…</div>;
  }

  const handleExport = (orientation) => {
    if (pdfExport.isExporting) return;
    setShowExportSheet(false);
    void pdfExport.exportPdf(schedule, orientation);
  };

  const handleCloseClassForm = () => {
    setPendingClassSave(null);
    setClassFormError('');
    closeClassForm();
  };

  const handleClassFormSave = async (formData) => {
    setClassFormError('');
    const editingId = editingClass?.id || null;
    if (editingClass && editingId) {
      const subjectKey = editingClass.subjectKey || getSubjectKey(editingClass.subject);
      const occurrenceCount = classes.filter((item) => (item.subjectKey || getSubjectKey(item.subject)) === subjectKey).length;
      const sharedMetadataChanged = ['subject', 'teacher', 'room'].some((field) => (
        String(formData[field] ?? '') !== String(editingClass[field] ?? '')
      )) || Object.prototype.hasOwnProperty.call(formData, 'color')
        || Object.prototype.hasOwnProperty.call(formData, 'colorMode');

      if (occurrenceCount > 1 && sharedMetadataChanged) {
        setPendingClassSave({ formData, editingId });
        return { ok: false };
      }
    }
    return saveClass(formData, editingId, 'occurrence');
  };

  const resolvePendingClassSave = async (scope) => {
    if (!pendingClassSave) return;
    const pending = pendingClassSave;
    setPendingClassSave(null);
    const result = await saveClass(pending.formData, pending.editingId, scope);
    if (!result?.ok) setClassFormError(result?.error || 'No se pudo guardar el cambio.');
  };

  const fabOptions = [
    { id: 'add-current-day', label: `Añadir a ${WEEKDAYS[activeDayIndex] || `Día ${activeDayIndex + 1}`}`, icon: Plus, onSelect: () => { setSelectedDayForForm(activeDayIndex); setShowClassForm(true); } },
    { id: 'pick-other-day', label: 'Elegir otro día', icon: Calendar, onSelect: () => setShowDayPicker(true) },
  ];

  const mobileActionOptions = [
    {
      id: 'settings',
      label: 'Ajustes del horario',
      description: 'Nombre y días visibles',
      icon: Settings2,
      onSelect: () => {
        setShowMobileActions(false);
        setShowSettings(true);
      },
    },
    {
      id: 'export',
      label: 'Descargar PDF',
      description: 'Elige orientación horizontal o vertical',
      icon: Download,
      onSelect: () => {
        setShowMobileActions(false);
        setShowExportSheet(true);
      },
    },
    { id: 'cancel', label: 'Cancelar' },
  ];

  const exportOptions = [
    {
      id: 'landscape',
      label: 'Horizontal · Semana en cuadrícula',
      description: `${exportPageEstimates.landscape} ${exportPageEstimates.landscape === 1 ? 'página' : 'páginas'} estimadas · eje horario común`,
      disabled: pdfExport.isExporting,
      onSelect: () => handleExport('landscape'),
    },
    {
      id: 'portrait',
      label: 'Vertical · Semana compacta',
      description: `${exportPageEstimates.portrait} ${exportPageEstimates.portrait === 1 ? 'página' : 'páginas'} estimadas · días apilados`,
      disabled: pdfExport.isExporting,
      onSelect: () => handleExport('portrait'),
    },
  ];

  const nextViewMode = viewMode === 'day' ? 'week' : 'day';
  const scheduleNameOptions = [
    {
      id: 'change-mode',
      label: 'Cambiar modo',
      description: 'Alterna entre la vista diaria y semanal',
      icon: viewMode === 'day' ? CalendarDays : List,
      onSelect: () => setShowModeSheet(true),
    },
    {
      id: 'change-schedule',
      label: 'Cambiar horario',
      description: 'Elige otro horario o crea uno nuevo',
      icon: Calendar,
      onSelect: () => onOpenSwitcher?.(),
    },
    { id: 'cancel', label: 'Cancelar' },
  ];

  const modeOptions = [
    {
      id: nextViewMode,
      label: nextViewMode === 'week' ? 'Ver semana' : 'Ver día',
      description: nextViewMode === 'week' ? 'Mostrar todos los días del horario' : 'Mostrar las clases de un día',
      icon: nextViewMode === 'week' ? CalendarDays : List,
      onSelect: () => setViewMode(nextViewMode),
    },
    { id: 'cancel', label: 'Cancelar' },
  ];

  return (
    <div className="relative mx-auto w-full max-w-2xl animate-[fadeIn_0.15s_ease] select-none pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-8">
      <div className="hidden md:block">
        <ScheduleHeader onBack={onBack} scheduleName={scheduleName} onOpenSettings={() => setShowSettings(true)} onOpenScheduleActions={() => setShowScheduleNameActions(true)} onExport={() => setShowExportSheet(true)} exporting={pdfExport.isExporting} />
      </div>

      {error && !showClassForm && !showSettings && !selectedClassDetail && <div className="mx-1 my-3 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300" role="alert"><span className="min-w-0 flex-1">{error}</span><button type="button" onClick={() => void reload()} className="min-h-11 shrink-0 rounded-xl px-2 font-bold underline underline-offset-2 hover:bg-red-100 dark:hover:bg-red-500/20">Reintentar</button></div>}
      {pdfExport.error && <div className="mx-1 my-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300" role="alert">{pdfExport.error}</div>}

      <div className="hidden md:block">
        <ScheduleViewSwitcher value={viewMode} onChange={setViewMode} />
      </div>

      {viewMode === 'day' ? <>
        <DayTabs daysCount={daysCount} activeDayIndex={activeDayIndex} setActiveDayIndex={setActiveDayIndex} classes={classesWithColors} />
        <ScheduleDaySummary classes={currentDayClasses} activeDayIndex={activeDayIndex} />
        <ClassList currentDayClasses={currentDayClasses} activeDayIndex={activeDayIndex} subjectColors={subjectColors} onSelectClass={setSelectedClassDetail} />
      </> : <ScheduleWeekView
        classes={classesWithColors}
        daysCount={daysCount}
        activeDayIndex={activeDayIndex}
        subjectColors={subjectColors}
        onSelectDay={(dayIndex) => { setActiveDayIndex(dayIndex); setViewMode('day'); }}
        onSelectClass={setSelectedClassDetail}
      />}

      {!isAnyModalOpen && (
        <ScheduleMobileFooter
          scheduleName={scheduleName}
          viewMode={viewMode}
          onBack={onBack}
          onOpenActions={() => setShowMobileActions(true)}
          onOpenScheduleActions={() => setShowScheduleNameActions(true)}
          onAddClass={() => setShowFabSheet(true)}
          dashboardShell={dashboardShell}
        />
      )}

      <ActionSheet open={showScheduleNameActions} title="Opciones del horario" options={scheduleNameOptions} onClose={() => setShowScheduleNameActions(false)} compact />
      <ActionSheet open={showModeSheet} title="Cambiar modo" options={modeOptions} onClose={() => setShowModeSheet(false)} compact />
      <ActionSheet open={showMobileActions} title="Acciones del horario" options={mobileActionOptions} onClose={() => setShowMobileActions(false)} compact />
      <ActionSheet open={showFabSheet} title="Añadir clase" options={fabOptions} onClose={() => setShowFabSheet(false)} compact />
      <ActionSheet open={showExportSheet} title="Exportar horario" options={exportOptions} onClose={() => setShowExportSheet(false)} compact />
      <ActionSheet
        open={Boolean(pendingClassSave)}
        title="Aplicar cambios"
        options={[
          {
            id: 'all',
            label: 'Aplicar a todos los días',
            onSelect: () => { void resolvePendingClassSave('all'); },
          },
          {
            id: 'occurrence',
            label: 'Aplicar sólo a este día',
            onSelect: () => { void resolvePendingClassSave('occurrence'); },
          },
          { id: 'cancel', label: 'Cancelar' },
        ]}
        onClose={() => setPendingClassSave(null)}
        compact
      />

      <DayPickerModal open={showDayPicker} daysCount={daysCount} onSelectDay={(index) => { setSelectedDayForForm(index); setShowDayPicker(false); window.setTimeout(() => setShowClassForm(true), 180); }} onClose={() => setShowDayPicker(false)} />

      {showClassForm && <ClassFormModal
        key={editingClass?.id || 'new'}
        selectedDay={selectedDayForForm}
        onClose={handleCloseClassForm}
        onSave={handleClassFormSave}
        error={classFormError}
        saving={savingClass}
        initialSubject={editingClass?.subject || ''}
        initialTeacher={editingClass?.teacher || ''}
        initialRoom={editingClass?.room || ''}
        initialStartTime={editingClass?.startTime || '08:00'}
        initialEndTime={editingClass?.endTime || '09:30'}
        initialSubjectKey={editingClass?.subjectKey || ''}
        initialColor={editingClass?.colorMode === 'custom' ? editingClass.color : null}
        initialColorMode={editingClass?.colorMode || 'automatic'}
        existingClasses={classes}
        subjectProfiles={subjectProfiles}
      />}

      {selectedClassDetail && <ClassDetailModal selectedClass={selectedClassDetail} subjectColors={subjectColors} occurrenceCount={classes.filter((item) => (item.subjectKey || getSubjectKey(item.subject)) === (selectedClassDetail.subjectKey || getSubjectKey(selectedClassDetail.subject))).length} error={detailError} onClose={() => setSelectedClassDetail(null)} onDelete={handleDeleteClass} onUpdateAttendance={handleUpdateAttendance} onEdit={handleEditClassClick} updatingAttendance={updatingAttendance} />}

      {showSettings && <ScheduleSettingsModal scheduleName={scheduleName} daysCount={daysCount} classes={classes} onSave={handleUpdateSettings} saving={savingSettings} onClose={() => setShowSettings(false)} />}

      <PdfExportOverlay isOpen={pdfExport.isExporting} progress={pdfExport.progress} onCancel={pdfExport.cancel} title="Generando horario" itemLabel="páginas" />
    </div>
  );
}

export { SHORT_WEEKDAYS };
