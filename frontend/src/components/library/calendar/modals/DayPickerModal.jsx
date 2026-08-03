// FILE: frontend/src/components/library/calendar/modals/DayPickerModal.jsx
import ActionSheet from '../../../common/ActionSheet';
import { WEEKDAYS } from '../useScheduleCalendar';
import { CalendarDays } from 'lucide-react';

export default function DayPickerModal({ daysCount, onSelectDay, onClose, open = true }) {
  // Convertimos la lista de días al formato de opciones que requiere ActionSheet
  const dayOptions = WEEKDAYS.slice(0, daysCount).map((dayName, idx) => ({
    id: `day-${idx}`,
    label: dayName,
    icon: CalendarDays,
    onSelect: () => onSelectDay(idx),
  }));

  return (
    <ActionSheet
      open={open}
      title="¿Qué día?"
    options={dayOptions}
    onClose={onClose}
    compact
  />
  );
}
