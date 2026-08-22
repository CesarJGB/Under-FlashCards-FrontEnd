import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import DashboardBottomDock from '../../src/components/layout/DashboardBottomDock';
import '../../src/index.css';

function Harness() {
  const [floatingHost, setFloatingHost] = useState(null);

  return (
    <main className="fixed inset-0 overflow-hidden bg-slate-50" data-testid="dashboard-shell">
      <DashboardBottomDock floatingHostRef={setFloatingHost}>
        {['Inicio', 'Estudio', 'Biblioteca', 'General'].map((label) => (
          <button key={label} type="button" className="h-[3.25rem] min-w-12 rounded-full bg-slate-100 px-2 text-xs">
            {label}
          </button>
        ))}
      </DashboardBottomDock>

      {floatingHost && createPortal(
        <button
          type="button"
          className="pointer-events-auto absolute top-0 right-6 h-14 w-14 rounded-2xl bg-slate-900 text-white"
          data-testid="floating-control"
        >
          +
        </button>,
        floatingHost,
      )}
    </main>
  );
}

createRoot(document.getElementById('root')).render(<Harness />);
