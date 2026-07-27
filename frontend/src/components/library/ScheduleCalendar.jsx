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

  // 1. ESTADO renombrado para el Action Sheet
  const [showFabSheet, setShowFabSheet] = useState(false);

  if (loading) {
    return (
      <div className="w-full max-w-2xl mx-auto py-20 text-center text-sm text-slate-400">
        Cargando horario...
      </div>
    );
  }

  // 2. Incluimos showFabSheet para ocultar el FAB si el Action Sheet está desplegado
  const isAnyModalOpen = showSettings || showDayPicker || showClassForm || !!selectedClassDetail || showFabSheet;

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

      {/* BLOQUE DEL FAB SIMPLIFICADO */}
      {!isAnyModalOpen && (
        <CalendarFAB 
          onClick={() => setShowFabSheet(true)} 
          dashboardShell={dashboardShell} 
        />
      )}

      {/* ACTION SHEET DEL FAB INTELIGENTE */}
      {showFabSheet && (
        <div 
          className="fixed inset-0 z-40 bg-black/30 flex justify-center animate-[fadeIn_0.15s_ease]"
          onClick={() => setShowFabSheet(false)}
        >
          <div 
            className="absolute bottom-0 left-0 right-0 max-w-2xl mx-auto bg-white rounded-t-3xl p-4 pb-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handlebar superior estilo iOS/Android */}
            <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto mb-4" />
            
            <button 
              className="w-full text-left px-4 py-3.5 text-base font-semibold text-blue-600 active:bg-slate-50 rounded-xl mb-1 transition-colors"
              onClick={() => {
                setSelectedDayForForm(activeDayIndex);
                setShowClassForm(true);
                setShowFabSheet(false);
              }}
            >
              + Añadir a {WEEKDAYS[activeDayIndex] || `Día ${activeDayIndex + 1}`}
            </button>
            
            <button 
              className="w-full text-left px-4 py-3.5 text-base text-slate-700 active:bg-slate-50 rounded-xl border-t border-slate-100 transition-colors"
              onClick={() => {
                setShowDayPicker(true);
                setShowFabSheet(false);
              }}
            >
              Elegir otro día...
            </button>
            
            <button 
              className="w-full text-left px-4 py-3.5 text-base font-medium text-red-500 active:bg-slate-50 rounded-xl border-t border-slate-100 mt-2 transition-colors"
              onClick={() => setShowFabSheet(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* MODALES EXISTENTES */}
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
