import { ClipboardCheck, Gamepad2, Layers, Wrench } from 'lucide-react';

const categories = [
  {
    id: 'study-modes',
    title: 'Modos de Estudio',
    icon: Layers,
    color: 'from-emerald-500 to-teal-600',
  },
  {
    id: 'minigames',
    title: 'Minijuegos',
    icon: Gamepad2,
    color: 'from-pink-500 to-rose-600',
  },
  {
    id: 'exams',
    title: 'Exámenes',
    icon: ClipboardCheck,
    color: 'from-violet-500 to-purple-600',
  },
  {
    id: 'features',
    title: 'Funcionalidades',
    icon: Wrench,
    color: 'from-cyan-500 to-blue-600',
  },
];

export default function CategoryGrid({ onSelectCategory }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {categories.map((category) => {
        const Icon = category.icon;

        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelectCategory(category.id)}
            className="aspect-square rounded-2xl border border-slate-200 bg-white p-4 shadow-3xs transition-all duration-200 hover:border-slate-300 hover:shadow-xs active:scale-[0.99] cursor-pointer"
          >
            <span className={`mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${category.color} text-white shadow-xs`}>
              <Icon className="h-6 w-6" />
            </span>
            <span className="mt-3 block text-center text-sm font-bold tracking-tight text-slate-900">
              {category.title}
            </span>
          </button>
        );
      })}
    </div>
  );
}
