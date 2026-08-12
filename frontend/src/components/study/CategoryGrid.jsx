import { staticIllustrations } from '../../lib/staticIllustrations';

const categories = [
  {
    id: 'study-modes',
    title: 'Modos de Estudio',
    description: 'Elige cómo repasar',
    illustration: staticIllustrations.studyModes,
    visualClassName: 'bg-[#FFE477]',
  },
  {
    id: 'minigames',
    title: 'Minijuegos',
    description: 'Aprende jugando',
    illustration: staticIllustrations.minigames,
    visualClassName: 'bg-[#8EDAF2]',
  },
  {
    id: 'exams',
    title: 'Exámenes',
    description: 'Practica y evalúate',
    illustration: staticIllustrations.exams,
    visualClassName: 'bg-[#BDEB69]',
  },
  {
    id: 'features',
    title: 'Funcionalidades',
    description: 'Herramientas extra',
    illustration: staticIllustrations.features,
    visualClassName: 'bg-[#F3B7CB]',
  },
];

export default function CategoryGrid({ onSelectCategory }) {
  return (
    <section aria-labelledby="study-categories-title">
      <h2 id="study-categories-title" className="mb-3 text-lg font-black tracking-tight text-slate-900">
        Categorías
      </h2>

      <div className="grid grid-cols-2 gap-3.5">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelectCategory(category.id)}
            className="group min-h-[204px] cursor-pointer overflow-hidden rounded-[22px] border border-slate-200/90 bg-white text-left shadow-[0_8px_22px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(15,23,42,0.11)] active:translate-y-0 active:scale-[0.985]"
          >
            <span className={`flex h-[132px] items-center justify-center overflow-hidden ${category.visualClassName}`}>
              <img
                src={category.illustration}
                alt=""
                aria-hidden="true"
                className="h-[116px] w-[116px] object-contain transition-transform duration-200 group-hover:scale-[1.03]"
              />
            </span>

            <span className="flex min-h-[72px] flex-col items-center justify-center px-2.5 py-2 text-center">
              <span className="block text-[13px] font-black leading-tight tracking-tight text-slate-950 sm:text-sm">
                {category.title}
              </span>
              <span className="mt-1 block text-[11px] font-medium leading-tight text-slate-500">
                {category.description}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
