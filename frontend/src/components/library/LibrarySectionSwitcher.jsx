// FILE: frontend/src/components/library/LibrarySectionSwitcher.jsx
export default function LibrarySectionSwitcher({ sectionMode, setSectionMode }) {
  const options = [
    { key: 'biblioteca', label: 'Biblioteca' },
    { key: 'general', label: 'General' }
  ];
  const activeIndex = options.findIndex((o) => o.key === sectionMode);

  return (
    <div className="relative flex w-full bg-slate-100 rounded-full p-1 select-none">
      {/* Thumb deslizante */}
      <div
        className="absolute top-1 bottom-1 rounded-full bg-white shadow-md shadow-slate-900/5 transition-transform duration-300 ease-out"
        style={{
          width: 'calc(50% - 4px)',
          left: '4px',
          transform: activeIndex === 1 ? 'translateX(calc(100% + 0px))' : 'translateX(0%)'
        }}
      />

      {options.map((opt) => {
        const isActive = opt.key === sectionMode;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => setSectionMode(opt.key)}
            className={`relative z-10 flex-1 py-2 text-sm font-semibold rounded-full transition-colors duration-200 cursor-pointer ${
              isActive ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
