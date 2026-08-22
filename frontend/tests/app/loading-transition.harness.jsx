import React, { useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { AppLoadingScreen } from '../../src/App.jsx';
import '../../src/index.css';

function DashboardProbe({ clickCount, onAction }) {
  const mountIdRef = useRef(`dashboard-${Math.random().toString(36).slice(2)}`);

  return (
    <main
      className="fixed inset-0 flex min-h-0 flex-col bg-slate-50 text-slate-950"
      data-dashboard-mount-id={mountIdRef.current}
      data-testid="dashboard-screen"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-8 sm:px-8">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-violet-600">Inicio</p>
        <h1 className="mt-3 text-3xl font-black">Tu espacio de estudio</h1>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <p className="font-extrabold">Repaso de hoy</p>
            <p className="mt-2 text-slate-600">12 tarjetas preparadas</p>
          </section>
          <section className="rounded-3xl bg-violet-100 p-6 ring-1 ring-violet-200">
            <p className="font-extrabold">Racha actual</p>
            <p className="mt-2 text-violet-800">7 días aprendiendo</p>
          </section>
        </div>
        <button
          type="button"
          className="mt-auto min-h-12 rounded-2xl bg-slate-950 px-5 font-extrabold text-white"
          data-testid="dashboard-action"
          onClick={onAction}
        >
          Abrir Home
        </button>
        <output className="mt-2 text-center text-sm" data-testid="dashboard-click-count">
          {clickCount}
        </output>
      </div>
    </main>
  );
}

function LoadingTransitionHarness() {
  const [isLoading, setIsLoading] = useState(true);
  const [clickCount, setClickCount] = useState(0);
  const [completeCount, setCompleteCount] = useState(0);

  const handleComplete = () => {
    setCompleteCount((count) => count + 1);
    setIsLoading(false);
  };

  return (
    <>
      <DashboardProbe
        clickCount={clickCount}
        onAction={() => setClickCount((count) => count + 1)}
      />
      {isLoading && (
        <AppLoadingScreen
          onComplete={handleComplete}
          videoSource={null}
        />
      )}
      <button
        type="button"
        className="sr-only"
        data-testid="unmount-app-loading"
        onClick={() => setIsLoading(false)}
      >
        Desmontar loading
      </button>
      <output className="sr-only" data-testid="loading-complete-count">
        {completeCount}
      </output>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<LoadingTransitionHarness />);
