import { BookOpenText } from 'lucide-react';
import HomeWidgetShell from './HomeWidgetShell';

function navigateToMateria(materia, onNavigateToLibrary) {
  onNavigateToLibrary?.({
    materiaId: materia.id,
    parcialNumber: null,
    temaId: null,
    subtemaId: null
  });
}

export default function MateriasSummaryWidget({ enrichedMaterias, getKnowledgeAccent, onNavigateToLibrary }) {
  const activeMaterias = enrichedMaterias.filter((materia) => materia.decksCount > 0);
  const featuredMaterias = [...activeMaterias]
    .sort((left, right) => right.totalCards - left.totalCards)
    .slice(0, 4);

  return (
    <HomeWidgetShell
      title="Mapa de materias"
      description="Un vistazo rápido a las materias con más movimiento."
      icon={BookOpenText}
      footerNote={`${activeMaterias.length} materias activas en tu mapa.`}
    >
      {featuredMaterias.length === 0 ? (
        <div className="h-full rounded-[28px] border border-dashed border-zinc-200 bg-zinc-50/70 flex items-center justify-center px-6 text-center">
          <p className="text-sm font-medium text-zinc-500">Todavía no hay materias con mazos para resumir.</p>
        </div>
      ) : (
        <div className="h-full grid grid-cols-1 sm:grid-cols-2 gap-3">
          {featuredMaterias.map((materia) => {
            const accent = getKnowledgeAccent(materia.masteryPercentage);

            return (
              <button
                key={materia.id}
                type="button"
                onClick={() => navigateToMateria(materia, onNavigateToLibrary)}
                className="rounded-[24px] border border-zinc-200 bg-white p-4 text-left hover:border-indigo-200 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-bold text-zinc-900 line-clamp-2">{materia.title}</p>
                  <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${accent.badge}`}>
                    {materia.masteryPercentage}%
                  </span>
                </div>

                <div className="w-full h-2 rounded-full bg-zinc-100 overflow-hidden mt-3">
                  <div
                    className={`h-full rounded-full ${accent.bar}`}
                    style={{ width: `${materia.masteryPercentage}%` }}
                  />
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
                  <span>{materia.decksCount} mazos</span>
                  <span>{materia.totalCards} tarjetas</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </HomeWidgetShell>
  );
}
