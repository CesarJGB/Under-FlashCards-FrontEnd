import { Sparkles, BookOpen, Clock, Flame } from 'lucide-react';

export default function HomeSection({ user }) {
  // Obtener un saludo dinámico según la hora del día
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '¡Buenos días';
    if (hour < 19) return '¡Buenas tardes';
    return '¡Buenas noches';
  };

  return (
    <div className="animate-[fadeIn_0.2s_ease]" data-testid="home-section">
      {/* Tarjeta de Perfil de Usuario Premium */}
      <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        {/* Decoración geométrica sutil de fondo */}
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-slate-800 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <img
            src={user.picture}
            alt={user.name}
            referrerPolicy="no-referrer"
            className="w-16 h-16 rounded-2xl object-cover border-2 border-white/20 shadow-md bg-slate-800"
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-extrabold tracking-tight">
              {getGreeting()}, {user.name.split(' ')[0]}! 👋
            </h2>
            <p className="text-xs text-slate-400 truncate mt-0.5">{user.email}</p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs bg-white/10 px-3 py-1.5 rounded-xl font-medium border border-white/5 shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            Estudiante
          </span>
        </div>
      </div>

      {/* Tarjetas de Estadísticas Rápidas (Placeholders listos para repetición espaciada) */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 bg-slate-100 text-slate-800 rounded-xl flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Rendimiento</p>
            <p className="text-sm font-extrabold text-slate-900 mt-0.5">Listo</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 bg-slate-100 text-slate-800 rounded-xl flex items-center justify-center shrink-0">
            <Flame className="w-4 h-4 text-amber-500 fill-amber-500/20" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Racha actual</p>
            <p className="text-sm font-extrabold text-slate-900 mt-0.5">1 Día</p>
          </div>
        </div>
      </div>

      {/* Panel informativo inferior */}
      <div className="mt-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-1">¿Qué estudiar hoy?</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          Dirígete a la pestaña de **Archivos** en la barra inferior para abrir tu biblioteca, repasar tus mazos existentes o crear tarjetas en lote rápidamente.
        </p>
      </div>
    </div>
  );
}
