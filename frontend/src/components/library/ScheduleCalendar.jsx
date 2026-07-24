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

export default function ScheduleCalendar({ onBack, dashboardShell }) {
  const {
    scheduleName, setScheduleName,
    daysCount, setDaysCount,
    classes,
    activeDayIndex, setActiveDayIndex,
    currentDayClasses,
    showSettings, setShowSettings,
    showDayPicker, setShowDayPicker,
    showClassForm, setShowClassForm,
    selectedDayForForm, setSelectedDayForForm,
    selectedClassDetail, setSelectedClassDetail,
    formSubject, setFormSubject,
    formTeacher, setFormTeacher,
    formRoom, setFormRoom,
    formStartTime, setFormStartTime,
    formEndTime, setFormEndTime,
    handleSaveClass,
    handleDeleteClass,
    handleUpdateAttendance
  } = useScheduleCalendar();

  return (
    <div className="w-full max-w-2xl mx-auto pb-20 animate-[fadeIn_0.15s_ease] select-none">
      <ScheduleHeader 
        onBack={onBack} 
        scheduleName={scheduleName} 
        onOpenSettings={() => setShowSettings(true)} 
      />

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

      <CalendarFAB 
        onClick={() => setShowDayPicker(true)} 
        dashboardShell={dashboardShell} 
      />

      {showDayPicker && (
        <DayPickerModal 
          daysCount={daysCount}
          onSelectDay={(idx) => {
            setSelectedDayForForm(idx);
            setShowDayPicker(false);
            setShowClassForm(true);
          }}
          onClose={() => setShowDayPicker(false)}
        />
      )}

      {showClassForm && (
        <ClassFormModal 
          selectedDay={selectedDayForForm}
          onClose={() => setShowClassForm(false)}
          onSubmit={handleSaveClass}
          formSubject={formSubject} setFormSubject={setFormSubject}
          formTeacher={formTeacher} setFormTeacher={setFormTeacher}
          formRoom={formRoom} setFormRoom={setFormRoom}
          formStartTime={formStartTime} setFormStartTime={setFormStartTime}
          formEndTime={formEndTime} setFormEndTime={setFormEndTime}
        />
      )}

      {selectedClassDetail && (
        <ClassDetailModal 
          selectedClass={selectedClassDetail}
          onClose={() => setSelectedClassDetail(null)}
          onDelete={handleDeleteClass}
          onUpdateAttendance={handleUpdateAttendance}
        />
      )}

      {showSettings && (
        <ScheduleSettingsModal 
          scheduleName={scheduleName} setScheduleName={setScheduleName}
          daysCount={daysCount} setDaysCount={setDaysCount}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
