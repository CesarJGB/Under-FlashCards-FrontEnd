// ARCHIVO: frontend/src/components/HomeSection.jsx
import { Sparkles, BookOpen, Flame, Star, Folder } from 'lucide-react';

export default function HomeSection({ user, decks, materias = [], onOpenReview }) {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '¡Buenos días';
    if (hour < 19) return '¡Buenas tardes';
    return '¡Buenas noches';
  };

  // Filtramos la lista global de mazos para obtener solo los destacados
  const starredDecks = decks.filter((d) => d.isStarred);

  return (
    <div className="animate-[fadeIn_0.2s_ease]" data-testid="home-section">
      {/* Tarjeta de Perfil */}
      <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
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

      {/* 🌟 APARTADO DE MAZOS FAVORITOS (ACCESO DIRECTO A REPASO) */}
      <div className="mt-6">
        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5">
          <Star className="w-4 h-4 text-amber-500 fill-amber-500" /> Mazos Favoritos
        </h3>
        {starredDecks.length === 0 ? (
          <div className="text-center border border-dashed border-slate-300 rounded-2xl p-6 text-slate-400 text-xs">
            Aún no tienes mazos marcados como favoritos. Ve a la pestaña de Archivos y toca la estrella de tus carpetas preferidas.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {starredDecks.map((deck) => {
              const bgStyle = deck.coverImage
                ? { backgroundImage: `url(${deck.coverImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                : { backgroundColor: deck.coverColor };
              return (
                <button
                  key={deck.id}
                  onClick={() => onOpenReview(deck)}
                  style={bgStyle}
                  className="relative text-left h-24 rounded-2xl border border-slate-200 p-4 overflow-hidden shadow-sm hover:shadow-md active:scale-95 transition-all group flex flex-col justify-end"
                >
                  <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />
                  <div className="relative z-10 text-white min-w-0 w-full">
                    <p className="font-bold text-xs truncate drop-shadow-sm">{deck.title}</p>
                    <p className="text-[9px] text-white/85 font-medium mt-0.5 flex items-center gap-1">
                      <BookOpen className="w-3 h-3 text-amber-400" /> Repasar ahora
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 📚 NUEVO APARTADO: DISTRIBUCIÓN POR MATERIA */}
      <div className="mt-6">
        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5">
          <Folder className="w-4 h-4 text-slate-600" /> Distribución por Materia
        </h3>
        {materias.length === 0 ? (
          <div className="text-center border border-dashed border-slate-300 rounded-2xl p-6 text-slate-400 text-xs bg-white">
            Aún no hay materias dadas de alta. Ve a la pestaña de Archivos para configurar tus asignaturas universitarias.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {materias.map((m) => {
              const count = decks.filter(d => d.materiaId === m._id).length;
              return (
                <div key={m._id} className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm flex items-center justify-between group">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 truncate">{m.name}</p>
                    <p className="text-[10px] font-medium text-slate-400 mt-0.5">{count} {count === 1 ? 'mazo cargado' : 'mazos cargados'}</p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-indigo-500/20 group-hover:bg-indigo-500 transition-colors shrink-0 ml-2" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tarjetas de Estadísticas Rápidas */}
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
    </div>
  );
}
