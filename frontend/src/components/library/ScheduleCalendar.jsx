// FILE: frontend/src/components/library/ScheduleCalendar.jsx
import { useState } from 'react';
import { useScheduleCalendar, WEEKDAYS } from './calendar/useScheduleCalendar';
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

  // ESTADO para el mini-menú del FAB
  const [showFabMenu, setShowFabMenu] = useState(false);

  if (loading) {
    return (
      <div className="w-full max-w-2xl mx-auto py-20 text-center text-sm text-slate-400">
        Cargando horario...
      </div>
    );
  }

  // Determinar si hay algún modal/acción activa para ocultar el FAB
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

      {/* BLOQUE DEL FAB INTELIGENTE CON MINI-MENÚ */}
      {!isAnyModalOpen && (
        <>
          {/* Overlay invisible para cerrar el menú si se toca fuera */}
          {showFabMenu && (
            <div 
              className="fixed inset-0 z-30" 
              onClick={() => setShowFabMenu(false)} 
            />
          )}

          {/* Mini-menú de opciones rápidas */}
          {showFabMenu && (
            <div className="fixed bottom-24 right-4 md:right-8 z-40 w-48 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden animate-[fadeIn_0.1s_ease]">
              <button 
                className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors"
                onClick={() => {
                  setSelectedDayForForm(activeDayIndex);
                  setShowClassForm(true);
                  setShowFabMenu(false);
                }}
              >
                + Añadir a {WEEKDAYS[activeDayIndex] || `Día ${activeDayIndex + 1}`}
              </button>
              <button 
                className="w-full text-left px-4 py-3 text-sm text-slate-500 hover:bg-slate-50 active:bg-slate-100 border-t border-slate-100 transition-colors"
                onClick={() => {
                  setShowDayPicker(true);
                  setShowFabMenu(false);
                }}
              >
                Elegir otro día...
              </button>
            </div>
          )}

          <CalendarFAB 
            onClick={() => setShowFabMenu((prev) => !prev)} 
            dashboardShell={dashboardShell} 
          />
        </>
      )}

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
