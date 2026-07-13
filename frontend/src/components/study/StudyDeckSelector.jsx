import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bookmark, ChevronRight, Folder, Loader2 } from 'lucide-react';
import DeckCard from '../DeckCard';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const ALL_PARTIALS = [1, 2, 3];

function getId(item) {
  return String(item?._id || item?.id || '');
}

function isSameId(left, right) {
  return String(left || '') === String(right || '');
}

function isEmptyId(value) {
  return value === null || value === undefined || value === '';
}

function getActiveParciales(materia) {
  return materia?.activeParciales?.length ? materia.activeParciales : ALL_PARTIALS;
}

function FolderCard({ title, detail, onClick, compact = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full text-left rounded-2xl border border-slate-200 bg-white shadow-3xs transition-all hover:border-indigo-200 hover:shadow-xs active:scale-[0.98] cursor-pointer ${
        compact ? 'h-28 p-3.5' : 'h-32 p-5'
      }`}
    >
      <span className="flex h-full flex-col justify-between">
        <span className="flex items-start justify-between gap-3">
          <span className={`flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 ${compact ? 'h-8 w-8 rounded-lg' : 'h-10 w-10'}`}>
            <Folder className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
          </span>
          <ChevronRight className="h-4 w-4 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-indigo-500" />
        </span>
        <span>
          <span className={`block font-bold tracking-tight text-slate-900 ${compact ? 'text-sm line-clamp-2' : 'text-base truncate'}`}>
            {title}
          </span>
          {detail && <span className="mt-1 block text-xs font-medium text-slate-400">{detail}</span>}
        </span>
      </span>
    </button>
  );
}

function DeckGrid({ decks, emptyMessage, onSelectDeck }) {
  if (decks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-xs font-medium text-slate-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 pb-12 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
      {decks.map((deck) => (
        <DeckCard
          key={deck.id}
          deck={deck}
          isList={false}
          readOnly
          onOpen={onSelectDeck}
        />
      ))}
    </div>
  );
}

export default function StudyDeckSelector({ decks, materias, modeLabel, onBack, onSelectDeck }) {
  const [currentPath, setCurrentPath] = useState({
    materiaId: null,
    parcialNumber: null,
    temaId: null,
    subtemaId: null,
  });
  const [showAllMaterias, setShowAllMaterias] = useState(false);
  const [temasByMateria, setTemasByMateria] = useState({});
  const [subtemasByTema, setSubtemasByTema] = useState({});
  const [academicLoading, setAcademicLoading] = useState(false);

  const selectedMateria = useMemo(
    () => materias.find((materia) => isSameId(getId(materia), currentPath.materiaId)),
    [materias, currentPath.materiaId]
  );
  const activeParciales = getActiveParciales(selectedMateria);
  const temas = temasByMateria[currentPath.materiaId] || [];
  const subtemas = subtemasByTema[currentPath.temaId] || [];
  const selectedTema = temas.find((tema) => isSameId(getId(tema), currentPath.temaId));
  const selectedSubtema = subtemas.find((subtema) => isSameId(getId(subtema), currentPath.subtemaId));

  useEffect(() => {
    if (!currentPath.materiaId || temasByMateria[currentPath.materiaId]) return;

    let cancelled = false;
    setAcademicLoading(true);

    fetch(`${BACKEND_URL}/api/academic/temas/${currentPath.materiaId}`)
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => {
        if (!cancelled) {
          setTemasByMateria((current) => ({ ...current, [currentPath.materiaId]: data }));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTemasByMateria((current) => ({ ...current, [currentPath.materiaId]: [] }));
        }
      })
      .finally(() => {
        if (!cancelled) setAcademicLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentPath.materiaId, temasByMateria]);

  useEffect(() => {
    if (!currentPath.temaId || subtemasByTema[currentPath.temaId]) return;

    let cancelled = false;
    setAcademicLoading(true);

    fetch(`${BACKEND_URL}/api/academic/subtemas/${currentPath.temaId}`)
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => {
        if (!cancelled) {
          setSubtemasByTema((current) => ({ ...current, [currentPath.temaId]: data }));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSubtemasByTema((current) => ({ ...current, [currentPath.temaId]: [] }));
        }
      })
      .finally(() => {
        if (!cancelled) setAcademicLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentPath.temaId, subtemasByTema]);

  const unclassifiedDecks = decks.filter((deck) => isEmptyId(deck.materiaId));
  const partialTemas = temas.filter((tema) => Number(tema.parcialNumber) === Number(currentPath.parcialNumber));
  const partialDecks = decks.filter((deck) => (
    isSameId(deck.materiaId, currentPath.materiaId)
    && Number(deck.parcialNumber) === Number(currentPath.parcialNumber)
    && isEmptyId(deck.temaId)
  ));
  const temaDecks = decks.filter((deck) => (
    isSameId(deck.temaId, currentPath.temaId) && isEmptyId(deck.subtemaId)
  ));
  const subtemaDecks = decks.filter((deck) => isSameId(deck.subtemaId, currentPath.subtemaId));

  const selectMateria = (materia) => {
    const active = getActiveParciales(materia);
    setCurrentPath({
      materiaId: getId(materia),
      parcialNumber: active.length === 1 ? active[0] : null,
      temaId: null,
      subtemaId: null,
    });
  };

  const handleBack = () => {
    if (currentPath.subtemaId) {
      setCurrentPath((path) => ({ ...path, subtemaId: null }));
      return;
    }

    if (currentPath.temaId) {
      setCurrentPath((path) => ({ ...path, temaId: null }));
      return;
    }

    if (currentPath.parcialNumber !== null && activeParciales.length > 1) {
      setCurrentPath((path) => ({ ...path, parcialNumber: null }));
      return;
    }

    if (currentPath.materiaId) {
      setCurrentPath({ materiaId: null, parcialNumber: null, temaId: null, subtemaId: null });
      return;
    }

    onBack();
  };

  const title = currentPath.subtemaId
    ? `Mazos de ${selectedSubtema?.name || 'este subtema'}`
    : currentPath.temaId
      ? selectedTema?.name || 'Mazos del tema'
      : currentPath.parcialNumber !== null
        ? `Temas del Parcial ${currentPath.parcialNumber}`
        : currentPath.materiaId
          ? selectedMateria?.name || 'Parciales'
          : 'Selecciona una materia para entrenar';

  const maxVisibleMaterias = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches ? 7 : 5;
  const visibleMaterias = showAllMaterias ? materias : materias.slice(0, maxVisibleMaterias);
  const overflowCount = Math.max(0, materias.length - maxVisibleMaterias);

  const renderHeader = () => (
    <div className="flex items-center gap-3 border-b border-slate-200/60 pb-4">
      <button
        type="button"
        onClick={handleBack}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-3xs transition-all hover:bg-slate-50 active:scale-95 cursor-pointer"
        title="Volver"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <div className="min-w-0">
        <span className="inline-block rounded-md bg-slate-900 px-2 py-0.5 text-xs font-extrabold uppercase tracking-wide text-white">
          {modeLabel}
        </span>
        <h2 className="mt-1 truncate text-lg font-bold text-slate-900">{title}</h2>
      </div>
    </div>
  );

  if (!currentPath.materiaId) {
    return (
      <div className="space-y-6 animate-[fadeIn_0.15s_ease]">
        {renderHeader()}

        {materias.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
            <Folder className="mx-auto mb-3 h-8 w-8 text-slate-400" />
            <p className="text-sm font-bold text-slate-800">No hay materias configuradas</p>
          </div>
        ) : (
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Tus materias ({materias.length})</h3>
              {!showAllMaterias && overflowCount > 0 && (
                <span className="text-[10px] font-medium text-slate-400">Mostrando {maxVisibleMaterias}</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
              {visibleMaterias.map((materia) => (
                <FolderCard
                  key={getId(materia)}
                  title={materia.name}
                  onClick={() => selectMateria(materia)}
                  compact
                />
              ))}
              {!showAllMaterias && overflowCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllMaterias(true)}
                  className="flex h-28 w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-300 bg-white text-slate-500 transition-all hover:bg-slate-50 active:scale-[0.98] cursor-pointer"
                >
                  <span className="text-2xl font-black text-slate-900">+{overflowCount}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider">Ver todas</span>
                </button>
              )}
            </div>

            {showAllMaterias && overflowCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAllMaterias(false)}
                className="mx-auto flex items-center gap-1.5 rounded-full bg-slate-100 px-5 py-2.5 text-xs font-bold text-slate-600 transition-all hover:bg-slate-200 active:scale-95 cursor-pointer"
              >
                Ver menos
              </button>
            )}
          </section>
        )}

        <section className="space-y-4 border-t border-slate-200/60 pt-6">
          <div className="flex items-center gap-1.5">
            <Bookmark className="h-3.5 w-3.5 text-slate-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Mazos sin clasificar</h3>
          </div>
          <DeckGrid
            decks={unclassifiedDecks}
            emptyMessage="Todos tus mazos están organizados en materias."
            onSelectDeck={onSelectDeck}
          />
        </section>
      </div>
    );
  }

  if (currentPath.parcialNumber === null) {
    return (
      <div className="space-y-6 animate-[fadeIn_0.15s_ease]">
        {renderHeader()}
        <div className={`grid gap-4 ${activeParciales.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
          {activeParciales.map((parcialNumber) => {
            const temasCount = temas.filter((tema) => Number(tema.parcialNumber) === Number(parcialNumber)).length;
            const parcialIndex = Number(parcialNumber);

            return (
              <FolderCard
                key={parcialNumber}
                title={`${parcialIndex === 1 ? 'Primer' : parcialIndex === 2 ? 'Segundo' : 'Tercer'} parcial`}
                detail={`${temasCount} tema${temasCount !== 1 ? 's' : ''}`}
                onClick={() => setCurrentPath((path) => ({ ...path, parcialNumber }))}
              />
            );
          })}
        </div>
      </div>
    );
  }

  if (currentPath.temaId === null) {
    return (
      <div className="space-y-6 animate-[fadeIn_0.15s_ease]">
        {renderHeader()}
        {academicLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-xs font-medium text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
            Cargando temas...
          </div>
        ) : (
          <>
            {partialTemas.length > 0 && (
              <section className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Temas</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                  {partialTemas.map((tema) => {
                    const count = decks.filter((deck) => isSameId(deck.temaId, getId(tema))).length;
                    return (
                      <FolderCard
                        key={getId(tema)}
                        title={tema.name}
                        detail={`${count} mazo${count !== 1 ? 's' : ''}`}
                        onClick={() => setCurrentPath((path) => ({ ...path, temaId: getId(tema) }))}
                      />
                    );
                  })}
                </div>
              </section>
            )}

            <section className={partialTemas.length > 0 ? 'space-y-4 border-t border-slate-200/60 pt-6' : 'space-y-4'}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Mazos generales del parcial</h3>
              <DeckGrid
                decks={partialDecks}
                emptyMessage={partialTemas.length === 0 ? 'No hay temas ni mazos en este parcial.' : 'No hay mazos generales en este parcial.'}
                onSelectDeck={onSelectDeck}
              />
            </section>
          </>
        )}
      </div>
    );
  }

  if (currentPath.subtemaId === null) {
    return (
      <div className="space-y-6 animate-[fadeIn_0.15s_ease]">
        {renderHeader()}
        {academicLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-xs font-medium text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
            Cargando subtemas...
          </div>
        ) : (
          <>
            <section className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Mazos del tema</h3>
              <DeckGrid decks={temaDecks} emptyMessage="No hay mazos directos en este tema." onSelectDeck={onSelectDeck} />
            </section>

            {subtemas.length > 0 && (
              <section className="space-y-4 border-t border-slate-200/60 pt-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Subtemas</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                  {subtemas.map((subtema) => {
                    const count = decks.filter((deck) => isSameId(deck.subtemaId, getId(subtema))).length;
                    return (
                      <FolderCard
                        key={getId(subtema)}
                        title={subtema.name}
                        detail={`${count} mazo${count !== 1 ? 's' : ''}`}
                        onClick={() => setCurrentPath((path) => ({ ...path, subtemaId: getId(subtema) }))}
                      />
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-[fadeIn_0.15s_ease]">
      {renderHeader()}
      <section className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Mazos del subtema</h3>
        <DeckGrid decks={subtemaDecks} emptyMessage="No hay mazos en este subtema." onSelectDeck={onSelectDeck} />
      </section>
    </div>
  );
}
