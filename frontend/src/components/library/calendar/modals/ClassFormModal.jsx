import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, MapPin, Palette, Wand2, X } from 'lucide-react';
import { MATERIA_PALETTE } from '../../../../lib/materiaColors';
import { getSubjectKey, normalizeSubjectName } from '../scheduleUtils';
import useModalAccessibility from '../../../../hooks/useModalAccessibility';

function useLockBodyScroll() {
  useEffect(() => {
    const scrollY = window.scrollY;
    const body = document.body;
    const previous = {
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
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      body.style.width = previous.width;
      window.scrollTo(0, scrollY);
    };
  }, []);
}

export default function ClassFormModal({
  onClose,
  onSave,
  initialSubject = '',
  initialTeacher = '',
  initialRoom = '',
  initialStartTime = '08:00',
  initialEndTime = '09:30',
  initialSubjectKey = '',
  initialColor = null,
  initialColorMode = 'automatic',
  existingClasses = [],
  saving = false,
}) {
  useLockBodyScroll();

  const [formSubject, setFormSubject] = useState(initialSubject);
  const [formTeacher, setFormTeacher] = useState(initialTeacher);
  const [formRoom, setFormRoom] = useState(initialRoom);
  const [formStartTime, setFormStartTime] = useState(initialStartTime);
  const [formEndTime, setFormEndTime] = useState(initialEndTime);
  const [formColor, setFormColor] = useState(initialColor);
  const [formColorMode, setFormColorMode] = useState(initialColorMode === 'custom' ? 'custom' : 'automatic');
  const [colorWasChanged, setColorWasChanged] = useState(false);
  const [formSubjectKey, setFormSubjectKey] = useState(initialSubjectKey || getSubjectKey(initialSubject));
  const [subjectSelectionLocked, setSubjectSelectionLocked] = useState(Boolean(initialSubjectKey));
  const [formError, setFormError] = useState('');
  const [activeScreen, setActiveScreen] = useState(null);
  const [combinedDraft, setCombinedDraft] = useState({ subject: '', teacher: '', room: '', roomSuggestion: '' });
  const dialogRef = useModalAccessibility({ open: !activeScreen, onClose });

  const subjectInputRef = useRef(null);
  const teacherInputRef = useRef(null);
  const roomInputRef = useRef(null);

  useEffect(() => {
    const target = { subject: subjectInputRef, teacher: teacherInputRef, room: roomInputRef }[activeScreen]?.current;
    if (!target) return undefined;
    const timer = window.setTimeout(() => target.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [activeScreen]);

  const uniqueSubjects = useMemo(() => {
    const map = new Map();
    existingClasses.forEach((classItem) => {
      if (!classItem.subject) return;
      const key = classItem.subjectKey || getSubjectKey(classItem.subject);
      if (!map.has(key)) map.set(key, classItem);
    });
    return Array.from(map.values()).sort((a, b) => a.subject.localeCompare(b.subject));
  }, [existingClasses]);

  const subjectItems = useMemo(() => {
    const query = formSubject.trim().toLowerCase();
    return uniqueSubjects
      .filter((item) => !query || item.subject.toLowerCase().includes(query))
      .map((item) => ({ key: item.subjectKey || getSubjectKey(item.subject), primary: item.subject, secondary: item.teacher, raw: item }));
  }, [formSubject, uniqueSubjects]);

  const teacherItems = useMemo(() => {
    const values = new Map();
    existingClasses.forEach((item) => {
      const value = item.teacher?.trim();
      if (value) values.set(value.toLowerCase(), value);
    });
    const query = formTeacher.trim().toLowerCase();
    return Array.from(values.values())
      .filter((value) => !query || value.toLowerCase().includes(query))
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ key: value, primary: value }));
  }, [existingClasses, formTeacher]);

  const roomItems = useMemo(() => {
    const values = new Map();
    existingClasses.forEach((item) => {
      const value = item.room?.trim();
      if (value) values.set(value.toLowerCase(), value);
    });
    const query = formRoom.trim().toLowerCase();
    return Array.from(values.values())
      .filter((value) => !query || value.toLowerCase().includes(query))
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ key: value, primary: value }));
  }, [existingClasses, formRoom]);

  const handleSelectSubject = (classItem) => {
    setFormSubject(classItem.subject);
    setFormTeacher(classItem.teacher || '');
    setFormColor(classItem.colorMode === 'custom' ? classItem.color : null);
    setFormColorMode(classItem.colorMode === 'custom' ? 'custom' : 'automatic');
    setColorWasChanged(false);
    setFormSubjectKey(classItem.subjectKey || getSubjectKey(classItem.subject));
    setSubjectSelectionLocked(true);
    setCombinedDraft({
      subject: classItem.subject,
      teacher: classItem.teacher || '',
      room: formRoom,
      roomSuggestion: classItem.room || '',
    });
    setActiveScreen('combined');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    if (!formSubject.trim()) {
      setFormError('Ingresa el nombre de la asignatura.');
      return;
    }
    if (formEndTime <= formStartTime) {
      setFormError('La hora de fin debe ser posterior a la de inicio.');
      return;
    }

    const subjectKey = subjectSelectionLocked && formSubjectKey
      ? formSubjectKey
      : (normalizeSubjectName(formSubject) === normalizeSubjectName(initialSubject)
        ? formSubjectKey
        : getSubjectKey(formSubject));
    try {
      const result = await onSave({
        subject: formSubject.trim(),
        teacher: formTeacher.trim(),
        room: formRoom.trim(),
        startTime: formStartTime,
        endTime: formEndTime,
        subjectKey,
        ...(colorWasChanged ? {
          color: formColorMode === 'custom' ? formColor : null,
          colorMode: formColorMode,
        } : {}),
      });
      if (result?.ok === false && result.error) setFormError(result.error);
    } catch (saveError) {
      setFormError(saveError?.message || 'No se pudo guardar la clase.');
    }
  };

  const setSubjectValue = (value) => {
    setFormSubject(value);
    setSubjectSelectionLocked(false);
    setFormError('');
  };

  if (activeScreen === 'color') {
    return (
      <ColorPickerScreen
        value={formColor}
        mode={formColorMode}
        onSelect={(color) => {
          setColorWasChanged(true);
          if (color) {
            setFormColor(color);
            setFormColorMode('custom');
          } else {
            setFormColor(null);
            setFormColorMode('automatic');
          }
        }}
        onClose={() => setActiveScreen(null)}
      />
    );
  }

  return (
    <div ref={dialogRef} tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 outline-none backdrop-blur-sm animate-[fadeIn_0.15s_ease]" role="dialog" aria-modal="true" aria-label={initialSubject ? 'Editar clase' : 'Nueva clase'}>
      <div className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-slate-900 dark:text-white shadow-2xl">
        <div className="mb-2 flex justify-end">
          <button type="button" onClick={onClose} disabled={saving} className="min-h-11 min-w-11 rounded-full p-2 text-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200" aria-label="Cerrar formulario">
            <X className="mx-auto h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {formError && <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300" role="alert">{formError}</div>}

          <FieldButton label="Asignatura" value={formSubject} placeholder="Ej. Inglés" size="lg" onClick={() => setActiveScreen('subject')} />
          <FieldButton label="Profesor" value={formTeacher} placeholder="Ej. Juan García" onClick={() => setActiveScreen('teacher')} />
          <FieldButton label="Aula" value={formRoom} placeholder="Ej. 201A" onClick={() => setActiveScreen('room')} />

          <button type="button" onClick={() => setActiveScreen('color')} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 px-3 py-2.5 text-left hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: formColorMode === 'custom' ? formColor : '#e2e8f0' }}>
                {formColorMode === 'custom' ? <Palette className="h-4 w-4 text-white" /> : <Wand2 className="h-4 w-4 text-slate-500" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900 dark:text-white">Color</span>
                <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{formColorMode === 'custom' ? 'Personalizado' : 'Automático'}</span>
              </span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
          </button>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">Horario</label>
            <div className="flex items-center gap-3">
              <input aria-label="Hora de inicio" type="time" value={formStartTime} onChange={(event) => { setFormStartTime(event.target.value); setFormError(''); }} className="min-h-11 w-full rounded-xl border border-slate-200 bg-transparent px-2 text-xl font-extrabold text-slate-900 focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:text-white dark:focus:border-white" />
              <span className="text-xl font-extrabold text-slate-300">–</span>
              <input aria-label="Hora de fin" type="time" value={formEndTime} onChange={(event) => { setFormEndTime(event.target.value); setFormError(''); }} className="min-h-11 w-full rounded-xl border border-slate-200 bg-transparent px-2 text-xl font-extrabold text-slate-900 focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:text-white dark:focus:border-white" />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} disabled={saving} className="min-h-11 flex-1 rounded-xl bg-slate-100 text-xs font-bold text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">Cancelar</button>
            <button type="submit" disabled={saving} className="min-h-11 flex-1 rounded-xl bg-slate-900 text-xs font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">
              {saving ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Guardando</span> : 'Guardar clase'}
            </button>
          </div>
        </form>
      </div>

      {activeScreen === 'subject' && <SingleFieldScreen title="Asignatura" value={formSubject} onChange={setSubjectValue} placeholder="Ej. Inglés" listHeader="Materias en este horario" items={subjectItems} onSelectItem={(item) => handleSelectSubject(item.raw)} onClose={() => setActiveScreen(null)} inputRef={subjectInputRef} />}
      {activeScreen === 'teacher' && <SingleFieldScreen title="Profesor" value={formTeacher} onChange={setFormTeacher} placeholder="Ej. Juan García" listHeader="Profesores que ya usas" items={teacherItems} onSelectItem={(item) => { setFormTeacher(item.primary); setActiveScreen(null); }} onClose={() => setActiveScreen(null)} inputRef={teacherInputRef} />}
      {activeScreen === 'room' && <SingleFieldScreen title="Aula" value={formRoom} onChange={setFormRoom} placeholder="Ej. 201A" listHeader="Aulas que ya usas" items={roomItems} onSelectItem={(item) => { setFormRoom(item.primary); setActiveScreen(null); }} onClose={() => setActiveScreen(null)} inputRef={roomInputRef} />}
      {activeScreen === 'combined' && <CombinedFieldsScreen draft={combinedDraft} onChangeDraft={setCombinedDraft} onCancel={() => setActiveScreen(null)} onSave={() => { setFormSubject(combinedDraft.subject); setFormTeacher(combinedDraft.teacher); setFormRoom(combinedDraft.room); setActiveScreen(null); }} />}
    </div>
  );
}

function FieldButton({ label, value, placeholder, size = 'md', onClick }) {
  return (
    <button type="button" onClick={onClick} className="group w-full text-left">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">{label}</span>
      <span className={`flex items-center justify-between gap-2 ${size === 'lg' ? 'text-2xl' : 'text-xl'} border-b-2 border-transparent pb-1 font-extrabold transition-colors group-active:border-slate-900 dark:group-active:border-white ${value ? 'text-slate-900 dark:text-white' : 'text-slate-300 dark:text-slate-600'}`}>
        <span className="truncate">{value || placeholder}</span><ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
      </span>
    </button>
  );
}

function SingleFieldScreen({ title, value, onChange, placeholder, listHeader, items, onSelectItem, onClose, inputRef }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white pb-[env(safe-area-inset-bottom)] text-slate-900 dark:bg-slate-950 dark:text-white">
      <div className="flex items-center justify-between px-5 pb-4 pt-[calc(env(safe-area-inset-top)+12px)]">
        <button type="button" onClick={onClose} className="min-h-11 min-w-11 rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={`Volver de ${title}`}><ChevronLeft className="mx-auto h-5 w-5" /></button>
        <button type="button" onClick={onClose} className="min-h-11 rounded-full bg-slate-900 px-5 py-2 text-xs font-bold text-white dark:bg-white dark:text-slate-900">Listo</button>
      </div>
      <div className="px-5">
        <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">{title}</label>
        <input ref={inputRef} type="text" placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} autoComplete="off" className="w-full border-b-2 border-slate-100 bg-transparent pb-2 text-3xl font-extrabold text-slate-900 placeholder-slate-300 focus:border-slate-900 focus:outline-none dark:border-slate-800 dark:text-white dark:focus:border-white" />
      </div>
      {items.length > 0 && <>
        <div className="mt-6 border-y border-slate-100 bg-slate-50 px-5 py-2 dark:border-slate-800 dark:bg-slate-900"><span className="text-xs font-bold text-slate-500 dark:text-slate-400">{listHeader}</span></div>
        <div className="flex-1 overflow-y-auto">
          {items.map((item) => <button key={item.key} type="button" onClick={() => onSelectItem(item)} className="flex min-h-12 w-full items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5 text-left hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"><span className="truncate text-sm font-semibold">{item.primary}</span>{item.secondary && <span className="shrink-0 text-xs text-slate-400">{item.secondary}</span>}</button>)}
        </div>
      </>}
    </div>
  );
}

function ColorPickerScreen({ value, mode, onSelect, onClose }) {
  const choices = [null, ...MATERIA_PALETTE];
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white pb-[env(safe-area-inset-bottom)] text-slate-900 dark:bg-slate-950 dark:text-white">
      <div className="flex items-center justify-between px-5 pb-4 pt-[calc(env(safe-area-inset-top)+12px)]">
        <button type="button" onClick={onClose} className="min-h-11 min-w-11 rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Volver al formulario"><ChevronLeft className="mx-auto h-5 w-5" /></button>
        <button type="button" onClick={onClose} className="min-h-11 rounded-full bg-slate-900 px-5 py-2 text-xs font-bold text-white dark:bg-white dark:text-slate-900">Listo</button>
      </div>
      <div className="px-5">
        <h2 className="text-xl font-black">Color de la asignatura</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Se aplicará a sus clases en este horario.</p>
        <div className="mt-5 grid grid-cols-4 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
          {choices.map((color) => {
            const selected = color === null ? mode === 'automatic' : mode === 'custom' && value?.toLowerCase() === color.toLowerCase();
            return <button key={color || 'automatic'} type="button" onClick={() => onSelect(color)} aria-label={color ? `Elegir color ${color}` : 'Usar color automático'} aria-pressed={selected} className={`relative flex min-h-12 min-w-12 items-center justify-center rounded-2xl border-2 transition-transform active:scale-95 ${selected ? 'border-slate-900 ring-2 ring-slate-900/20 dark:border-white dark:ring-white/20' : 'border-transparent'}`} style={{ backgroundColor: color || '#e2e8f0' }}>{color ? <Palette className="h-5 w-5 text-white drop-shadow" /> : <Wand2 className="h-5 w-5 text-slate-500" />}{selected && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-slate-900 dark:border-slate-950 dark:bg-white" />}</button>;
          })}
        </div>
        <label className="mt-4 flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 px-3 dark:border-slate-800">
          <input type="color" value={value || '#6366F1'} onChange={(event) => onSelect(event.target.value)} className="h-8 w-8 rounded-lg border-0 bg-transparent p-0" aria-label="Elegir color personalizado" />
          <span className="text-sm font-semibold">Color personalizado</span>
        </label>
      </div>
    </div>
  );
}

function CombinedFieldsScreen({ draft, onChangeDraft, onCancel, onSave }) {
  const useRoomSuggestion = () => onChangeDraft({ ...draft, room: draft.roomSuggestion, roomSuggestion: '' });
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white pb-[env(safe-area-inset-bottom)] text-slate-900 dark:bg-slate-950 dark:text-white">
      <div className="flex items-center justify-between px-5 pb-4 pt-[calc(env(safe-area-inset-top)+12px)]"><button type="button" onClick={onCancel} className="min-h-11 min-w-11 rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Volver al formulario"><ChevronLeft className="mx-auto h-5 w-5" /></button><button type="button" onClick={onSave} className="min-h-11 rounded-full bg-slate-900 px-5 py-2 text-xs font-bold text-white dark:bg-white dark:text-slate-900">Listo</button></div>
      <div className="space-y-7 px-5">
        <EditableLine label="Asignatura" value={draft.subject} onChange={(subject) => onChangeDraft({ ...draft, subject })} />
        <EditableLine label="Profesor" value={draft.teacher} onChange={(teacher) => onChangeDraft({ ...draft, teacher })} />
        <div><EditableLine label="Aula" value={draft.room} onChange={(room) => onChangeDraft({ ...draft, room, roomSuggestion: '' })} />{draft.roomSuggestion && draft.roomSuggestion !== draft.room && <button type="button" onClick={useRoomSuggestion} className="mt-2 flex min-h-11 items-center gap-1 text-xs font-semibold text-slate-500"><MapPin className="h-3 w-3" />Usar {draft.roomSuggestion}</button>}</div>
      </div>
    </div>
  );
}

function EditableLine({ label, value, onChange }) {
  return <label className="block"><span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">{label}</span><input type="text" value={value} onChange={(event) => onChange(event.target.value)} className="w-full border-b-2 border-transparent bg-transparent pb-1 text-2xl font-extrabold focus:border-slate-900 focus:outline-none dark:focus:border-white" /></label>;
}
