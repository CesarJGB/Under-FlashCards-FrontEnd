import React from 'react';
import { LogOut, Settings } from 'lucide-react';

export default function UserSection({ user, onLogout, onOpenSettings }) {
  const name = user?.name || user?.given_name || '';
  const email = user?.email || '';
  const picture = user?.picture || '';

  return (
    <div className="relative w-full">
      {/* Settings button visible on desktop inside the User page */}
      {onOpenSettings && (
        <div className="hidden md:block absolute top-4 right-4">
          <button
            type="button"
            onClick={onOpenSettings}
            title="Ajustes"
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col items-center justify-center h-full p-6">
      {picture ? (
        <img
          src={picture}
          alt={name || email}
          referrerPolicy="no-referrer"
          className="w-16 h-16 rounded-full object-cover mb-6 bg-slate-200"
        />
      ) : (
        <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center mb-6">
          <span className="text-2xl font-bold text-slate-800">{(name && name[0]) || 'U'}</span>
        </div>
      )}

      <h2 className="text-xl font-bold text-slate-900 mb-1 text-center">{name || 'Perfil de Usuario'}</h2>
      <p className="text-sm text-slate-600 mb-6 text-center">{email}</p>

      <button
        onClick={onLogout}
        className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        <LogOut className="w-4 h-4" /> Cerrar sesión
      </button>
      </div>
    </div>
  );
}
