import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ClipboardCheck,
  Download,
  Edit3,
  Folder,
  Loader2,
  MoreHorizontal,
  Pencil,
  Play,
  Sparkles,
  Timer,
} from 'lucide-react';
import { getJSON, setJSON } from '../../lib/safeLocalStorage';
import usePdfExport from '../../hooks/usePdfExport';
import AcademicFolderModal from '../library/AcademicFolderModal';
import DeckCard from '../DeckCard';
import PdfExportOverlay from '../PdfExportOverlay';
import ActionSheet from '../common/ActionSheet';
import DeckModal from '../DeckModal';
import ExamCreationWizard from '../exams/ExamCreationWizard';
import ExamQuestionEditor from '../exams/ExamQuestionEditor';
import ExamSessionPlayer from '../exams/ExamSessionPlayer';
import ExamFAB from './ExamFAB';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const QUESTION_TYPE_LABELS = {
  multiple_choice: 'Opción múltiple',
  true_false: 'Verdadero/Falso',
  open: 'Abierta',
};

function normalizeId(value) {
  if (value == null) return null;
  const id = typeof value === 'object' ? value._id ?? value.id ?? value : value;
  return id == null ? null : String(id);
}

function getFolderId(folder) {
  return normalizeId(folder?._id ?? folder?.id);
}

function getExamId(exam) {
  return normalizeId(exam?._id ?? exam?.id);
}

function getParentId(folder) {
  return normalizeId(folder?.parentId);
}

function getExamFolderId(exam) {
  return normalizeId(exam?.folderId);
}

function sortFolders(folders) {
  return [...folders].sort((first, second) => first.name.localeCompare(second.name));
}

function sortExams(exams) {
  return [...exams].sort((first, second) => String(second.createdAt || '').localeCompare(String(first.createdAt || '')));
}

function upsertItem(items, nextItem, getId) {
  const nextId = getId(nextItem);
  return [...items.filter((item) => getId(item) !== nextId), nextItem];
}

async function getErrorMessage(response, fallback) {
  try {
    const payload = await response.json();
    return payload.error || payload.message || fallback;
  } catch {
    return fallback;
  }
}

function getPayloadErrorMessage(payload, fallback) {
  return payload?.error || payload?.message || fallback;
}

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function optionLabel(index) {
  return String.fromCharCode(65 + index);
}

function formatQuestionForExport(question) {
  if (question.type === 'multiple_choice') {
    const choices = (question.options || [])
      .map((option, optionIndex) => `${optionLabel(optionIndex)}. ${option.text}`)
      .join('\n');
    return `${question.prompt}${choices ? `\n\n${choices}` : ''}`;
  }
  return question.prompt;
}

function formatAnswerForExport(question) {
  if (question.type === 'multiple_choice') {
    const correctIndex = question.options?.findIndex((option) => option.id === question.correctOptionId);
    if (!Number.isInteger(correctIndex) || correctIndex < 0) return 'Sin respuesta configurada';
    return `${optionLabel(correctIndex)}. ${question.options[correctIndex].text}`;
  }
  if (question.type === 'true_false') return question.correctBoolean ? 'Verdadero' : 'Falso';
  return question.expectedAnswer || 'Sin respuesta configurada';
}

function defer(callback) {
  window.setTimeout(callback, 0);
}

export default function ExamFoldersView({ userId, onBack, dashboardShell, decks = [], materias = [] }) {
  const foldersCacheKey = `examFolders_${userId}`;
  const examsCacheKey = `exams_${userId}`;
  const cachedFolders = getJSON(foldersCacheKey);
  const cachedExams = getJSON(examsCacheKey);
  const [folders, setFolders] = useState(() => Array.isArray(cachedFolders) ? sortFolders(cachedFolders) : []);
  const [exams, setExams] = useState(() => Array.isArray(cachedExams) ? sortExams(cachedExams) : []);
  const foldersRef = useRef(folders);
  const folderLoadVersionRef = useRef(0);
  const examsLoadVersionRef = useRef(0);
  const [foldersLoading, setFoldersLoading] = useState(() => !Array.isArray(cachedFolders));
  const [examsLoading, setExamsLoading] = useState(() => !Array.isArray(cachedExams));
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [folderModal, setFolderModal] = useState(null);
  const [folderInput, setFolderInput] = useState('');
  const [creationSourceType, setCreationSourceType] = useState(null);
  const [renameExam, setRenameExam] = useState(null);
  const [activeExam, setActiveExam] = useState(null);
  const [reviewFlow, setReviewFlow] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [editorExam, setEditorExam] = useState(null);
  const [editorNotice, setEditorNotice] = useState('');
  const [sessionConfig, setSessionConfig] = useState(null);
  const [feedback, setFeedback] = useState('');
  const pdfExport = usePdfExport();

  const currentFolder = useMemo(
    () => folders.find((folder) => getFolderId(folder) === currentFolderId) || null,
    [folders, currentFolderId]
  );
  const activeFolderMenu = useMemo(
    () => folders.find((folder) => getFolderId(folder) === activeMenuId) || null,
    [activeMenuId, folders]
  );
  const visibleFolders = useMemo(
    () => folders.filter((folder) => getParentId(folder) === currentFolderId),
    [folders, currentFolderId]
  );
  const visibleExams = useMemo(
    () => exams.filter((exam) => getExamFolderId(exam) === currentFolderId),
    [exams, currentFolderId]
  );
  const breadcrumbFolders = useMemo(() => {
    const trail = [];
    const visited = new Set();
    let folder = currentFolder;

    while (folder && !visited.has(getFolderId(folder))) {
      trail.unshift(folder);
      visited.add(getFolderId(folder));
      folder = folders.find((candidate) => getFolderId(candidate) === getParentId(folder)) || null;
    }

    return trail;
  }, [currentFolder, folders]);
  const canCreateFolder = !currentFolder || getParentId(currentFolder) === null;

  const saveFolders = useCallback((nextFolders) => {
    const sortedFolders = sortFolders(nextFolders);
    foldersRef.current = sortedFolders;
    setFolders(sortedFolders);
    setJSON(foldersCacheKey, sortedFolders);
  }, [foldersCacheKey]);

  const saveExams = useCallback((nextExams) => {
    const sortedExams = sortExams(nextExams);
    setExams(sortedExams);
    setJSON(examsCacheKey, sortedExams);
  }, [examsCacheKey]);

  const refreshExams = useCallback(async () => {
    const loadVersion = ++examsLoadVersionRef.current;
    setExamsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/exams/user/${encodeURIComponent(userId)}?t=${Date.now()}`, {
        headers: { 'X-User-Id': userId },
      });
      if (!response.ok) throw new Error();
      const payload = await response.json();
      if (!Array.isArray(payload)) throw new Error();
      if (loadVersion !== examsLoadVersionRef.current) return;
      saveExams(payload);
    } catch {
      // Keep the local cache available when the API cannot be reached.
    } finally {
      if (loadVersion === examsLoadVersionRef.current) setExamsLoading(false);
    }
  }, [saveExams, userId]);

  useEffect(() => {
    const controller = new AbortController();
    const loadVersion = ++folderLoadVersionRef.current;

    const loadFolders = async () => {
      setFoldersLoading(true);
      try {
        const response = await fetch(`${BACKEND_URL}/api/exam-folders/${userId}?t=${Date.now()}`, {
          signal: controller.signal,
          headers: { 'X-User-Id': userId },
        });
        if (!response.ok) throw new Error();

        const payload = await response.json();
        if (!Array.isArray(payload)) throw new Error();
        if (controller.signal.aborted || loadVersion !== folderLoadVersionRef.current) return;
        saveFolders(payload);
      } catch (error) {
        if (error.name !== 'AbortError') {
          // Keep the last safe cache when the server cannot be reached.
        }
      } finally {
        if (!controller.signal.aborted && loadVersion === folderLoadVersionRef.current) setFoldersLoading(false);
      }
    };

    loadFolders();
    return () => controller.abort();
  }, [saveFolders, userId]);

  useEffect(() => {
    refreshExams();
  }, [refreshExams]);

  useEffect(() => {
    if (currentFolderId && !currentFolder) setCurrentFolderId(null);
  }, [currentFolder, currentFolderId]);

  const updateExamInState = (nextExam) => {
    examsLoadVersionRef.current += 1;
    setExamsLoading(false);
    setExams((current) => {
      const next = sortExams(upsertItem(current, nextExam, getExamId));
      setJSON(examsCacheKey, next);
      return next;
    });
  };

  const removeExamFromState = (examId) => {
    examsLoadVersionRef.current += 1;
    setExamsLoading(false);
    setExams((current) => {
      const next = current.filter((exam) => getExamId(exam) !== examId);
      setJSON(examsCacheKey, next);
      return next;
    });
  };

  const openCreateFolder = () => {
    if (!canCreateFolder) return;
    setFolderInput('');
    setFolderModal({ type: 'exam-folder' });
  };

  const openRenameFolder = (folder) => {
    setActiveMenuId(null);
    setFolderInput(folder.name);
    setFolderModal({ type: 'exam-folder', editing: folder });
  };

  const handleCreateFolder = async (event) => {
    event.preventDefault();
    if (!canCreateFolder) {
      setFolderInput('');
      setFolderModal(null);
      setFeedback('No se pueden crear subcarpetas dentro de otra subcarpeta.');
      return;
    }
    const name = folderInput.trim();
    if (!name) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/exam-folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({ userId, name, parentId: currentFolderId }),
      });
      if (!response.ok) {
        setFeedback(await getErrorMessage(response, 'No se pudo crear la carpeta.'));
        return;
      }

      const savedFolder = await response.json();
      folderLoadVersionRef.current += 1;
      saveFolders(upsertItem(foldersRef.current, savedFolder, getFolderId));
      setFoldersLoading(false);
      setFolderInput('');
      setFolderModal(null);
    } catch {
      setFeedback('Error de conexión al crear la carpeta.');
    }
  };

  const handleRenameFolder = async (event) => {
    event.preventDefault();
    const name = folderInput.trim();
    const editing = folderModal?.editing;
    if (!name || !editing) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/exam-folders/${getFolderId(editing)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({ userId, name }),
      });
      if (!response.ok) {
        setFeedback(await getErrorMessage(response, 'No se pudo renombrar la carpeta.'));
        return;
      }

      const updatedFolder = await response.json();
      folderLoadVersionRef.current += 1;
      saveFolders(upsertItem(foldersRef.current, updatedFolder, getFolderId));
      setFoldersLoading(false);
      setFolderInput('');
      setFolderModal(null);
    } catch {
      setFeedback('Error de conexión al renombrar la carpeta.');
    }
  };

  const handleRenameExam = async ({ title }) => {
    const examId = getExamId(renameExam);
    const response = await fetch(`${BACKEND_URL}/api/exams/${encodeURIComponent(examId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, title }),
    });
    if (!response.ok) throw new Error(await getErrorMessage(response, 'No se pudo renombrar el examen.'));
    const updatedExam = await response.json();
    updateExamInState(updatedExam);
    setRenameExam(null);
  };

  const deleteExam = async (exam) => {
    if (!window.confirm(`¿Eliminar "${exam.title}" y todas sus preguntas?`)) return;
    const examId = getExamId(exam);
    try {
      const response = await fetch(`${BACKEND_URL}/api/exams/${encodeURIComponent(examId)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) throw new Error(await getErrorMessage(response, 'No se pudo eliminar el examen.'));
      removeExamFromState(examId);
    } catch (deleteError) {
      setFeedback(deleteError.message || 'No se pudo eliminar el examen.');
    }
  };

  const toggleExamStar = async (exam) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/exams/${encodeURIComponent(getExamId(exam))}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isStarred: !exam.isStarred }),
      });
      if (!response.ok) throw new Error(await getErrorMessage(response, 'No se pudo actualizar el examen.'));
      updateExamInState(await response.json());
    } catch (toggleError) {
      setFeedback(toggleError.message || 'No se pudo actualizar el examen.');
    }
  };

  const loadQuestionTypes = async (exam, mode) => {
    setReviewLoading(true);
    setFeedback('');
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/exams/${encodeURIComponent(getExamId(exam))}/questions?userId=${encodeURIComponent(userId)}`
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(payload)) {
        throw new Error(getPayloadErrorMessage(payload, 'No se pudieron cargar los tipos de preguntas.'));
      }
      const types = [...new Set(payload.map((question) => question.type))].filter((type) => QUESTION_TYPE_LABELS[type]);
      if (types.length === 0) throw new Error('Este examen todavía no tiene preguntas para repasar.');
      setReviewFlow({ exam, stage: 'type', mode, types });
    } catch (loadError) {
      setFeedback(loadError.message || 'No se pudieron cargar los tipos de preguntas.');
    } finally {
      setReviewLoading(false);
    }
  };

  const downloadExam = async (exam) => {
    setFeedback('');
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/exams/${encodeURIComponent(getExamId(exam))}/questions?userId=${encodeURIComponent(userId)}`
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(payload)) {
        throw new Error(getPayloadErrorMessage(payload, 'No se pudieron cargar las preguntas para descargar.'));
      }
      if (payload.length === 0) throw new Error('Este examen no tiene preguntas para descargar.');

      await pdfExport.exportPdf({
        deck: { title: exam.title },
        type: 'exam_questions',
        cards: payload.map((question) => {
          const options = question.type === 'multiple_choice'
            ? shuffle(question.options || [])
            : question.options;
          const exportQuestion = { ...question, options };
          return {
            id: getExamId(question),
            question: formatQuestionForExport(exportQuestion),
            answer: formatAnswerForExport(exportQuestion),
          };
        }),
      });
    } catch (downloadError) {
      setFeedback(downloadError.message || 'No se pudo descargar el examen.');
    }
  };

  const handleBack = () => {
    if (currentFolder) {
      setCurrentFolderId(getParentId(currentFolder));
    } else {
      onBack();
    }
  };

  if (creationSourceType) {
    return (
      <ExamCreationWizard
        userId={userId}
        folderId={currentFolderId}
        sourceType={creationSourceType}
        decks={decks.filter((deck) => normalizeId(deck.userId) === normalizeId(userId))}
        materias={materias}
        onClose={() => setCreationSourceType(null)}
        onCreated={(exam, options = {}) => {
          updateExamInState(exam);
          setCreationSourceType(null);
          if (options.openEditor) {
            setEditorNotice(options.warning || '');
            setEditorExam(exam);
          }
        }}
      />
    );
  }

  if (editorExam) {
    return (
      <ExamQuestionEditor
        exam={editorExam}
        userId={userId}
        notice={editorNotice}
        onBack={() => {
          setEditorNotice('');
          setEditorExam(null);
          refreshExams();
        }}
        onExamChange={(nextExam) => {
          setEditorExam(nextExam);
          updateExamInState(nextExam);
        }}
      />
    );
  }

  if (sessionConfig) {
    return (
      <ExamSessionPlayer
        examId={getExamId(sessionConfig.exam)}
        userId={userId}
        mode={sessionConfig.mode}
        questionTypeFilter={sessionConfig.questionTypeFilter}
        onExit={() => setSessionConfig(null)}
      />
    );
  }

  return (
    <div className="space-y-6 animate-[fadeIn_0.15s_ease]">
      <div className="flex items-center gap-3 border-b border-slate-200/60 pb-4">
        <button
          type="button"
          onClick={handleBack}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-3xs transition-all hover:bg-slate-50 active:scale-95"
          title={currentFolder ? 'Volver a la carpeta anterior' : 'Volver a categorías'}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <h1 className="text-xl font-black tracking-tight text-slate-900">Exámenes</h1>
          {breadcrumbFolders.length > 0 && (
            <div className="mt-1 flex whitespace-nowrap overflow-x-auto text-xs font-medium text-slate-500">
              <button type="button" onClick={() => setCurrentFolderId(null)} className="hover:text-slate-800">Exámenes</button>
              {breadcrumbFolders.map((folder) => (
                <span key={getFolderId(folder)} className="flex items-center gap-1">
                  <span className="px-1 text-slate-400">/</span>
                  <button type="button" onClick={() => setCurrentFolderId(getFolderId(folder))} className="truncate hover:text-slate-800">
                    {folder.name}
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {feedback && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback('')} className="shrink-0 underline">Cerrar</button>
        </div>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            {currentFolder ? currentFolder.name : 'Carpetas'} ({visibleFolders.length})
          </h2>
        </div>

        {foldersLoading && folders.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-10 text-xs font-medium text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-500" /> Cargando carpetas...
          </div>
        ) : visibleFolders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-white py-8 text-center text-xs font-medium text-zinc-400 shadow-xs">
            {currentFolder ? 'No hay subcarpetas aquí.' : 'No tienes carpetas de exámenes todavía.'}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
            {visibleFolders.map((folder) => {
              const folderId = getFolderId(folder);
              return (
                <div key={folderId} className="group relative">
                  <button
                    type="button"
                    onClick={() => setCurrentFolderId(folderId)}
                    className="relative flex h-28 w-full flex-col justify-end overflow-hidden rounded-2xl border border-zinc-200 bg-white text-left shadow-sm transition-all hover:shadow-md"
                  >
                    <span className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100">
                      <Folder className="h-4 w-4 text-zinc-600" />
                    </span>
                    <span className="w-full min-w-0 p-3.5 pt-10 text-sm font-bold leading-snug text-zinc-800 line-clamp-2">{folder.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveMenuId(folderId)}
                    className="absolute right-2.5 top-2.5 z-30 flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100/80 text-zinc-600 shadow-xs transition-all hover:bg-zinc-200"
                    aria-label={`Abrir acciones de ${folder.name}`}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Exámenes ({visibleExams.length})</h2>
        </div>

        {examsLoading && exams.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-10 text-xs font-medium text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-500" /> Cargando exámenes...
          </div>
        ) : visibleExams.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-10 text-center text-xs font-medium text-slate-400">
            {currentFolder ? 'Esta carpeta todavía no tiene exámenes.' : 'Crea tu primer examen desde el botón inferior.'}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visibleExams.map((exam) => (
              <DeckCard
                key={getExamId(exam)}
                deck={{ ...exam, cardCount: exam.questionCount, coverColor: '#4f46e5' }}
                countLabel="preguntas"
                currentUserId={userId}
                isAdmin={false}
                onOpen={() => setActiveExam(exam)}
                onEdit={() => setRenameExam(exam)}
                onDelete={() => deleteExam(exam)}
                onToggleStar={() => toggleExamStar(exam)}
              />
            ))}
          </div>
        )}
      </section>

      <ActionSheet
        open={Boolean(activeFolderMenu)}
        title={activeFolderMenu ? `Acciones de ${activeFolderMenu.name}` : 'Acciones de carpeta'}
        options={activeFolderMenu ? [{
          id: 'edit',
          label: 'Editar nombre',
          icon: Pencil,
          onSelect: () => openRenameFolder(activeFolderMenu),
        }] : []}
        onClose={() => setActiveMenuId(null)}
      />

      {folderModal && (
        <AcademicFolderModal
          academicModal={folderModal}
          academicInput={folderInput}
          setAcademicInput={setFolderInput}
          setAcademicModal={setFolderModal}
          handleCreateAcademicFolder={handleCreateFolder}
          handleUpdateAcademicFolder={handleRenameFolder}
        />
      )}

      {renameExam && (
        <DeckModal
          initial={{ title: renameExam.title }}
          nameOnly
          entityLabel="examen"
          onClose={() => setRenameExam(null)}
          onSave={handleRenameExam}
        />
      )}

      <ActionSheet
        open={Boolean(activeExam)}
        title={activeExam?.title || 'Examen'}
        onClose={() => setActiveExam(null)}
        options={[
          {
            id: 'editor',
            label: 'Editor',
            description: 'Añade, edita y organiza las preguntas.',
            icon: Edit3,
            onSelect: () => defer(() => {
              setEditorNotice('');
              setEditorExam(activeExam);
            }),
          },
          {
            id: 'review',
            label: 'Repasar',
            description: 'Realiza el examen o descarga sus preguntas.',
            icon: ClipboardCheck,
            onSelect: () => defer(() => setReviewFlow({ exam: activeExam, stage: 'mode' })),
          },
        ]}
      />

      <ActionSheet
        open={reviewFlow?.stage === 'mode'}
        title="Modo de repaso"
        onClose={() => setReviewFlow(null)}
        options={[
          {
            id: 'quick',
            label: 'Quiz rápido',
            description: 'Elige un tipo de pregunta y practica sin límite de tiempo.',
            icon: Play,
            onSelect: () => loadQuestionTypes(reviewFlow.exam, 'quick'),
          },
          {
            id: 'timed',
            label: 'Quiz cronometrado',
            description: 'Tiempo total: 60 segundos por cada pregunta, con autocalificación para abiertas.',
            icon: Timer,
            onSelect: () => loadQuestionTypes(reviewFlow.exam, 'timed'),
          },
          {
            id: 'variado',
            label: 'Variado',
            description: 'Mezcla todos los tipos de pregunta disponibles.',
            icon: Sparkles,
            onSelect: () => defer(() => setReviewFlow({
              exam: reviewFlow.exam,
              stage: 'start',
              mode: 'variado',
              questionTypeFilter: null,
            })),
          },
        ]}
      />

      <ActionSheet
        open={reviewFlow?.stage === 'type'}
        title="Tipo de pregunta"
        onClose={() => setReviewFlow(null)}
        options={(reviewFlow?.types || []).map((type) => ({
          id: type,
          label: QUESTION_TYPE_LABELS[type],
          icon: type === 'multiple_choice' ? ClipboardCheck : type === 'true_false' ? Sparkles : Edit3,
          onSelect: () => defer(() => setReviewFlow({
            exam: reviewFlow.exam,
            stage: 'start',
            mode: reviewFlow.mode,
            questionTypeFilter: type,
          })),
        }))}
      />

      <ActionSheet
        open={reviewFlow?.stage === 'start'}
        title="Antes de empezar"
        onClose={() => setReviewFlow(null)}
        options={[
          {
            id: 'take',
            label: 'Realizar examen',
            description: reviewFlow?.mode === 'timed' ? 'El temporizador comenzará al abrirlo.' : 'Comienza cuando estés listo.',
            icon: Play,
            onSelect: () => defer(() => setSessionConfig({
              exam: reviewFlow.exam,
              mode: reviewFlow.mode,
              questionTypeFilter: reviewFlow.questionTypeFilter,
            })),
          },
          {
            id: 'download',
            label: 'Descargar',
            description: 'Genera un PDF con todas las preguntas del examen.',
            icon: Download,
            disabled: pdfExport.isExporting,
            onSelect: () => defer(() => downloadExam(reviewFlow.exam)),
          },
        ]}
      />

      {reviewLoading && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/20 px-4">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-xl">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-500" /> Cargando tipos de pregunta...
          </div>
        </div>
      )}

      <PdfExportOverlay
        isOpen={pdfExport.isExporting}
        progress={pdfExport.progress}
        onCancel={pdfExport.cancel}
      />

      <ExamFAB
        isInsideFolder={Boolean(currentFolder)}
        canCreateFolder={canCreateFolder}
        onCreateFolder={openCreateFolder}
        onCreateScratch={() => setCreationSourceType('scratch')}
        onCreateFromDecks={() => setCreationSourceType('from_deck')}
        dashboardShell={dashboardShell}
      />
    </div>
  );
}
