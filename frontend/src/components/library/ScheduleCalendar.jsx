// FILE: frontend/src/components/library/ScheduleCalendar.jsx
import { useState } from 'react';
import { Plus, Calendar } from 'lucide-react';
import { useScheduleCalendar, WEEKDAYS } from './calendar/useScheduleCalendar';
import ScheduleHeader from './calendar/ScheduleHeader';
import DayTabs from './calendar/DayTabs';
import ClassList from './calendar/ClassList';
import CalendarFAB from './calendar/CalendarFAB';
import ActionSheet from '../common/ActionSheet';

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

  // Estado para el Action Sheet del FAB
  const [showFabSheet, setShowFabSheet] = useState(false);

  if (loading) {
    return (
      <div className="w-full max-w-2xl mx-auto py-20 text-center text-sm text-slate-400">
        Cargando horario...
      </div>
    );
  }

  const isAnyModalOpen = showSettings || showDayPicker || showClassForm || !!selectedClassDetail || showFabSheet;

  // Handlers para garantizar un cierre limpio del FabSheet antes de abrir la siguiente vista
  const handleSelectAddCurrentDay = () => {
    setShowFabSheet(false);
    setTimeout(() => {
      setSelectedDayForForm(activeDayIndex);
      setShowClassForm(true);
    }, 0);
  };

  const handleSelectPickOtherDay = () => {
    setShowFabSheet(false);
    setTimeout(() => {
      setShowDayPicker(true);
    }, 0);
  };

  // Opciones para el ActionSheet reutilizable
  const fabOptions = [
    {
      id: 'add-current-day',
      label: `Añadir a ${WEEKDAYS[activeDayIndex] || `Día ${activeDayIndex + 1}`}`,
      description: 'Crear una nueva clase en el día seleccionado',
      icon: Plus,
      onSelect: handleSelectAddCurrentDay,
    },
    {
      id: 'pick-other-day',
      label: 'Elegir otro día...',
      description: 'Seleccionar un día distinto del calendario',
      icon: Calendar,
      onSelect: handleSelectPickOtherDay,
    },
  ];

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

      {/* FAB */}
      {!isAnyModalOpen && (
        <CalendarFAB 
          onClick={() => setShowFabSheet(true)} 
          dashboardShell={dashboardShell} 
        />
      )}

      {/* COMPONENTE REUTILIZABLE ACTION SHEET */}
      <ActionSheet 
        open={showFabSheet}
        title="Acciones del Horario"
        options={fabOptions}
        onClose={() => setShowFabSheet(false)}
      />

      {/* MODALES */}
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

      {showClassForm && (
        <ClassFormModal 
          key={editingClass?.id || 'new'}
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
