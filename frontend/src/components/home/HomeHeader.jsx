// FILE: frontend/src/components/home/HomeHeader.jsx
import { useMemo } from 'react';
import { Bell, Settings } from 'lucide-react';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function getDisplayName(fullName) {
  if (!fullName) return 'Usuario';
  const parts = fullName.trim().split(/\s+/);
  return parts.slice(0, 2).join(' ');
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const initials = parts.slice(0, 2).map(p => p[0]?.toUpperCase() || '');
  return initials.join('') || '?';
}

// Nota: el ícono de engranaje abre el perfil (onOpenProfile), no una pantalla de
// ajustes independiente — decisión explícita de Cesar. onOpenNotifications es
// opcional y aún no está cableado a ninguna funcionalidad (placeholder visual).
export default function HomeHeader({ user, onOpenProfile, onOpenNotifications }) {
  const greeting = useMemo(() => getGreeting(), []);
  const rawName = user?.name || user?.given_name || user?.email?.split('@')[0] || 'Usuario';
  const name = getDisplayName(rawName);
  const picture = user?.picture;

  return (
    <div className="w-full flex items-center gap-3">
      <div className="w-11 h-11 rounded-full overflow-hidden shrink-0 bg-slate-200 flex items-center justify-center ring-1 ring-slate-200">
        {picture ? (
          <img
            src={picture}
            alt={name}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="text-slate-500 font-semibold text-sm">
            {getInitials(name)}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-400 leading-tight truncate">{greeting}!</p>
        <p className="text-base font-bold text-slate-900 leading-tight truncate">
          {name}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onOpenNotifications}
          title="Notificaciones"
          className="w-11 h-11 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
        >
          <Bell className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={onOpenProfile}
          title="Perfil"
          className="w-11 h-11 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
