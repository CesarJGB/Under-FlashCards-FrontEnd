// FILE: frontend/src/components/library/calendar/modals/ClassFormModal.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { X, ChevronRight, MapPin } from 'lucide-react';

// Bloquea el scroll del body mientras el modal está montado
function useLockBodyScroll() {
  useEffect(() => {
    const scrollY = window.scrollY;
    const body = document.body;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    };

    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';

    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      window.scrollTo(0, scrollY);
    };
  }, []);
}

export default function ClassFormModal({
  onClose,
  onSave, // Reemplaza a onSubmit
  initialSubject = '',
  initialTeacher = '',
  initialRoom = '',
  initialStartTime = '08:00',
  initialEndTime = '09:30',
  existingClasses = [],
}) {
  useLockBodyScroll();

  // El estado de escritura vive ahora dentro del propio modal
  const [formSubject, setFormSubject] = useState(initialSubject);
  const [formTeacher, setFormTeacher] = useState(initialTeacher);
  const [formRoom, setFormRoom] = useState(initialRoom);
  const [formStartTime, setFormStartTime] = useState(initialStartTime);
  const [formEndTime, setFormEndTime] = useState(initialEndTime);

  // Estado para mensajes de validación
  const [formError, setFormError] = useState('');

  // null | 'subject' | 'teacher' | 'room' | 'combined'
  const [activeScreen, setActiveScreen] = useState(null);

  // Borrador para la pantalla de los 3 campos juntos
  const [combinedDraft, setCombinedDraft] = useState({
    subject: '',
    teacher: '',
    room: '',
    roomSuggestion: '',
  });

  const subjectInputRef = useRef(null);
  const teacherInputRef = useRef(null);
  const roomInputRef = useRef(null);

  useEffect(() => {
    const refs = { subject: subjectInputRef, teacher: teacherInputRef, room: roomInputRef };
    const target = refs[activeScreen]?.current;
    if (target) {
      const t = setTimeout(() => target.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [activeScreen]);

  // --- Materias ya usadas ---
  const uniqueSubjects = useMemo(() => {
    const map = new Map();
    for (const c of existingClasses) {
      if (!c.subject) continue;
      map.set(c.subject.trim().toLowerCase(), c);
    }
    return Array.from(map.values()).sort((a, b) => a.subject.localeCompare(b.subject));
  }, [existingClasses]);

  const subjectItems = useMemo(() => {
    const query = formSubject.trim().toLowerCase();
    const list = query
      ? uniqueSubjects.filter((c) => c.subject.toLowerCase().includes(query))
      : uniqueSubjects;
    return list.map((c) => ({ key: c.id, primary: c.subject, secondary: c.teacher, raw: c }));
  }, [uniqueSubjects, formSubject]);

  // --- Profesores ya usados ---
  const uniqueTeachers = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const c of existingClasses) {
      const t = c.teacher?.trim();
      if (!t || seen.has(t.toLowerCase())) continue;
      seen.add(t.toLowerCase());
      list.push(t);
    }
    return list.sort((a, b) => a.localeCompare(b));
  }, [existingClasses]);

  const teacherItems = useMemo(() => {
    const query = formTeacher.trim().toLowerCase();
    const list = query
      ? uniqueTeachers.filter((t) => t.toLowerCase().includes(query))
      : uniqueTeachers;
    return list.map((t) => ({ key: t, primary: t }));
  }, [uniqueTeachers, formTeacher]);

  // --- Aulas ya usadas ---
  const uniqueRooms = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const c of existingClasses) {
      const r = c.room?.trim();
      if (!r || seen.has(r.toLowerCase())) continue;
      seen.add(r.toLowerCase());
      list.push(r);
    }
    return list.sort((a, b) => a.localeCompare(b));
  }, [existingClasses]);

  const roomItems = useMemo(() => {
    const query = formRoom.trim().toLowerCase();
    const list = query
      ? uniqueRooms.filter((r) => r.toLowerCase().includes(query))
      : uniqueRooms;
    return list.map((r) => ({ key: r, primary: r }));
  }, [uniqueRooms, formRoom]);

  const handleSelectSubject = (classItem) => {
    setCombinedDraft({
      subject: classItem.subject,
      teacher: classItem.teacher || '',
      room: formRoom,
      roomSuggestion: classItem.room || '',
    });
    setActiveScreen('combined');
  };

  const handleCancelCombined = () => {
    setActiveScreen(null);
  };

  const handleSaveCombined = () => {
    setFormSubject(combinedDraft.subject);
    setFormTeacher(combinedDraft.teacher);
    setFormRoom(combinedDraft.room);
    setFormError('');
    setActiveScreen(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');

    // 5b: Avisar cuando Asignatura está vacía
    if (!formSubject.trim()) {
      setFormError('Por favor, ingresa el nombre de la asignatura.');
      return;
    }

    // 5a: Validar que la hora de fin sea posterior a la de inicio
    if (formEndTime <= formStartTime) {
      setFormError('La hora de fin debe ser posterior a la hora de inicio.');
      return;
    }

    onSave({
      subject: formSubject.trim(),
      teacher: formTeacher.trim(),
      room: formRoom.trim(),
      startTime: formStartTime,
      endTime: formEndTime,
    });
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

        <form onSubmit={handleSubmit} className="space-y-6">
          {formError && (
            <div className="px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-600 animate-[fadeIn_0.15s_ease]">
              {formError}
            </div>
          )}

          <FieldButton
            label="Asignatura"
            value={formSubject}
            placeholder="Ej. Inglés"
            size="lg"
            onClick={() => {
              setFormError('');
              setActiveScreen('subject');
            }}
          />
          <FieldButton
            label="Profesor"
            value={formTeacher}
            placeholder="Ej. Juan García"
            onClick={() => setActiveScreen('teacher')}
          />
          <FieldButton
            label="Aula"
            value={formRoom}
            placeholder="Ej. 201A"
            onClick={() => setActiveScreen('room')}
          />

          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">
              Horario
            </label>
            <div className="flex items-center gap-3">
              <input
                type="time"
                value={formStartTime}
                onChange={(e) => {
                  setFormStartTime(e.target.value);
                  setFormError('');
                }}
                className="text-2xl font-extrabold text-slate-900 bg-transparent border-b-2 border-transparent focus:outline-none focus:border-slate-900 pb-1 transition-colors"
              />
              <span className="text-2xl font-extrabold text-slate-300">–</span>
              <input
                type="time"
                value={formEndTime}
                onChange={(e) => {
                  setFormEndTime(e.target.value);
                  setFormError('');
                }}
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

      {activeScreen === 'subject' && (
        <SingleFieldScreen
          title="Asignatura"
          value={formSubject}
          onChange={(val) => {
            setFormSubject(val);
            setFormError('');
          }}
          placeholder="Ej. Inglés"
          listHeader="Materias en otros días"
          items={subjectItems}
          onSelectItem={(item) => handleSelectSubject(item.raw)}
          onClose={() => setActiveScreen(null)}
          inputRef={subjectInputRef}
        />
      )}

      {activeScreen === 'teacher' && (
        <SingleFieldScreen
          title="Profesor"
          value={formTeacher}
          onChange={setFormTeacher}
          placeholder="Ej. Juan García"
          listHeader="Profesores que ya usas"
          items={teacherItems}
          onSelectItem={(item) => {
            setFormTeacher(item.primary);
            setActiveScreen(null);
          }}
          onClose={() => setActiveScreen(null)}
          inputRef={teacherInputRef}
        />
      )}

      {activeScreen === 'room' && (
        <SingleFieldScreen
          title="Aula"
          value={formRoom}
          onChange={setFormRoom}
          placeholder="Ej. 201A"
          listHeader="Aulas que ya usas"
          items={roomItems}
          onSelectItem={(item) => {
            setFormRoom(item.primary);
            setActiveScreen(null);
          }}
          onClose={() => setActiveScreen(null)}
          inputRef={roomInputRef}
        />
      )}

      {activeScreen === 'combined' && (
        <CombinedFieldsScreen
          draft={combinedDraft}
          onChangeDraft={setCombinedDraft}
          onCancel={handleCancelCombined}
          onSave={handleSaveCombined}
        />
      )}
    </div>
  );
}

function FieldButton({ label, value, placeholder, size = 'md', onClick }) {
  const textSize = size === 'lg' ? 'text-3xl' : 'text-2xl';
  return (
    <button type="button" onClick={onClick} className="w-full text-left group cursor-pointer">
      <span className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">
        {label}
      </span>
      <span
        className={`flex items-center justify-between gap-2 ${textSize} font-extrabold pb-1 border-b-2 border-transparent group-active:border-slate-900 transition-colors ${
          value ? 'text-slate-900' : 'text-slate-300'
        }`}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
      </span>
    </button>
  );
}

function SingleFieldScreen({
  title,
  value,
  onChange,
  placeholder,
  listHeader,
  items,
  onSelectItem,
  onClose,
  inputRef,
}) {
  return (
    <div className="fixed inset-0 z-[60] bg-white flex flex-col animate-[fadeIn_0.15s_ease]">
      <div className="flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+16px)] pb-4">
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2 bg-slate-900 hover:bg-slate-800 rounded-full text-xs font-bold text-white cursor-pointer"
        >
          Guardar
        </button>
      </div>

      <div className="px-5">
        <label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">
          {title}
        </label>
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          className="w-full text-3xl font-extrabold text-slate-900 placeholder-slate-300 bg-transparent border-b-2 border-slate-100 focus:outline-none focus:border-slate-900 pb-2 transition-colors"
        />
      </div>

      {items.length > 0 && (
        <>
          <div className="mt-6 px-5 py-2 bg-slate-50 border-y border-slate-100">
            <span className="text-xs font-bold text-slate-500">{listHeader}</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelectItem(item)}
                className="w-full flex items-center justify-between gap-2 px-5 py-3.5 text-left border-b border-slate-50 hover:bg-slate-50 cursor-pointer"
              >
                <span className="text-sm font-semibold text-slate-800 truncate">
                  {item.primary}
                </span>
                {item.secondary && (
                  <span className="text-xs font-medium text-slate-400 shrink-0">
                    {item.secondary}
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CombinedFieldsScreen({ draft, onChangeDraft, onCancel, onSave }) {
  const handleUseRoomSuggestion = () => {
    onChangeDraft({ ...draft, room: draft.roomSuggestion, roomSuggestion: '' });
  };

  return (
    <div className="fixed inset-0 z-[60] bg-white flex flex-col animate-[fadeIn_0.15s_ease]">
      <div className="flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+16px)] pb-4">
        <button
          type="button"
          onClick={onCancel}
          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={onSave}
          className="px-5 py-2 bg-slate-900 hover:bg-slate-800 rounded-full text-xs font-bold text-white cursor-pointer"
        >
          Guardar
        </button>
      </div>

      <div className="px-5 space-y-7">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">
            Asignatura
          </label>
          <input
            type="text"
            placeholder="Ej. Inglés"
            value={draft.subject}
            onChange={(e) => onChangeDraft({ ...draft, subject: e.target.value })}
            className="w-full text-3xl font-extrabold text-slate-900 placeholder-slate-300 bg-transparent border-b-2 border-transparent focus:outline-none focus:border-slate-900 pb-1 transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">
            Profesor
          </label>
          <input
            type="text"
            placeholder="Ej. Juan García"
            value={draft.teacher}
            onChange={(e) => onChangeDraft({ ...draft, teacher: e.target.value })}
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
            value={draft.room}
            onChange={(e) => onChangeDraft({ ...draft, room: e.target.value, roomSuggestion: '' })}
            className="w-full text-2xl font-extrabold text-slate-900 placeholder-slate-300 bg-transparent border-b-2 border-transparent focus:outline-none focus:border-slate-900 pb-1 transition-colors"
          />
          {draft.roomSuggestion && draft.roomSuggestion !== draft.room && (
            <button
              type="button"
              onClick={handleUseRoomSuggestion}
              className="mt-2 flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              <MapPin className="w-3 h-3" />
              ¿Usar {draft.roomSuggestion}?
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
