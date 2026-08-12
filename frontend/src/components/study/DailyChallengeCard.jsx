import { staticIllustrations } from '../../lib/staticIllustrations';

export default function DailyChallengeCard() {
  return (
    <section className="relative min-h-[172px] overflow-hidden rounded-[24px] bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 px-5 py-5 text-white shadow-[0_12px_28px_rgba(109,40,217,0.24)]">
      <div className="relative z-10 flex max-w-[58%] flex-col items-start">
        <p className="text-lg font-black leading-tight tracking-tight">Reto Diario</p>
        <p className="mt-1.5 text-xs font-semibold leading-relaxed text-violet-100">
          Completa el reto de hoy y pon a prueba lo aprendido.
        </p>

        {/* TODO: implementar lógica de reto diario */}
        <button
          type="button"
          onClick={() => {}}
          className="mt-4 cursor-pointer rounded-xl bg-white px-4 py-2.5 text-xs font-black text-violet-700 shadow-sm transition-all hover:bg-violet-50 active:scale-95"
        >
          Comenzar
        </button>
      </div>

      <img
        src={staticIllustrations.dailyChallenge}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-5 -right-3 h-[168px] w-[168px] object-contain drop-shadow-[0_10px_10px_rgba(49,10,101,0.24)] sm:right-1"
      />
    </section>
  );
}
