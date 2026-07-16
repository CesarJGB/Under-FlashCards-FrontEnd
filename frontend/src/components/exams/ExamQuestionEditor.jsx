import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlignLeft,
  ArrowLeft,
  Check,
  CheckCircle2,
  Circle,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { getJSON, setJSON } from '../../lib/safeLocalStorage';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const LAST_TYPE_KEY = 'ufc_exam_last_type_v1';

const QUESTION_TYPES = [
  { id: 'multiple_choice', label: 'Opción múltiple', Icon: ListChecks },
  { id: 'true_false', label: 'Verdadero/Falso', Icon: CheckCircle2 },
  { id: 'open', label: 'Abierta', Icon: AlignLeft },
];

function getQuestionId(question) {
  return String(question?.id || question?._id || '');
}

function emptyForm(type) {
  return {
    type,
    prompt: '',
    options: [
      { id: 'option-1', text: '' },
      { id: 'option-2', text: '' },
    ],
    correctOptionId: 'option-1',
    correctBoolean: true,
    expectedAnswer: '',
  };
}

function getErrorMessage(payload, fallback) {
  return payload?.error || payload?.message || fallback;
}

function optionText(question) {
  return question.options?.find((option) => option.id === question.correctOptionId)?.text || 'Sin opción correcta';
}

function optionOrder(option) {
  const match = /^option-(\d+)$/.exec(option?.id || '');
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function sortOptionsForEditing(options) {
  return [...options].sort((first, second) => (
    optionOrder(first) - optionOrder(second)
    || String(first.id || '').localeCompare(String(second.id || ''))
  ));
}

function optionLabel(index) {
  return String.fromCharCode(65 + index);
}

function questionSummary(question) {
  if (question.type === 'multiple_choice') return `Correcta: ${optionText(question)}`;
  if (question.type === 'true_false') return `Respuesta: ${question.correctBoolean ? 'Verdadero' : 'Falso'}`;
  return `Esperada: ${question.expectedAnswer || 'Sin respuesta'}`;
}

export default function ExamQuestionEditor({ exam, userId, onBack, onExamChange, notice = '' }) {
  const storedType = getJSON(LAST_TYPE_KEY);
  const initialType = QUESTION_TYPES.some((type) => type.id === storedType)
    ? storedType
    : 'multiple_choice';
  const [activeType, setActiveType] = useState(initialType);
  const [form, setForm] = useState(() => emptyForm(initialType));
  const [questions, setQuestions] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const loadVersionRef = useRef(0);

  const updateExamCount = useCallback((nextQuestions) => {
    if (Number(exam.questionCount || 0) === nextQuestions.length) return;
    onExamChange?.({ ...exam, questionCount: nextQuestions.length });
  }, [exam, onExamChange]);

  const loadQuestions = useCallback(async (signal, loadVersion) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/exams/${encodeURIComponent(getQuestionId(exam))}/questions?userId=${encodeURIComponent(userId)}`
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(payload)) {
        throw new Error(getErrorMessage(payload, 'No se pudieron cargar las preguntas.'));
      }
      if (signal.aborted || loadVersion !== loadVersionRef.current) return;
      setQuestions(payload);
      updateExamCount(payload);
    } catch (loadError) {
      if (loadError.name !== 'AbortError' && !signal.aborted && loadVersion === loadVersionRef.current) {
        setError(loadError.message || 'No se pudieron cargar las preguntas.');
      }
    } finally {
      if (!signal.aborted && loadVersion === loadVersionRef.current) setLoading(false);
    }
  }, [exam, updateExamCount, userId]);

  useEffect(() => {
    const controller = new AbortController();
    const loadVersion = ++loadVersionRef.current;
    loadQuestions(controller.signal, loadVersion);
    return () => controller.abort();
  }, [loadQuestions]);

  useEffect(() => {
    setJSON(LAST_TYPE_KEY, activeType);
  }, [activeType]);

  const resetForm = (type = activeType) => {
    setEditingId(null);
    setForm(emptyForm(type));
    setError('');
  };

  const changeType = (type) => {
    setActiveType(type);
    resetForm(type);
  };

  const updateOption = (optionId, text) => {
    setForm((current) => ({
      ...current,
      options: current.options.map((option) => (option.id === optionId ? { ...option, text } : option)),
    }));
  };

  const addOption = () => {
    setForm((current) => ({
      ...current,
      options: [...current.options, { id: `option-${current.options.length + 1}`, text: '' }],
    }));
  };

  const removeOption = (optionId) => {
    setForm((current) => {
      if (current.options.length <= 2) return current;
      const remaining = current.options.filter((option) => option.id !== optionId);
      const previousCorrectIndex = current.options.findIndex((option) => option.id === current.correctOptionId);
      const nextOptions = remaining.map((option, index) => ({ ...option, id: `option-${index + 1}` }));
      const nextCorrectIndex = previousCorrectIndex === -1
        ? 0
        : Math.min(previousCorrectIndex, nextOptions.length - 1);

      return {
        ...current,
        options: nextOptions,
        correctOptionId: nextOptions[nextCorrectIndex]?.id || '',
      };
    });
  };

  const validateForm = () => {
    if (!form.prompt.trim()) return 'Escribe el enunciado de la pregunta.';

    if (activeType === 'multiple_choice') {
      if (form.options.length < 2 || form.options.some((option) => !option.text.trim())) {
        return 'La opción múltiple necesita al menos dos opciones con texto.';
      }
      if (!form.options.some((option) => option.id === form.correctOptionId)) {
        return 'Marca cuál de las opciones es correcta.';
      }
    }

    if (activeType === 'open' && !form.expectedAnswer.trim()) {
      return 'Escribe la respuesta esperada para esta pregunta abierta.';
    }

    return '';
  };

  const saveQuestion = async (event) => {
    event.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    const question = {
      type: activeType,
      prompt: form.prompt.trim(),
      options: activeType === 'multiple_choice'
        ? form.options.map((option) => ({ ...option, text: option.text.trim() }))
        : [],
      correctOptionId: activeType === 'multiple_choice' ? form.correctOptionId : null,
      correctBoolean: activeType === 'true_false' ? form.correctBoolean : null,
      expectedAnswer: activeType === 'open' ? form.expectedAnswer.trim() : null,
    };

    const questionId = editingId;
    const endpoint = questionId
      ? `${BACKEND_URL}/api/exams/${encodeURIComponent(getQuestionId(exam))}/questions/${encodeURIComponent(questionId)}`
      : `${BACKEND_URL}/api/exams/${encodeURIComponent(getQuestionId(exam))}/questions`;

    setSaving(true);
    setError('');
    try {
      const response = await fetch(endpoint, {
        method: questionId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...question }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(getErrorMessage(payload, 'No se pudo guardar la pregunta.'));

      const nextQuestions = questionId
        ? questions.map((item) => (getQuestionId(item) === questionId ? payload : item))
        : [...questions, payload];
      nextQuestions.sort((first, second) => Number(first.order) - Number(second.order));
      loadVersionRef.current += 1;
      setLoading(false);
      setQuestions(nextQuestions);
      updateExamCount(nextQuestions);
      resetForm(activeType);
    } catch (saveError) {
      setError(saveError.message || 'No se pudo guardar la pregunta.');
    } finally {
      setSaving(false);
    }
  };

  const editQuestion = (question) => {
    const type = question.type;
    setActiveType(type);
    setEditingId(getQuestionId(question));
    setForm({
      type,
      prompt: question.prompt || '',
      options: question.options?.length
        ? sortOptionsForEditing(question.options).map((option) => ({ id: option.id, text: option.text || '' }))
        : emptyForm('multiple_choice').options,
      correctOptionId: question.correctOptionId || question.options?.[0]?.id || 'option-1',
      correctBoolean: typeof question.correctBoolean === 'boolean' ? question.correctBoolean : true,
      expectedAnswer: question.expectedAnswer || '',
    });
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteQuestion = async (question) => {
    if (!window.confirm('¿Eliminar esta pregunta del examen?')) return;

    const questionId = getQuestionId(question);
    setError('');
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/exams/${encodeURIComponent(getQuestionId(exam))}/questions/${encodeURIComponent(questionId)}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        }
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(getErrorMessage(payload, 'No se pudo eliminar la pregunta.'));

      const nextQuestions = questions.filter((item) => getQuestionId(item) !== questionId);
      loadVersionRef.current += 1;
      setLoading(false);
      setQuestions(nextQuestions);
      updateExamCount(nextQuestions);
      if (editingId === questionId) resetForm();
    } catch (deleteError) {
      setError(deleteError.message || 'No se pudo eliminar la pregunta.');
    }
  };

  return (
    <div className="space-y-6 animate-[fadeIn_0.15s_ease]">
      <header className="flex items-start gap-3 border-b border-slate-200/60 pb-4">
        <button
          type="button"
          onClick={onBack}
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-3xs transition-all hover:bg-slate-50 active:scale-95"
          aria-label="Volver a exámenes"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Editor de examen</p>
          <h1 className="truncate text-xl font-black tracking-tight text-slate-900">{exam.title}</h1>
          <p className="mt-1 text-xs font-medium text-slate-500">{questions.length} pregunta{questions.length === 1 ? '' : 's'}</p>
        </div>
      </header>

      {notice && (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          {notice}
        </p>
      )}

      <form onSubmit={saveQuestion} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {editingId ? 'Editando pregunta' : 'Nueva pregunta'}
            </p>
          </div>
          <div className="grid grid-cols-3 rounded-xl border border-slate-200 bg-slate-100 p-1 sm:w-auto">
            {QUESTION_TYPES.map(({ id, label, Icon }) => {
              const selected = activeType === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => changeType(id)}
                  className={`flex min-w-0 items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-bold transition-all sm:px-3 ${
                    selected ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-slate-700">Enunciado</span>
            <textarea
              value={form.prompt}
              onChange={(event) => setForm((current) => ({ ...current, prompt: event.target.value }))}
              rows={3}
              placeholder="Escribe la pregunta que verá la persona que realiza el examen..."
              className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/10"
            />
          </label>

          {activeType === 'multiple_choice' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-slate-700">Opciones</span>
                <span className="text-[11px] font-medium text-slate-400">Orden fijo para edición</span>
              </div>
              <p className="text-[11px] font-medium text-slate-500">Aquí las opciones se mantienen en orden A, B, C...; se mezclan únicamente al repasar o descargar.</p>
              {form.options.map((option, index) => (
                <div key={option.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, correctOptionId: option.id }))}
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                      form.correctOptionId === option.id
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-slate-200 bg-white text-slate-300 hover:border-indigo-300'
                    }`}
                    aria-label={`Marcar opción ${index + 1} como correcta`}
                    title="Marcar como correcta"
                  >
                    {form.correctOptionId === option.id ? <Check className="h-4 w-4 stroke-[3]" /> : <Circle className="h-4 w-4" />}
                  </button>
                  <span className="flex h-9 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-black text-slate-500" aria-hidden="true">
                    {optionLabel(index)}
                  </span>
                  <input
                    value={option.text}
                    onChange={(event) => updateOption(option.id, event.target.value)}
                    placeholder={`Opción ${index + 1}`}
                    className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/10"
                  />
                  {form.correctOptionId === option.id && (
                    <span className="hidden shrink-0 rounded-lg bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700 sm:inline">Correcta</span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeOption(option.id)}
                    disabled={form.options.length <= 2}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label={`Eliminar opción ${index + 1}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addOption}
                className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
              >
                <Plus className="h-3.5 w-3.5" /> Añadir opción
              </button>
            </div>
          )}

          {activeType === 'true_false' && (
            <div>
              <span className="mb-2 block text-xs font-bold text-slate-700">Respuesta correcta</span>
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1.5">
                {[true, false].map((value) => {
                  const selected = form.correctBoolean === value;
                  return (
                    <button
                      key={String(value)}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, correctBoolean: value }))}
                      className={`rounded-lg px-3 py-2.5 text-sm font-bold transition-all ${
                        selected ? 'bg-white text-indigo-700 shadow-2xs ring-1 ring-indigo-100' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {value ? 'Verdadero' : 'Falso'}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeType === 'open' && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-700">Respuesta esperada</span>
              <textarea
                value={form.expectedAnswer}
                onChange={(event) => setForm((current) => ({ ...current, expectedAnswer: event.target.value }))}
                rows={3}
                placeholder="Escribe una respuesta de referencia para la autocalificación..."
                className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/10"
              />
            </label>
          )}
        </div>

        {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>}

        <div className="mt-5 flex gap-2 border-t border-slate-100 pt-4">
          {editingId && (
            <button
              type="button"
              onClick={() => resetForm()}
              className="flex h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 text-xs font-bold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editingId ? 'Guardar cambios' : 'Agregar pregunta'}
          </button>
        </div>
      </form>

      <section className="space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Preguntas ({questions.length})</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-xs font-medium text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-500" /> Cargando preguntas...
          </div>
        ) : questions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center text-xs font-medium text-slate-400">
            Todavía no hay preguntas. Crea la primera desde el formulario.
          </div>
        ) : (
          <div className="space-y-2.5">
            {questions.map((question, index) => {
              const type = QUESTION_TYPES.find((item) => item.id === question.type);
              const Icon = type?.Icon || AlignLeft;
              return (
                <article key={getQuestionId(question)} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-3xs sm:p-4">
                  <div className="flex gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-black text-slate-500">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-2 text-sm font-bold leading-snug text-slate-800">{question.prompt}</p>
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-indigo-50 px-1.5 py-1 text-[10px] font-bold text-indigo-700">
                          <Icon className="h-3 w-3" /> {type?.label}
                        </span>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-xs font-medium text-slate-500">{questionSummary(question)}</p>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => editQuestion(question)}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-600 transition-colors hover:bg-slate-100"
                        >
                          <Pencil className="h-3 w-3" /> Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteQuestion(question)}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold text-rose-600 transition-colors hover:bg-rose-50"
                        >
                          <Trash2 className="h-3 w-3" /> Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
