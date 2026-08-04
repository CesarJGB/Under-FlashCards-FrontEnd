import { useMemo, useState } from 'react';
import { Calendar, Download, Plus, Settings2 } from 'lucide-react';
import ActionSheet from '../common/ActionSheet';
import PdfExportOverlay from '../PdfExportOverlay';
import useSchedulePdfExport from '../../hooks/useSchedulePdfExport';
import { resolveScheduleClassColor } from './calendar/scheduleUtils';
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
    handleCloseClassForm,
    selectedDayForForm,
    setSelectedDayForForm,
    selectedClassDetail,
    setSelectedClassDetail,
    editingClass,
    handleEditClassClick,
    handleSaveClass,
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
  const [viewMode, setViewMode] = useState('day');
  const isAnyModalOpen = showSettings || showDayPicker || showClassForm || !!selectedClassDetail || showFabSheet || showExportSheet || showMobileActions || isSwitcherOpen || pdfExport.isExporting;

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

  return (
    <div className="relative mx-auto w-full max-w-2xl animate-[fadeIn_0.15s_ease] select-none pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-8">
      <div className="hidden md:block">
        <ScheduleHeader onBack={onBack} scheduleName={scheduleName} onOpenSettings={() => setShowSettings(true)} onOpenSwitcher={onOpenSwitcher} onExport={() => setShowExportSheet(true)} exporting={pdfExport.isExporting} />
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
          onOpenSwitcher={onOpenSwitcher}
          onViewChange={setViewMode}
          onAddClass={() => setShowFabSheet(true)}
          dashboardShell={dashboardShell}
        />
      )}

      <ActionSheet open={showMobileActions} title="Acciones del horario" options={mobileActionOptions} onClose={() => setShowMobileActions(false)} compact />
      <ActionSheet open={showFabSheet} title="Añadir clase" options={fabOptions} onClose={() => setShowFabSheet(false)} compact />
      <ActionSheet open={showExportSheet} title="Exportar horario" options={exportOptions} onClose={() => setShowExportSheet(false)} compact />

      <DayPickerModal open={showDayPicker} daysCount={daysCount} onSelectDay={(index) => { setSelectedDayForForm(index); setShowDayPicker(false); window.setTimeout(() => setShowClassForm(true), 180); }} onClose={() => setShowDayPicker(false)} />

      {showClassForm && <ClassFormModal
        key={editingClass?.id || 'new'}
        selectedDay={selectedDayForForm}
        onClose={handleCloseClassForm}
        onSave={(data) => handleSaveClass(data, editingClass?.id)}
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
      />}

      {selectedClassDetail && <ClassDetailModal selectedClass={selectedClassDetail} subjectColors={subjectColors} error={detailError} onClose={() => setSelectedClassDetail(null)} onDelete={handleDeleteClass} onUpdateAttendance={handleUpdateAttendance} onEdit={handleEditClassClick} updatingAttendance={updatingAttendance} />}

      {showSettings && <ScheduleSettingsModal scheduleName={scheduleName} daysCount={daysCount} classes={classes} onSave={handleUpdateSettings} saving={savingSettings} onClose={() => setShowSettings(false)} />}

      <PdfExportOverlay isOpen={pdfExport.isExporting} progress={pdfExport.progress} onCancel={pdfExport.cancel} title="Generando horario" itemLabel="páginas" />
    </div>
  );
}

export { SHORT_WEEKDAYS };
