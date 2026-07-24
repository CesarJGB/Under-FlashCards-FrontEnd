// FILE: frontend/src/components/library/calendar/CalendarFAB.jsx
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';

export default function CalendarFAB({ onClick, dashboardShell }) {
  const fabButton = (
    <button
      type="button"
      onClick={onClick}
      className="fixed right-6 w-14 h-14 rounded-[1.3rem] flex items-center justify-center z-50 cursor-pointer
      bg-white/10 dark:bg-white/5
      backdrop-blur-[3px] backdrop-saturate-100
      border border-white/50 dark:border-white/25
      ring-1 ring-inset ring-white/30 dark:ring-white/10
      shadow-[0_10px_30px_-6px_rgba(0,0,0,0.35),0_4px_10px_-2px_rgba(0,0,0,0.15),inset_0_1.5px_0.5px_0_rgba(255,255,255,0.9),inset_0_-1.5px_1px_-0.5px_rgba(0,0,0,0.18),inset_1px_0_1px_-0.5px_rgba(255,255,255,0.4),inset_-1px_0_1px_-0.5px_rgba(0,0,0,0.12)]
      hover:bg-white/15 dark:hover:bg-white/10 hover:scale-105 active:scale-95 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
      before:absolute before:inset-0 before:rounded-[1.3rem] before:pointer-events-none before:bg-[radial-gradient(80%_60%_at_50%_-5%,rgba(255,255,255,0.45)_0%,rgba(255,255,255,0.08)_35%,transparent_70%)] before:opacity-90
      after:absolute after:inset-[1px] after:rounded-[1.2rem] after:pointer-events-none after:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)] after:mix-blend-overlay"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 6rem)' }}
    >
      <Plus className="relative w-7 h-7 stroke-[3] text-slate-800 dark:text-white drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)] dark:drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
    </button>
  );

  return dashboardShell ? createPortal(fabButton, dashboardShell) : fabButton;
}
