// FILE: frontend/src/components/library/ScheduleCalendar.jsx
import { useState, useEffect } from 'react';
import { 
  ArrowLeft, Plus, Settings, Clock, User, MapPin, 
  X, Trash2, Check, ChevronRight, Minus, BookOpen
} from 'lucide-react';

const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const SHORT_WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function ScheduleCalendar({ onBack }) {
  // --- ESTADOS PRINCIPALES ---
  const [scheduleName, setScheduleName] = useState(() => {
    return localStorage.getItem('schedule_name') || 'Horario Principal';
  });
  const [daysCount, setDaysCount] = useState(() => {
    return parseInt(localStorage.getItem('schedule_days') || '5', 10);
  });
  const [classes, setClasses] = useState(() => {
    const saved = localStorage.getItem('schedule_classes');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeDayIndex, setActiveDayIndex] = useState(0);

  // --- ESTADOS DE MODALES ---
  const [showSettings, setShowSettings] = useState(false);
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [showClassForm, setShowClassForm] = useState(false);
  const [selectedDayForForm, setSelectedDayForForm] = useState(0);
  const [selectedClassDetail, setSelectedClassDetail] = useState(null);

  // --- FORMULARIO DE ASIGNATURA ---
  const [formSubject, setFormSubject] = useState('');
  const [formTeacher, setFormTeacher] = useState('');
  const [formRoom, setFormRoom] = useState('');
  const [formStartTime, setFormStartTime] = useState('08:00');
  const [formEndTime, setFormEndTime] = useState('09:30');

  // Guardar cambios en localStorage
  useEffect(() => {
    localStorage.setItem('schedule_name', scheduleName);
    localStorage.setItem('schedule_days', daysCount.toString());
    localStorage.setItem('schedule_classes', JSON.stringify(classes));
  }, [scheduleName, daysCount, classes]);

  // Manejar creación de clase
  const handleSaveClass = (e) => {
    e.preventDefault();
    if (!formSubject.trim()) return;

    const newClass = {
      id: Date.now().toString(),
      dayIndex: selectedDayForForm,
      subject: formSubject.trim(),
      teacher: formTeacher.trim() || 'Sin profesor',
      room: formRoom.trim() || 'Por definir',
      startTime: formStartTime,
      endTime: formEndTime,
      // Contadores de asistencia (Captura 1)
      attendances: 0,
      absences: 0,
      partialAttendances: 0,
      canceledClasses: 0,
    };

    setClasses((prev) => [...prev, newClass]);
    // Limpiar formulario y cerrar
    setFormSubject('');
    setFormTeacher('');
    setFormRoom('');
    setFormStartTime('08:00');
    setFormEndTime('09:30');
    setShowClassForm(false);
  };

  // Manejar eliminación de clase
  const handleDeleteClass = (id) => {
    setClasses((prev) => prev.filter((c) => c.id !== id));
    setSelectedClassDetail(null);
  };

  // Actualizar estadísticas de asistencia
  const handleUpdateAttendance = (classId, field, delta) => {
    setClasses((prev) =>
      prev.map((item) => {
        if (item.id === classId) {
          const currentVal = item[field] || 0;
          const nextVal = Math.max(0, currentVal + delta);
          const updated = { ...item, [field]: nextVal };
          if (selectedClassDetail?.id === classId) {
            setSelectedClassDetail(updated);
          }
          return updated;
        }
        return item;
      })
    );
  };

  // Filtrar clases del día seleccionado
  const currentDayClasses = classes
    .filter((c) => c.dayIndex === activeDayIndex)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div className="w-full max-w-2xl mx-auto pb-20 animate-[fadeIn_0.15s_ease] select-none">
      
      {/* 1. CABECERA Y NAVEGACIÓN GENERAL */}
      <div className="flex items-center justify-between py-3 border-b border-slate-200/80 mb-4 px-2">
        <button
          type="button"
          onClick={onBack}
          className="p-2 -ml-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          General
        </button>

        <button
          type="button"
          onClick={() => setShowSettings(true)}
          className="flex items-center gap-1.5 text-base font-extrabold text-slate-900 hover:opacity-80 transition-opacity cursor-pointer"
        >
          <span>{scheduleName}</span>
          <ChevronRight className="w-4 h-4 text-slate-400 rotate-90" />
        </button>

        <button
          type="button"
          onClick={() => setShowSettings(true)}
          className="p-2 -mr-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          title="Ajustes de horario"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* 2. PESTAÑAS DE DÍAS (Lun, Mar, Mié...) */}
      <div className="flex items-center justify-between bg-slate-100/80 p-1 rounded-2xl mb-6">
        {SHORT_WEEKDAYS.slice(0, daysCount).map((dayName, idx) => {
          const isActive = activeDayIndex === idx;
          const hasClasses = classes.some((c) => c.dayIndex === idx);

          return (
            <button
              key={dayName}
              type="button"
              onClick={() => setActiveDayIndex(idx)}
              className={`relative flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                isActive
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{dayName}</span>
              {hasClasses && (
                <span
                  className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${
                    isActive ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* 3. LISTA DE CLASES DEL DÍA ACTIVO */}
      <div className="space-y-3 min-h-[250px]">
        {currentDayClasses.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-200 rounded-3xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
              <BookOpen className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm font-bold text-slate-700">Sin clases agregadas</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Presiona el botón "+" abajo a la derecha para añadir una asignatura a tu horario.
            </p>
          </div>
        ) : (
          currentDayClasses.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedClassDetail(item)}
              className="w-full text-left bg-white border border-slate-200/90 rounded-2xl p-4 shadow-3xs hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer flex items-center justify-between"
            >
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-100 text-[11px] font-bold text-slate-700">
                  <Clock className="w-3 h-3 text-slate-400" />
                  {item.startTime} - {item.endTime}
                </div>
                <h3 className="text-base font-extrabold text-slate-900">{item.subject}</h3>
                <div className="flex items-center gap-3 text-xs font-medium text-slate-500">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    {item.teacher}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {item.room}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300" />
            </button>
          ))
        )}
      </div>

      {/* 4. BOTÓN FLOTANTE (+) */}
      <button
        type="button"
        onClick={() => setShowDayPicker(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-blue-500 hover:bg-blue-600 active:scale-95 text-white shadow-lg shadow-blue-500/30 flex items-center justify-center transition-all cursor-pointer z-30"
      >
        <Plus className="w-7 h-7 stroke-[2.5]" />
      </button>

      {/* ========================================================================= */}
      /* MODAL 1: ELEGIR DÍA (Captura 2) */
      /* ========================================================================= */}
      {showDayPicker && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 animate-[fadeIn_0.15s_ease]">
          <div className="w-full max-w-sm bg-slate-100/95 rounded-3xl p-5 shadow-2xl space-y-2 border border-white/40">
            <h3 className="text-center text-base font-extrabold text-slate-900 py-1">
              ¿Qué día?
            </h3>
            <div className="space-y-2">
              {WEEKDAYS.slice(0, daysCount).map((dayName, idx) => (
                <button
                  key={dayName}
                  type="button"
                  onClick={() => {
                    setSelectedDayForForm(idx);
                    setShowDayPicker(false);
                    setShowClassForm(true);
                  }}
                  className="w-full py-3.5 bg-slate-200/80 hover:bg-slate-300/80 active:scale-[0.99] rounded-2xl text-sm font-extrabold text-slate-900 transition-all cursor-pointer"
                >
                  {dayName}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowDayPicker(false)}
                className="w-full py-3.5 bg-white hover:bg-slate-50 rounded-2xl text-sm font-extrabold text-slate-800 transition-all cursor-pointer mt-2"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      /* MODAL 2: CREAR ASIGNATURA */
      /* ========================================================================= */}
      {showClassForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-[fadeIn_0.15s_ease]">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Nueva Asignatura</h3>
                <p className="text-xs font-medium text-slate-400">
                  Añadir clase para el {WEEKDAYS[selectedDayForForm]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowClassForm(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveClass} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Asignatura *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Inglés, Matemáticas..."
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Profesor
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Juan García"
                    value={formTeacher}
                    onChange={(e) => setFormTeacher(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Aula
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. 201A, Edificio B"
                    value={formRoom}
                    onChange={(e) => setFormRoom(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Hora inicio
                  </label>
                  <input
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Hora fin
                  </label>
                  <input
                    type="time"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowClassForm(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 rounded-xl text-xs font-bold text-white cursor-pointer"
                >
                  Guardar Clase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      /* MODAL 3: DETALLE DE CLASE Y REGISTRO DE ASISTENCIA (Captura 1) */
      /* ========================================================================= */}
      {selectedClassDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end justify-center animate-[fadeIn_0.15s_ease]">
          <div className="w-full max-w-lg bg-slate-900 text-white rounded-t-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            
            {/* Header Oscuro */}
            <div className="p-6 pb-8 space-y-6 relative">
              <button
                type="button"
                onClick={() => setSelectedClassDetail(null)}
                className="absolute top-4 left-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="text-center pt-2">
                <span className="text-sm font-bold text-slate-300">
                  {WEEKDAYS[selectedClassDetail.dayIndex]} ▼
                </span>
                <div className="mt-1 inline-block bg-slate-800/80 px-3 py-1 rounded-full text-xs font-extrabold tracking-wider">
                  {selectedClassDetail.startTime} - {selectedClassDetail.endTime}
                </div>
              </div>

              <div className="space-y-4 px-2">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Asignatura
                  </p>
                  <p className="text-3xl font-black tracking-tight mt-0.5">
                    {selectedClassDetail.subject}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Profesor
                  </p>
                  <p className="text-xl font-bold text-slate-200 mt-0.5">
                    {selectedClassDetail.teacher}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Aula
                  </p>
                  <p className="text-xl font-bold text-slate-200 mt-0.5">
                    {selectedClassDetail.room}
                  </p>
                </div>
              </div>
            </div>

            {/* Hoja Inferior Blanca con Registro de Asistencias */}
            <div className="bg-white text-slate-900 rounded-t-3xl p-6 flex-1 space-y-6">
              <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto" />

              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center">
                Registro de asistencia
              </h4>

              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { key: 'attendances', label: 'Asistencias' },
                  { key: 'absences', label: 'Ausencias' },
                  { key: 'partialAttendances', label: 'Asistencias parciales' },
                  { key: 'canceledClasses', label: 'Clase anulada' },
                ].map((item) => (
                  <div key={item.key} className="flex flex-col items-center gap-1.5">
                    <div className="w-14 h-14 rounded-full border border-slate-200 flex items-center justify-center text-lg font-bold text-slate-800 bg-slate-50">
                      {selectedClassDetail[item.key] || 0}
                    </div>
                    <span className="text-[10px] font-medium text-slate-500 leading-tight">
                      {item.label}
                    </span>
                    <div className="flex gap-1 mt-1">
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateAttendance(selectedClassDetail.id, item.key, -1)
                        }
                        className="w-5 h-5 rounded-md bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 text-xs font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateAttendance(selectedClassDetail.id, item.key, 1)
                        }
                        className="w-5 h-5 rounded-md bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 text-xs font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => handleDeleteClass(selectedClassDetail.id)}
                  className="px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedClassDetail(null)}
                  className="px-5 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  Listo
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      /* MODAL 4: AJUSTES DE HORARIO (Captura 4) */
      /* ========================================================================= */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-[fadeIn_0.15s_ease]">
          <div className="w-full max-w-sm bg-slate-100 rounded-3xl p-5 shadow-2xl space-y-4">
            
            <div className="flex items-center justify-between pb-2">
              <h3 className="text-base font-extrabold text-slate-900">Ajustes</h3>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center text-white cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[3]" />
              </button>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide px-1">
                Horario
              </p>
              
              <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden">
                {/* Nombre */}
                <div className="p-3.5 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Nombre del horario
                  </span>
                  <input
                    type="text"
                    value={scheduleName}
                    onChange={(e) => setScheduleName(e.target.value)}
                    className="text-xs font-medium text-slate-500 text-right bg-transparent focus:outline-none focus:text-slate-900 max-w-[130px]"
                  />
                </div>

                {/* Número de Días */}
                <div className="p-3.5 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Días</span>
                    <span className="text-[11px] font-medium text-slate-400">{daysCount} días</span>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      disabled={daysCount <= 5}
                      onClick={() => setDaysCount((prev) => Math.max(5, prev - 1))}
                      className="p-1 rounded-lg hover:bg-white disabled:opacity-30 cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5 text-slate-700" />
                    </button>
                    <button
                      type="button"
                      disabled={daysCount >= 7}
                      onClick={() => setDaysCount((prev) => Math.min(7, prev + 1))}
                      className="p-1 rounded-lg hover:bg-white disabled:opacity-30 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-slate-700" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
