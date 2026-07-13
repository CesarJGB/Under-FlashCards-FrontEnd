export default function DailyChallengeCard() {
  return (
    <section className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-5 text-white shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-black tracking-tight">Reto Diario</p>
          <p className="mt-1 text-xs font-medium text-indigo-100">Completa el reto de hoy</p>
        </div>

        {/* TODO: implementar lógica de reto diario */}
        <button
          type="button"
          onClick={() => {}}
          className="rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-indigo-700 shadow-xs transition-transform hover:bg-indigo-50 active:scale-95 cursor-pointer"
        >
          Comenzar
        </button>
      </div>
    </section>
  );
}
