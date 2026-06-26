// ARCHIVO: frontend/src/components/HomeSection.jsx
import { useMemo } from 'react';
import { BookOpen, Folder, Star, GraduationCap, Clock } from 'lucide-react';

export default function HomeSection({ user, decks, materias, onOpenReview }) {
  
  // Filtrar mazos marcados como favoritos para acceso instantáneo
  const starredDecks = useMemo(() => {
    return decks.filter(d => d.isStarred);
  }, [decks]);

  // Obtener los últimos 3 mazos creados o estudiados para la sección de "Continuar leyendo"
  const recentDecks = useMemo(() => {
    return [...decks].slice(0, 3);
  }, [decks]);

  return (
    <div className="space-y-8 animate-[fadeIn_0.12s_ease]" data-testid="home-section">
      
      {/* 🌟 GREETING HEADER */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-black uppercase tracking-widest text-indigo-400">Panel de Control</span>
          <h2 className="text-xl font-black mt-1">¡Hola de nuevo, {user.name}!</h2>
          <p className="text-xs text-slate-400 font-medium mt-1 leading-relaxed">
            Listo para preparar tus exámenes. Tienes <span className="text-white font-bold">{decks.length} mazos</span> en tu biblioteca local.
          </p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center shrink-0 self-start sm:self-center">
          <GraduationCap className="w-6 h-6 text-indigo-300" />
        </div>
      </div>

      {/* 📚 SECCIÓN: RESUMEN DE ASIGNATURAS UNIVERSITARIAS */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Folder className="w-3.5 h-3.5" /> Distribución por Materia
        </h3>
        {materias.length === 0 ? (
          <div className="text-left bg-white border border-slate-200 p-4 rounded-xl text-xs text-slate-400 font-medium italic">
            Aún no hay materias dadas de alta. Ve a la sección de "Archivos" para configurar tus asignaturas académicas.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {materias.map((m) => {
              const count = decks.filter(d => d.materiaId === m._id).length;
              return (
                <div key={m._id} className="bg-white border border-slate-200 p-4 rounded-xl shadow-3xs flex items-center justify-between group">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{m.name}</p>
                    <p className="text-[10px] font-medium text-slate-400 mt-0.5">{count} {count === 1 ? 'mazo cargado' : 'mazos cargados'}</p>
                  </div>
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-500/20 group-hover:bg-indigo-500 transition-colors shrink-0 ml-2" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ⭐ ACCESOS RÁPIDOS: FAVORITOS Y RECIENTES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Columna Izquierda: Favoritos */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> Mazos Destacados
          </h3>
          {starredDecks.length === 0 ? (
            <div className="text-center border border-dashed border-slate-200 bg-white rounded-xl py-8 text-xs text-slate-400 font-medium">
              Marca estrellas en tus mazos core para verlos aquí.
            </div>
          ) : (
            <div className="space-y-2">
              {starredDecks.map(deck => (
                <div 
                  key={deck.id} 
                  onClick={() => onOpenReview(deck)}
                  className="bg-white border border-slate-200/80 p-3 rounded-xl hover:border-slate-400 transition-all cursor-pointer flex items-center justify-between active:scale-[0.99]"
                >
                  <span className="text-xs font-bold text-slate-700 truncate max-w-[80%]">{deck.title}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md shrink-0">Repasar</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Columna Derecha: Actividad Reciente */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Última Actividad
          </h3>
          {recentDecks.length === 0 ? (
            <div className="text-center border border-dashed border-slate-200 bg-white rounded-xl py-8 text-xs text-slate-400 font-medium">
              No hay actividad reciente registrada.
            </div>
          ) : (
            <div className="space-y-2">
              {recentDecks.map(deck => (
                <div 
                  key={deck.id} 
                  onClick={() => onOpenReview(deck)}
                  className="bg-white border border-slate-200/80 p-3 rounded-xl hover:border-slate-400 transition-all cursor-pointer flex items-center justify-between active:scale-[0.99]"
                >
                  <span className="text-xs font-bold text-slate-700 truncate max-w-[80%]">{deck.title}</span>
                  <span className="text-[10px] font-bold text-slate-400 shrink-0 flex items-center gap-1">
                    <BookOpen className="w-3 h-3" /> {deck.cardCount ?? 0} q&a
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
