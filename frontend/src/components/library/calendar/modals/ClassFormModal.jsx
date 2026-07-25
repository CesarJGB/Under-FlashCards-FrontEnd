// FILE: frontend/src/components/library/calendar/modals/ClassFormModal.jsx
import { useMemo, useRef, useState } from 'react';
import { X, MapPin } from 'lucide-react';

export default function ClassFormModal({
  onClose, onSubmit,
  formSubject, setFormSubject,
  formTeacher, setFormTeacher,
  formRoom, setFormRoom,
  formStartTime, setFormStartTime,
  formEndTime, setFormEndTime,
  existingClasses = [],
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [roomSuggestion, setRoomSuggestion] = useState('');
  const blurTimeoutRef = useRef(null);

  // Una entrada por asignatura (sin duplicar). Si la misma asignatura aparece
  // varias veces en el horario, nos quedamos con la última para sugerir profesor/aula.
  const uniqueSubjects = useMemo(() => {
    const map = new Map();
    for (const c of existingClasses) {
      if (!c.subject) continue;
      map.set(c.subject.trim().toLowerCase(), c);
    }
    return Array.from(map.values()).sort((a, b) => a.subject.localeCompare(b.subject));
  }, [existingClasses]);

  const filteredSubjects = useMemo(() => {
    const query = formSubject.trim().toLowerCase();
    if (!query) return uniqueSubjects;
    return uniqueSubjects.filter((c) => c.subject.toLowerCase().includes(query));
  }, [uniqueSubjects, formSubject]);

  const handleSubjectChange = (value) => {
    setFormSubject(value);
    setRoomSuggestion(''); // el usuario está escribiendo algo nuevo, ya no aplica la sugerencia previa
  };

  const handleSelectExisting = (classItem) => {
    setFormSubject(classItem.subject);
    setFormTeacher(classItem.teacher || '');
    setRoomSuggestion(classItem.room || '');
    setShowPicker(false);
  };

  const handleUseRoomSuggestion = () => {
    setFormRoom(roomSuggestion);
    setRoomSuggestion('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-[fadeIn_0.15s_ease]">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl">
        <div className="flex justify-end -mt-1 -mr-1 mb-1">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-7">
          <div className="relative">
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">
              Asignatura
            </label>
            <input
              type="text"
              required
              placeholder="Ej. Inglés"
              value={formSubject}
              onChange={(e) => handleSubjectChange(e.target.value)}
              onFocus={() => setShowPicker(true)}
              onBlur={() => {
                blurTimeoutRef.current = setTimeout(() => setShowPicker(false), 150);
              }}
              autoComplete="off"
              className="w-full text-3xl font-extrabold text-slate-900 placeholder-slate-300 bg-transparent border-b-2 border-transparent focus:outline-none focus:border-slate-900 pb-1 transition-colors"
            />

            {showPicker && filteredSubjects.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {filteredSubjects.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()} // evita que el blur cierre la lista antes del click
                    onClick={() => handleSelectExisting(c)}
                    className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left hover:bg-slate-50 cursor-pointer"
                  >
                    <span className="text-sm font-semibold text-slate-800 truncate">{c.subject}</span>
                    {c.teacher && (
                      <span className="text-xs font-medium text-slate-400 shrink-0">{c.teacher}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">
              Profesor
            </label>
            <input
              type="text"
              placeholder="Ej. Juan García"
              value={formTeacher}
              onChange={(e) => setFormTeacher(e.target.value)}
              className="w-full text-2xl font-extrabold text-slate-900 placeholder-slate-300 bg-transparent border-b-2 border-transparent focus:outline-none focus:border-slate-900 pb-1 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">
              Aula
            </label>
            <input
              type="text"
              placeholder="Ej. 201A"
              value={formRoom}
              onChange={(e) => { setFormRoom(e.target.value); setRoomSuggestion(''); }}
              className="w-full text-2xl font-extrabold text-slate-900 placeholder-slate-300 bg-transparent border-b-2 border-transparent focus:outline-none focus:border-slate-900 pb-1 transition-colors"
            />
            {roomSuggestion && (
              <button
                type="button"
                onClick={handleUseRoomSuggestion}
                className="mt-2 flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <MapPin className="w-3 h-3" />
                ¿Usar {roomSuggestion}?
              </button>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">
              Horario
            </label>
            <div className="flex items-center gap-3">
              <input
                type="time"
                value={formStartTime}
                onChange={(e) => setFormStartTime(e.target.value)}
                className="text-2xl font-extrabold text-slate-900 bg-transparent border-b-2 border-transparent focus:outline-none focus:border-slate-900 pb-1 transition-colors"
              />
              <span className="text-2xl font-extrabold text-slate-300">–</span>
              <input
                type="time"
                value={formEndTime}
                onChange={(e) => setFormEndTime(e.target.value)}
                className="text-2xl font-extrabold text-slate-900 bg-transparent border-b-2 border-transparent focus:outline-none focus:border-slate-900 pb-1 transition-colors"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
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
  );
}
