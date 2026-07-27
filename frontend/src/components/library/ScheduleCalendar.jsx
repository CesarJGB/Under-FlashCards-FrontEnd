// FILE: frontend/src/components/library/ScheduleCalendar.jsx
import { useScheduleCalendar } from './calendar/useScheduleCalendar';
import ScheduleHeader from './calendar/ScheduleHeader';
import DayTabs from './calendar/DayTabs';
import ClassList from './calendar/ClassList';
import CalendarFAB from './calendar/CalendarFAB';

import DayPickerModal from './calendar/modals/DayPickerModal';
import ClassFormModal from './calendar/modals/ClassFormModal';
import ClassDetailModal from './calendar/modals/ClassDetailModal';
import ScheduleSettingsModal from './calendar/modals/ScheduleSettingsModal';

export default function ScheduleCalendar({ 
  userId, 
  scheduleId, 
  onBack, 
  dashboardShell, 
  onOpenSwitcher 
}) {
  const {
    loading,
    error,
    scheduleName,
    daysCount,
    classes,
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
  } = useScheduleCalendar(userId, scheduleId);

  if (loading) {
    return (
      <div className="w-full max-w-2xl mx-auto py-20 text-center text-sm text-slate-400">
        Cargando horario...
      </div>
    );
  }

  // MEJORA 1: Determinar si hay algún modal/acción activa para ocultar el FAB
  const isAnyModalOpen = showSettings || showDayPicker || showClassForm || !!selectedClassDetail;

  return (
    <div className="w-full max-w-2xl mx-auto pb-20 animate-[fadeIn_0.15s_ease] select-none relative">
      <ScheduleHeader 
        onBack={onBack} 
        scheduleName={scheduleName} 
        onOpenSettings={() => setShowSettings(true)} 
        onOpenSwitcher={onOpenSwitcher}
      />

      {error && (
        <div className="mx-2 mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-xs font-medium text-red-700">
          {error}
        </div>
      )}

      <DayTabs 
        daysCount={daysCount} 
        activeDayIndex={activeDayIndex} 
        setActiveDayIndex={setActiveDayIndex} 
        classes={classes} 
      />

      <ClassList 
        currentDayClasses={currentDayClasses} 
        onSelectClass={setSelectedClassDetail} 
      />

      {/* MEJORA 1: El FAB solo se renderiza si no hay modales abiertos */}
      {!isAnyModalOpen && (
        <CalendarFAB 
          onClick={() => setShowDayPicker(true)} 
          dashboardShell={dashboardShell} 
        />
      )}

      {/* RENDERIZADO SIEMPRE ACTIVO:
          Pasamos la prop 'open' para permitir que el ActionSheet / Modal
          ejecute la animación de cierre adecuadamente. */}
      <DayPickerModal 
        open={showDayPicker}
        daysCount={daysCount}
        onSelectDay={(idx) => {
          setSelectedDayForForm(idx);
          setShowDayPicker(false);
          setShowClassForm(true);
        }}
        onClose={() => setShowDayPicker(false)}
      />

      {/* 
        NOTA LÓGICA: Si quieres que este modal también tenga animación de salida 
        como el DayPicker, deberías cambiarlo a <ClassFormModal open={showClassForm} ... />
      */}
      {showClassForm && (
        <ClassFormModal 
          key={editingClass?.id || 'new'} // Forzar re-instanciación al cambiar la clase seleccionada
          selectedDay={selectedDayForForm}
          onClose={handleCloseClassForm}
          onSave={(data) => handleSaveClass(data, editingClass?.id)}
          initialSubject={editingClass?.subject || ''}
          initialTeacher={editingClass?.teacher || ''}
          initialRoom={editingClass?.room || ''}
          initialStartTime={editingClass?.startTime || '08:00'}
          initialEndTime={editingClass?.endTime || '09:30'}
          existingClasses={classes}
        />
      )}

      {/* 
        NOTA LÓGICA: Mismo caso aquí, idealmente pasar a <ClassDetailModal open={!!selectedClassDetail} ... />
      */}
      {selectedClassDetail && (
        <ClassDetailModal 
          selectedClass={selectedClassDetail}
          onClose={() => setSelectedClassDetail(null)}
          onDelete={handleDeleteClass}
          onUpdateAttendance={handleUpdateAttendance}
          onEdit={handleEditClassClick}
        />
      )}

      {showSettings && (
        <ScheduleSettingsModal 
          scheduleName={scheduleName}
          daysCount={daysCount}
          classes={classes}
          onSave={handleUpdateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
