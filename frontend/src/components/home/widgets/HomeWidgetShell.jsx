export default function HomeWidgetShell({
  title,
  description,
  icon: Icon,
  headerAction,
  children,
  currentPage = 0,
  totalPages = 1,
  onSelectPage,
  footerNote,
  bodyClassName = ''
}) {
  return (
    <div className="h-full flex flex-col p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {Icon && (
              <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4" />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-base font-bold text-zinc-900 truncate">{title}</h3>
              {description && (
                <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{description}</p>
              )}
            </div>
          </div>
        </div>

        {headerAction && <div className="shrink-0">{headerAction}</div>}
      </div>

      <div className={`mt-5 flex-1 min-h-0 ${bodyClassName}`.trim()}>
        {children}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 min-h-[20px]">
        <p className="text-[11px] text-zinc-400 leading-none truncate">{footerNote}</p>

        {totalPages > 1 && (
          <div className="flex items-center gap-1.5 shrink-0">
            {Array.from({ length: totalPages }, (_, index) => {
              const isActive = currentPage === index;

              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => onSelectPage?.(index)}
                  onPointerDown={(event) => event.stopPropagation()}
                  className={`rounded-full transition-all ${
                    isActive ? 'w-5 h-2 bg-indigo-500' : 'w-2 h-2 bg-zinc-200 hover:bg-zinc-300'
                  }`}
                  aria-label={`Ir a la página ${index + 1}`}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
