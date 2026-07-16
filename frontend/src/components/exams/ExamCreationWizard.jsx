import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Edit3, Layers, Loader2, Sparkles } from 'lucide-react';
import { readAiGenerationProgress } from '../../lib/aiProgressStream';
import { getJSON, remove, setJSON } from '../../lib/safeLocalStorage';
import ActionSheet from '../common/ActionSheet';
import DeckModal from '../DeckModal';
import StudyDeckSelector from '../study/StudyDeckSelector';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const DRAFT_KEY = 'ufc_exam_draft_v1';

function getDeckId(deck) {
  return String(deck?.id || deck?._id || '');
}

function getExamId(exam) {
  return String(exam?.id || exam?._id || '');
}

function readDraft(userId, sourceType, folderId, decks) {
  const draft = getJSON(DRAFT_KEY);
  if (!draft || draft.userId !== userId || draft.sourceType !== sourceType || String(draft.folderId || '') !== String(folderId || '')) {
    return null;
  }

  const selectedDecks = new Map();
  for (const selected of Array.isArray(draft.selectedDecks) ? draft.selectedDecks : []) {
    const deck = decks.find((item) => getDeckId(item) === String(selected.deckId || ''));
    if (deck) {
      selectedDecks.set(getDeckId(deck), {
        deck,
        questionCount: Number.isInteger(selected.questionCount) ? selected.questionCount : 1,
      });
    }
  }

  return {
    title: typeof draft.title === 'string' ? draft.title : '',
    stage: ['name', 'select', 'allocate'].includes(draft.stage) ? draft.stage : 'name',
    selectedDecks,
  };
}

async function readError(response, fallback) {
  const payload = await response.json().catch(() => null);
  return payload?.error || payload?.message || fallback;
}

export default function ExamCreationWizard({
  userId,
  folderId = null,
  sourceType,
  decks,
  materias,
  onClose,
  onCreated,
}) {
  const draft = readDraft(userId, sourceType, folderId, decks);
  const [stage, setStage] = useState(() => draft?.stage || 'name');
  const [title, setTitle] = useState(() => draft?.title || '');
  const [selectedDecks, setSelectedDecks] = useState(() => draft?.selectedDecks || new Map());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [generationProgress, setGenerationProgress] = useState(null);

  const selectedEntries = useMemo(() => Array.from(selectedDecks.values()), [selectedDecks]);
  const totalQuestions = useMemo(
    () => selectedEntries.reduce((total, entry) => total + (Number(entry.questionCount) || 0), 0),
    [selectedEntries]
  );
  const allocationError = useMemo(() => {
    if (selectedEntries.length === 0) return 'Selecciona al menos un mazo.';
    if (totalQuestions > 100) return 'Un examen puede tener como máximo 100 preguntas.';
    if (selectedEntries.some((entry) => !Number.isInteger(Number(entry.questionCount)) || Number(entry.questionCount) < 1)) {
      return 'Cada mazo debe aportar al menos una pregunta.';
    }
    if (selectedEntries.some((entry) => Number(entry.questionCount) > Number(entry.deck.cardCount || 0))) {
      return 'No puedes pedir más preguntas que tarjetas disponibles en un mazo.';
    }
    return '';
  }, [selectedEntries, totalQuestions]);

  useEffect(() => {
    setJSON(DRAFT_KEY, {
      userId,
      folderId,
      sourceType,
      stage,
      title,
      selectedDecks: selectedEntries.map((entry) => ({
        deckId: getDeckId(entry.deck),
        questionCount: Number(entry.questionCount) || 0,
      })),
    });
  }, [folderId, selectedEntries, sourceType, stage, title, userId]);

  const createScratchExam = async (nextTitle) => {
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`${BACKEND_URL}/api/exams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          title: nextTitle,
          folderId,
          sourceType: 'scratch',
        }),
      });
      if (!response.ok) throw new Error(await readError(response, 'No se pudo crear el examen.'));
      const exam = await response.json();
      remove(DRAFT_KEY);
      onCreated?.(exam, { openEditor: true });
    } finally {
      setSaving(false);
    }
  };

  const handleNameSave = async ({ title: nextTitle }) => {
    setTitle(nextTitle);
    if (sourceType === 'scratch') {
      try {
        await createScratchExam(nextTitle);
      } catch (createError) {
        setError(createError.message || 'No se pudo crear el examen.');
        throw createError;
      }
      return;
    }
    setStage('select');
  };

  const toggleDeck = (deck) => {
    const deckId = getDeckId(deck);
    if (!deckId) return;
    if (Number(deck.cardCount || 0) < 1) {
      setError('Ese mazo no tiene tarjetas disponibles para crear preguntas.');
      return;
    }

    setError('');
    setSelectedDecks((current) => {
      const next = new Map(current);
      if (next.has(deckId)) {
        next.delete(deckId);
      } else {
        next.set(deckId, { deck, questionCount: 1 });
      }
      return next;
    });
  };

  const updateQuestionCount = (deckId, value) => {
    const count = Number.parseInt(value, 10);
    setSelectedDecks((current) => {
      const entry = current.get(deckId);
      if (!entry) return current;
      const next = new Map(current);
      next.set(deckId, { ...entry, questionCount: Number.isNaN(count) ? 0 : count });
      return next;
    });
  };

  const createFromDecks = async (generation) => {
    if (allocationError) {
      setError(allocationError);
      return;
    }

    setSaving(true);
    setError('');
    setGenerationProgress(generation === 'ai'
      ? { completed: 0, total: totalQuestions, message: 'Preparando la generación con IA...' }
      : null);
    let createdExam = null;
    let generationWarning = '';
    try {
      const response = await fetch(`${BACKEND_URL}/api/exams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          title,
          folderId,
          sourceType: 'from_deck',
          sourceDecks: selectedEntries.map((entry) => ({
            deckId: getDeckId(entry.deck),
            questionCount: Number(entry.questionCount),
          })),
        }),
      });
      if (!response.ok) throw new Error(await readError(response, 'No se pudo crear el examen.'));
      let exam = await response.json();
      createdExam = exam;

      if (generation === 'deck_data') {
        const generatedResponse = await fetch(
          `${BACKEND_URL}/api/exams/${encodeURIComponent(getExamId(exam))}/generate-from-decks`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, type: 'multiple_choice' }),
          }
        );
        if (!generatedResponse.ok) throw new Error(await readError(generatedResponse, 'No se pudieron generar las preguntas.'));
        const generated = await generatedResponse.json();
        exam = { ...exam, questionCount: generated.questionCount ?? exam.questionCount };
        generationWarning = generated.warnings?.[0]?.message || '';
      }

      if (generation === 'ai') {
        const generatedResponse = await fetch(`${BACKEND_URL}/api/exams/generate-questions-ai`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({ userId, examId: getExamId(exam), type: 'multiple_choice' }),
        });
        if (!generatedResponse.ok) throw new Error(await readError(generatedResponse, 'La IA no pudo generar las preguntas.'));
        const generated = await readAiGenerationProgress(generatedResponse, setGenerationProgress);
        exam = { ...exam, questionCount: generated.questionCount ?? exam.questionCount };
      }

      remove(DRAFT_KEY);
      onCreated?.(exam, { openEditor: true, warning: generationWarning });
    } catch (createError) {
      if (createdExam && generation === 'ai') {
        const partialQuestionCount = Number(createError.partialQuestionCount) || 0;
        const preservedMessage = partialQuestionCount > 0
          ? `${createError.message || 'La IA no pudo terminar.'} Se conservaron ${partialQuestionCount} preguntas para que puedas revisarlas.`
          : `${createError.message || 'La IA no pudo terminar.'} El examen se conservó para evitar perder cualquier avance.`;
        remove(DRAFT_KEY);
        onCreated?.(
          { ...createdExam, questionCount: partialQuestionCount },
          { openEditor: true, warning: preservedMessage }
        );
        return;
      }
      if (createdExam) {
        try {
          await fetch(`${BACKEND_URL}/api/exams/${encodeURIComponent(getExamId(createdExam))}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
          });
        } catch {
          // A later refresh will surface the incomplete exam if cleanup cannot reach the API.
        }
      }
      setError(createError.message || 'No se pudo crear el examen.');
    } finally {
      setSaving(false);
      setGenerationProgress(null);
    }
  };

  if (stage === 'name') {
    return (
      <>
        <DeckModal
          initial={title ? { title } : null}
          nameOnly
          entityLabel="examen"
          onClose={onClose}
          onSave={handleNameSave}
        />
        {error && <p className="fixed bottom-4 left-4 right-4 z-[90] rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-center text-xs font-semibold text-rose-700">{error}</p>}
      </>
    );
  }

  if (stage === 'select') {
    return (
      <div className="space-y-3 animate-[fadeIn_0.15s_ease]">
        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>}
        <StudyDeckSelector
          decks={decks}
          materias={materias}
          modeLabel="Crear examen"
          onBack={onClose}
          onSelectDeck={() => {}}
          selectionMode
          selectedDecks={selectedDecks}
          onToggleDeck={toggleDeck}
          onConfirmSelection={() => {
            setError('');
            setStage('allocate');
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-[fadeIn_0.15s_ease]">
      <header className="flex items-center gap-3 border-b border-slate-200/60 pb-4">
        <button
          type="button"
          onClick={() => setStage('select')}
          disabled={saving}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-3xs transition-all hover:bg-slate-50 disabled:opacity-50"
          aria-label="Volver a seleccionar mazos"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Distribución de preguntas</p>
          <h1 className="truncate text-xl font-black tracking-tight text-slate-900">{title}</h1>
        </div>
      </header>

      {saving && generationProgress && (
        <section
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 shadow-sm"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-600" aria-hidden="true" />
              <p className="truncate text-sm font-bold text-indigo-950">{generationProgress.message}</p>
            </div>
            <span className="shrink-0 text-sm font-black tabular-nums text-indigo-700">
              {generationProgress.completed}/{generationProgress.total}
            </span>
          </div>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-indigo-200/70"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={generationProgress.total}
            aria-valuenow={generationProgress.completed}
            aria-label="Preguntas generadas"
          >
            <div
              className="h-full rounded-full bg-indigo-600 transition-[width] duration-300"
              style={{ width: `${generationProgress.total ? (generationProgress.completed / generationProgress.total) * 100 : 0}%` }}
            />
          </div>
          <p className="mt-2 text-xs font-medium text-indigo-700">
            Puedes mantener esta pantalla abierta mientras terminamos cada lote.
          </p>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Preguntas por mazo</h2>
            <p className="mt-1 text-xs font-medium text-slate-500">Elige cuántas tarjetas de cada mazo entrarán al examen.</p>
          </div>
          <span className={`shrink-0 rounded-lg px-2 py-1 text-xs font-black ${totalQuestions > 100 ? 'bg-rose-50 text-rose-700' : 'bg-indigo-50 text-indigo-700'}`}>
            {totalQuestions}/100
          </span>
        </div>

        <div className="space-y-2.5">
          {selectedEntries.map((entry) => {
            const deckId = getDeckId(entry.deck);
            const cardCount = Number(entry.deck.cardCount || 0);
            return (
              <label key={deckId} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-slate-800">{entry.deck.title}</span>
                  <span className="mt-0.5 block text-[11px] font-medium text-slate-500">{cardCount} tarjeta{cardCount === 1 ? '' : 's'} disponibles</span>
                </span>
                <input
                  type="number"
                  min="1"
                  max={Math.min(cardCount, 100)}
                  value={entry.questionCount}
                  onChange={(event) => updateQuestionCount(deckId, event.target.value)}
                  disabled={saving}
                  className="h-10 w-20 rounded-xl border border-slate-200 bg-white px-2 text-center text-sm font-bold text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10"
                  aria-label={`Preguntas de ${entry.deck.title}`}
                />
              </label>
            );
          })}
        </div>

        {(allocationError || error) && (
          <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
            {error || allocationError}
          </p>
        )}

        <button
          type="button"
          disabled={Boolean(allocationError) || saving}
          onClick={() => {
            setError('');
            setStage('action');
          }}
          className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-xs font-bold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saving && generationProgress ? 'Generando preguntas...' : 'Continuar'}
        </button>
      </section>

      <ActionSheet
        open={stage === 'action'}
        title="Crear preguntas"
        onClose={() => setStage('allocate')}
        options={[
          {
            id: 'editor',
            label: 'Pasar al editor',
            description: 'Crea el examen vacío para escribir las preguntas manualmente.',
            icon: Edit3,
            disabled: saving,
            onSelect: () => createFromDecks('editor'),
          },
          {
            id: 'ai',
            label: 'Autogenerar con IA',
            description: 'Crea preguntas con distractores generados a partir de tus tarjetas.',
            icon: Sparkles,
            disabled: saving,
            onSelect: () => createFromDecks('ai'),
          },
          {
            id: 'deck_data',
            label: 'Autogenerar con datos del mazo',
            description: 'Usa las respuestas de otras tarjetas como distractores.',
            icon: Layers,
            disabled: saving,
            onSelect: () => createFromDecks('deck_data'),
          },
        ]}
      />
    </div>
  );
}
