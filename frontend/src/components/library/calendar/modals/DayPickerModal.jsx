// FILE: frontend/src/components/library/calendar/modals/DayPickerModal.jsx
import ActionSheet from '../../ActionSheet'; // Ajusta la ruta relativa según la estructura de tu proyecto
import { WEEKDAYS } from '../useScheduleCalendar';
import { CalendarDays } from 'lucide-react';

export default function DayPickerModal({ daysCount, onSelectDay, onClose, open = true }) {
  // Convertimos la lista de días al formato de opciones que requiere ActionSheet
  const dayOptions = WEEKDAYS.slice(0, daysCount).map((dayName, idx) => ({
    id: `day-${idx}`,
    label: dayName,
    description: `Seleccionar ${dayName.toLowerCase()} para agendar`,
    icon: CalendarDays,
    onSelect: () => onSelectDay(idx),
  }));

  return (
    <ActionSheet
      open={open}
      title="¿Qué día?"
      options={dayOptions}
      onClose={onClose}
    />
  );
}
