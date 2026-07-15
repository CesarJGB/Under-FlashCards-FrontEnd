import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, Folder, Loader2, MoreHorizontal, Pencil } from 'lucide-react';
import { getJSON, setJSON } from '../../lib/safeLocalStorage';
import AcademicFolderModal from '../library/AcademicFolderModal';
import ExamFAB from './ExamFAB';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

function getFolderId(folder) {
  return folder ? String(folder._id || folder.id) : null;
}

function getParentId(folder) {
  if (!folder?.parentId) return null;
  if (typeof folder.parentId === 'object') {
    return String(folder.parentId._id || folder.parentId.id);
  }
  return String(folder.parentId);
}

function sortFolders(folders) {
  return [...folders].sort((first, second) => first.name.localeCompare(second.name));
}

async function getErrorMessage(response, fallback) {
  try {
    const payload = await response.json();
    return payload.error || fallback;
  } catch {
    return fallback;
  }
}

export default function ExamFoldersView({ userId, onBack, dashboardShell }) {
  const cacheKey = `examFolders_${userId}`;
  const cachedFolders = getJSON(cacheKey);
  const [folders, setFolders] = useState(() => Array.isArray(cachedFolders) ? sortFolders(cachedFolders) : []);
  const [loading, setLoading] = useState(() => !Array.isArray(cachedFolders));
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [folderModal, setFolderModal] = useState(null);
  const [folderInput, setFolderInput] = useState('');

  const currentFolder = useMemo(
    () => folders.find((folder) => getFolderId(folder) === currentFolderId) || null,
    [folders, currentFolderId]
  );
  const visibleFolders = useMemo(
    () => folders.filter((folder) => getParentId(folder) === currentFolderId),
    [folders, currentFolderId]
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

  const saveFolders = (nextFolders) => {
    const sortedFolders = sortFolders(nextFolders);
    setFolders(sortedFolders);
    setJSON(cacheKey, sortedFolders);
  };

  useEffect(() => {
    const controller = new AbortController();

    const loadFolders = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${BACKEND_URL}/api/exam-folders/${userId}?t=${Date.now()}`, {
          signal: controller.signal,
          headers: { 'X-User-Id': userId },
        });
        if (!response.ok) throw new Error();

        const data = await response.json();
        if (!Array.isArray(data)) throw new Error();
        saveFolders(data);
      } catch (error) {
        if (error.name !== 'AbortError') {
          // Keep the last safe cache when the server cannot be reached.
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    loadFolders();
    return () => controller.abort();
  }, [cacheKey, userId]);

  useEffect(() => {
    if (currentFolderId && !currentFolder) setCurrentFolderId(null);
  }, [currentFolder, currentFolderId]);

  const openCreateFolder = () => {
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
    const name = folderInput.trim();
    if (!name) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/exam-folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({ userId, name, parentId: currentFolderId }),
      });
      if (!response.ok) {
        alert(await getErrorMessage(response, 'No se pudo crear la carpeta.'));
        return;
      }

      const savedFolder = await response.json();
      saveFolders([...folders, savedFolder]);
      setFolderInput('');
      setFolderModal(null);
      setCurrentFolderId(getFolderId(savedFolder));
    } catch {
      alert('Error de conexión al crear la carpeta.');
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
        alert(await getErrorMessage(response, 'No se pudo renombrar la carpeta.'));
        return;
      }

      const updatedFolder = await response.json();
      saveFolders(folders.map((folder) => (
        getFolderId(folder) === getFolderId(updatedFolder) ? updatedFolder : folder
      )));
      setFolderInput('');
      setFolderModal(null);
    } catch {
      alert('Error de conexión al renombrar la carpeta.');
    }
  };

  const handleBack = () => {
    if (currentFolder) {
      setCurrentFolderId(getParentId(currentFolder));
    } else {
      onBack();
    }
  };

  return (
    <div className="space-y-6 animate-[fadeIn_0.15s_ease]">
      <div className="flex items-center gap-3 border-b border-slate-200/60 pb-4">
        <button
          type="button"
          onClick={handleBack}
          className="h-9 w-9 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl flex items-center justify-center text-slate-600 active:scale-95 transition-all cursor-pointer shadow-3xs"
          title={currentFolder ? 'Volver a la carpeta anterior' : 'Volver a categorías'}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0">
          <h1 className="text-xl font-black tracking-tight text-slate-900">Exámenes</h1>
          {breadcrumbFolders.length > 0 && (
            <div className="mt-1 flex items-center gap-1 overflow-x-auto text-xs font-medium text-slate-500 whitespace-nowrap">
              <button type="button" onClick={() => setCurrentFolderId(null)} className="hover:text-slate-800 transition-colors">
                Exámenes
              </button>
              {breadcrumbFolders.map((folder) => (
                <span key={getFolderId(folder)} className="flex items-center gap-1">
                  <ChevronRight className="w-3 h-3 text-slate-400" />
                  <button
                    type="button"
                    onClick={() => setCurrentFolderId(getFolderId(folder))}
                    className="truncate hover:text-slate-800 transition-colors"
                  >
                    {folder.name}
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            {currentFolder ? currentFolder.name : 'Tus carpetas'} ({visibleFolders.length})
          </h2>
        </div>

        {loading && folders.length === 0 ? (
          <div className="flex items-center justify-center py-12 gap-2 text-zinc-400 text-xs font-medium">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
            Cargando carpetas…
          </div>
        ) : visibleFolders.length === 0 ? (
          <div className="text-center border border-dashed border-zinc-200 rounded-2xl py-12 bg-white text-zinc-400 text-xs font-medium shadow-xs">
            {currentFolder
              ? 'Esta carpeta está vacía. Usa el botón inferior para crear una subcarpeta.'
              : 'No tienes carpetas de exámenes. Usa el botón inferior para añadir una.'}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {visibleFolders.map((folder) => {
              const folderId = getFolderId(folder);
              const isMenuOpen = activeMenuId === folderId;

              return (
                <div key={folderId} className="relative group">
                  <button
                    type="button"
                    onClick={() => setCurrentFolderId(folderId)}
                    className="w-full text-left h-28 rounded-2xl border border-zinc-200 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-end overflow-hidden bg-white relative"
                  >
                    <div className="absolute top-3 left-3">
                      <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center">
                        <Folder className="w-4 h-4 text-zinc-600 stroke-[2]" />
                      </div>
                    </div>
                    <div className="p-3.5 pt-10 w-full min-w-0">
                      <p className="font-bold text-sm leading-snug line-clamp-2 text-zinc-800">{folder.name}</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveMenuId(isMenuOpen ? null : folderId)}
                    className={`absolute top-2.5 right-2.5 z-30 p-1.5 rounded-lg shadow-xs flex items-center justify-center transition-all cursor-pointer ${
                      isMenuOpen ? 'bg-zinc-200 text-zinc-900' : 'bg-zinc-100/80 text-zinc-600 hover:bg-zinc-200'
                    }`}
                    aria-label={`Editar ${folder.name}`}
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>

                  {isMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-20 bg-transparent" onClick={() => setActiveMenuId(null)} />
                      <div className="absolute right-2 top-10 w-44 bg-white border border-zinc-200 rounded-xl shadow-xl p-1 z-50 animate-[slideUp_0.1s_ease-out]">
                        <button
                          type="button"
                          onClick={() => openRenameFolder(folder)}
                          className="w-full text-left px-2 py-1.5 hover:bg-zinc-50 text-zinc-700 text-[11px] font-bold rounded-lg flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5 text-zinc-400" />
                          Editar nombre
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

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

      <ExamFAB
        isInsideFolder={!!currentFolder}
        onCreateFolder={openCreateFolder}
        dashboardShell={dashboardShell}
      />
    </div>
  );
}
