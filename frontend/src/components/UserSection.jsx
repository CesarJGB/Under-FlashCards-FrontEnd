import React from 'react';
import { ArrowLeft, KeyRound, LayoutPanelTop, LogOut } from 'lucide-react';

export default function UserSection({ user, onLogout, onOpenAiSettings, onOpenHomeSettings, onBackHome }) {
  const name = user?.name || user?.given_name || '';
  const email = user?.email || '';
  const picture = user?.picture || '';

  return (
    <div className="w-full">
      <div className="flex flex-col items-center justify-center h-full p-6">
        <button
          type="button"
          onClick={onBackHome}
          className="self-start mb-6 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al inicio
        </button>

        <h1 className="text-2xl font-bold text-slate-900 mb-6 text-center">Perfil</h1>

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

        <div className="w-full space-y-3">
          <button
            type="button"
            onClick={onOpenAiSettings}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <KeyRound className="w-4 h-4" /> API de IA y saldo
          </button>

          <button
            type="button"
            onClick={onOpenHomeSettings}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <LayoutPanelTop className="w-4 h-4" /> Ajustes del Home
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" /> Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
