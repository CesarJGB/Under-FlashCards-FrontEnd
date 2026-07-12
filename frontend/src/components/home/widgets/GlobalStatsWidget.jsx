import { BarChart3, GraduationCap, Layers3 } from 'lucide-react';
import HomeWidgetShell from './HomeWidgetShell';

export default function GlobalStatsWidget({ user, globalStats }) {
  return (
    <HomeWidgetShell
      title="Resumen global"
      description={`Hola, ${user?.name?.split(' ')[0] || 'Estudiante'}. Este snapshot vive dentro del carrusel.`}
      icon={BarChart3}
      footerNote="Widget base de métricas."
    >
      <div className="h-full grid grid-cols-2 gap-3">
        <div className="rounded-[28px] bg-gradient-to-br from-indigo-500 to-indigo-600 text-white p-5 flex flex-col justify-between">
          <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center">
            <Layers3 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-indigo-100">Tarjetas totales</p>
            <p className="text-3xl font-black mt-1">{globalStats.totalCards}</p>
          </div>
        </div>

        <div className="rounded-[28px] border border-zinc-200 bg-zinc-50 p-5 flex flex-col justify-between">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Dominio global</p>
            <p className="text-3xl font-black text-zinc-900 mt-1">{globalStats.globalMastery}%</p>
            <p className="text-xs text-zinc-500 mt-1">Promedio sobre materias activas.</p>
          </div>
        </div>
      </div>
    </HomeWidgetShell>
  );
}
