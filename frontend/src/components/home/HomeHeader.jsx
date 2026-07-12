// FILE: frontend/src/components/home/HomeHeader.jsx
import { useMemo } from 'react';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const initials = parts.slice(0, 2).map(p => p[0]?.toUpperCase() || '');
  return initials.join('') || '?';
}

export default function HomeHeader({ user, onOpenProfile }) {
  const greeting = useMemo(() => getGreeting(), []);
  const name = user?.name || user?.given_name || user?.email?.split('@')[0] || 'Usuario';
  const picture = user?.picture;

  return (
    <button
      type="button"
      onClick={onOpenProfile}
      className="w-full flex items-center gap-3 text-left group cursor-pointer"
    >
      <div className="w-14 h-14 rounded-full overflow-hidden shrink-0 bg-slate-200 flex items-center justify-center ring-1 ring-slate-200 group-active:scale-95 transition-transform">
        {picture ? (
          <img
            src={picture}
            alt={name}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="text-slate-500 font-semibold text-base">
            {getInitials(name)}
          </span>
        )}
      </div>

      <div className="min-w-0">
        <p className="text-sm text-slate-400 leading-tight">{greeting}!</p>
        <p className="text-lg font-bold text-slate-900 leading-tight truncate">
          {name}
        </p>
      </div>
    </button>
  );
}
