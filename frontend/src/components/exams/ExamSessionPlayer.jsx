import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleX,
  Clock3,
  Loader2,
  RotateCcw,
} from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const SECONDS_PER_QUESTION = 60;

const TYPE_LABELS = {
  multiple_choice: 'Opción múltiple',
  true_false: 'Verdadero/Falso',
  open: 'Abierta',
};

function getQuestionId(question) {
  return String(question?.id || question?._id || '');
}

function shuffle(items) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function getErrorMessage(payload, fallback) {
  return payload?.error || payload?.message || fallback;
}

export default function ExamSessionPlayer({
  examId,
  userId,
  onExit,
  mode = 'quick',
  questionTypeFilter = null,
}) {
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const startedAtRef = useRef(Date.now());
  const submittedRef = useRef(false);

  const currentQuestion = questions[currentIndex] || null;
  const currentQuestionId = getQuestionId(currentQuestion);
  const currentAnswer = answers[currentQuestionId] || null;
  const isTimed = mode === 'timed';

  const localBreakdown = useMemo(() => {
    const breakdown = {};
    for (const question of questions) {
      const type = question.type;
      if (!breakdown[type]) breakdown[type] = { correct: 0, total: 0 };
      breakdown[type].total += 1;
      if (answers[getQuestionId(question)]?.isCorrect) breakdown[type].correct += 1;
    }
    return breakdown;
  }, [answers, questions]);

  const loadQuestions = useCallback(async (signal) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/exams/${encodeURIComponent(examId)}/questions?userId=${encodeURIComponent(userId)}`,
        { signal }
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(payload)) {
        throw new Error(getErrorMessage(payload, 'No se pudieron cargar las preguntas del examen.'));
      }
      const filtered = questionTypeFilter
        ? payload.filter((question) => question.type === questionTypeFilter)
        : payload;
      const shuffled = shuffle(filtered);
      setQuestions(shuffled);
      setCurrentIndex(0);
      setAnswers({});
      setRevealed(false);
      startedAtRef.current = Date.now();
      submittedRef.current = false;
      setTimeLeft(mode === 'timed' ? shuffled.length * SECONDS_PER_QUESTION : null);
    } catch (loadError) {
      if (loadError.name !== 'AbortError' && !signal?.aborted) {
        setError(loadError.message || 'No se pudieron cargar las preguntas del examen.');
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [examId, mode, questionTypeFilter, userId]);

  useEffect(() => {
    const controller = new AbortController();
    loadQuestions(controller.signal);
    return () => controller.abort();
  }, [loadQuestions]);

  const selectAnswer = (answer, isCorrect) => {
    if (!currentQuestion) return;
    setAnswers((current) => ({
      ...current,
      [currentQuestionId]: { answer, isCorrect },
    }));
  };

  const submitAttempt = useCallback(async () => {
    if (submittedRef.current || questions.length === 0) return;
    submittedRef.current = true;
    setSubmitting(true);
    setError('');

    const durationSeconds = Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000));
    const answerRows = questions
      .filter((question) => answers[getQuestionId(question)])
      .map((question) => {
        const answer = answers[getQuestionId(question)];
        return {
          questionId: getQuestionId(question),
          answer: answer.answer,
          ...(question.type === 'open' && typeof answer.isCorrect === 'boolean'
            ? { manualCorrect: answer.isCorrect }
            : {}),
        };
      });

    try {
      const response = await fetch(`${BACKEND_URL}/api/exams/${encodeURIComponent(examId)}/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          mode,
          durationSeconds,
          questionIds: questions.map((question) => getQuestionId(question)),
          answers: answerRows,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(getErrorMessage(payload, 'No se pudo guardar el resultado del examen.'));
      setResult(payload);
    } catch (submitError) {
      submittedRef.current = false;
      setTimeLeft(null);
      setError(submitError.message || 'No se pudo guardar el resultado del examen.');
    } finally {
      setSubmitting(false);
    }
  }, [answers, examId, mode, questions, userId]);

  useEffect(() => {
    if (!isTimed || loading || result || submitting || timeLeft === null || questions.length === 0) return undefined;
    if (timeLeft <= 0) {
      submitAttempt();
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setTimeLeft((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearTimeout(timeoutId);
  }, [isTimed, loading, questions.length, result, submitting, submitAttempt, timeLeft]);

  const canContinue = currentQuestion?.type === 'open'
    ? Boolean(currentAnswer?.answer?.trim()) && typeof currentAnswer?.isCorrect === 'boolean'
    : currentAnswer !== null;

  const nextQuestion = () => {
    if (!canContinue) return;
    if (currentIndex >= questions.length - 1) {
      submitAttempt();
      return;
    }
    setCurrentIndex((index) => index + 1);
    setRevealed(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center gap-2 text-sm font-medium text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-500" /> Cargando examen...
      </div>
    );
  }

  if (result) {
    const total = result.total || questions.length;
    const score = result.score || 0;
    const breakdown = result.perTypeBreakdown || localBreakdown;
    const duration = result.durationSeconds ?? Math.round((Date.now() - startedAtRef.current) / 1000);
    return (
      <div className="mx-auto max-w-2xl space-y-6 animate-[fadeIn_0.2s_ease]">
        <header className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <BarChart3 className="h-7 w-7" />
          </span>
          <h1 className="mt-4 text-2xl font-black tracking-tight text-slate-900">Resultado del examen</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">Tu intento quedó registrado.</p>
        </header>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-3xs">
            <p className="text-2xl font-black text-slate-900">{score}/{total}</p>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Correctas</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-3xs">
            <p className="text-2xl font-black text-rose-600">{Math.max(0, total - score)}</p>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Incorrectas</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-3xs">
            <p className="text-2xl font-black text-indigo-600">{total ? Math.round((score / total) * 100) : 0}%</p>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Precisión</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-3xs">
            <p className="text-2xl font-black text-slate-900">{formatTime(duration)}</p>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Tiempo</p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-3xs sm:p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Por tipo de pregunta</h2>
          <div className="mt-4 space-y-3">
            {Object.entries(breakdown).map(([type, values]) => {
              const typeTotal = Number(values.total || 0);
              const typeCorrect = Number(values.correct || 0);
              const percentage = typeTotal ? (typeCorrect / typeTotal) * 100 : 0;
              return (
                <div key={type}>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-xs font-semibold text-slate-600">
                    <span>{TYPE_LABELS[type] || type}</span>
                    <span>{typeCorrect}/{typeTotal}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <button
          type="button"
          onClick={onExit}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-bold text-white transition-colors hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a exámenes
        </button>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center animate-[fadeIn_0.15s_ease]">
        <CircleX className="mx-auto h-9 w-9 text-slate-400" />
        <h1 className="text-lg font-black text-slate-900">No hay preguntas para este modo</h1>
        <p className="text-sm font-medium text-slate-500">{error || 'Agrega preguntas o selecciona un tipo que exista en este examen.'}</p>
        <button type="button" onClick={onExit} className="mx-auto rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white">Volver</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 animate-[fadeIn_0.15s_ease]">
      <header className="flex items-center gap-3 border-b border-slate-200/60 pb-4">
        <button
          type="button"
          onClick={onExit}
          disabled={submitting}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-3xs transition-all hover:bg-slate-50 disabled:opacity-50"
          aria-label="Salir del examen"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{TYPE_LABELS[currentQuestion.type]}</p>
          <p className="mt-0.5 text-sm font-bold text-slate-900">Pregunta {currentIndex + 1} de {questions.length}</p>
        </div>
        {isTimed && (
          <span className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-black ${timeLeft <= 60 ? 'bg-rose-50 text-rose-700' : 'bg-slate-900 text-white'}`}>
            <Clock3 className="h-4 w-4" /> {formatTime(timeLeft)}
          </span>
        )}
      </header>

      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
      </div>

      <main className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <h1 className="whitespace-pre-wrap text-lg font-bold leading-relaxed text-slate-900 sm:text-xl">{currentQuestion.prompt}</h1>

        {currentQuestion.type === 'multiple_choice' && (
          <div className="mt-6 space-y-2.5">
            {currentQuestion.options.map((option) => {
              const selected = currentAnswer?.answer === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => selectAnswer(option.id, option.id === currentQuestion.correctOptionId)}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left text-sm font-semibold transition-all ${
                    selected ? 'border-indigo-500 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-500/15' : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-slate-50'
                  }`}
                >
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-black ${selected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 text-slate-400'}`}>
                    {selected ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : option.id.replace('option-', '')}
                  </span>
                  {option.text}
                </button>
              );
            })}
          </div>
        )}

        {currentQuestion.type === 'true_false' && (
          <div className="mt-6 grid grid-cols-2 gap-3">
            {[true, false].map((value) => {
              const selected = currentAnswer?.answer === value;
              return (
                <button
                  key={String(value)}
                  type="button"
                  onClick={() => selectAnswer(value, value === currentQuestion.correctBoolean)}
                  className={`rounded-2xl border px-4 py-5 text-sm font-black transition-all ${
                    selected ? 'border-indigo-500 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-500/15' : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-slate-50'
                  }`}
                >
                  {value ? 'Verdadero' : 'Falso'}
                </button>
              );
            })}
          </div>
        )}

        {currentQuestion.type === 'open' && (
          <div className="mt-6 space-y-3">
            <textarea
              value={currentAnswer?.answer || ''}
              onChange={(event) => setAnswers((current) => ({
                ...current,
                [currentQuestionId]: { answer: event.target.value, isCorrect: null },
              }))}
              rows={5}
              placeholder="Escribe tu respuesta..."
              className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/10"
            />
            {!revealed ? (
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Revelar respuesta esperada
              </button>
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Respuesta esperada</p>
                <p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-amber-950">{currentQuestion.expectedAnswer}</p>
                <p className="mt-4 text-xs font-medium text-amber-800">¿Tu respuesta fue correcta?</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => selectAnswer(currentAnswer?.answer || '', true)}
                    disabled={!currentAnswer?.answer?.trim()}
                    className={`rounded-xl px-3 py-2.5 text-xs font-bold transition-colors ${
                      currentAnswer?.isCorrect === true ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-45'
                    }`}
                  >
                    Acerté
                  </button>
                  <button
                    type="button"
                    onClick={() => selectAnswer(currentAnswer?.answer || '', false)}
                    disabled={!currentAnswer?.answer?.trim()}
                    className={`rounded-xl px-3 py-2.5 text-xs font-bold transition-colors ${
                      currentAnswer?.isCorrect === false ? 'bg-rose-600 text-white' : 'bg-white text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-45'
                    }`}
                  >
                    No acerté
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>}

      <footer className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={currentIndex === 0 || submitting}
          onClick={() => {
            setCurrentIndex((index) => Math.max(0, index - 1));
            setRevealed(false);
          }}
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" /> Anterior
        </button>
        <button
          type="button"
          disabled={!canContinue || submitting}
          onClick={nextQuestion}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 text-xs font-bold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : currentIndex === questions.length - 1 ? <CheckCircle2 className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {currentIndex === questions.length - 1 ? 'Finalizar' : 'Siguiente'}
        </button>
      </footer>

      {currentIndex < questions.length - 1 && (
        <button
          type="button"
          disabled={submitting}
          onClick={submitAttempt}
          className="mx-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
        >
          <RotateCcw className="h-3 w-3" /> Finalizar ahora
        </button>
      )}
    </div>
  );
}
