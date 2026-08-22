import { forwardRef } from 'react';

const DashboardBottomDock = forwardRef(function DashboardBottomDock(
  { children, floatingHostRef },
  navigationRef,
) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] flex flex-col gap-4 md:contents"
      data-testid="dashboard-bottom-dock"
    >
      <div
        ref={floatingHostRef}
        className="relative z-50 h-14 w-full shrink-0 md:fixed md:inset-x-0 md:bottom-24"
        data-testid="dashboard-floating-controls-host"
      />

      <div
        ref={navigationRef}
        className="pointer-events-auto relative z-40 mx-auto flex h-[4.25rem] w-fit max-w-[calc(100%_-_1rem)] items-center gap-[clamp(0.375rem,2vw,0.5rem)] rounded-full border border-slate-200 bg-white px-[clamp(0.375rem,2vw,0.5rem)] shadow-[0_8px_32px_rgba(15,23,42,0.12)] backdrop-blur-xl animate-[slideUp_0.2s_ease-out] md:hidden"
        data-testid="dashboard-mobile-nav"
      >
        {children}
      </div>
    </div>
  );
});

export default DashboardBottomDock;
