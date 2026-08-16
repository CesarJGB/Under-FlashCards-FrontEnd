import { useCallback, useEffect, useRef, useState } from 'react';
import image1 from '../../media/svg/pantalla de secion/slide-ai-flashcards.webp';
import image2 from '../../media/svg/pantalla de secion/slide-spaced-repetition.webp';
import image3 from '../../media/svg/pantalla de secion/slide-exams.webp';
import image4 from '../../media/svg/pantalla de secion/slide-semester.webp';
import {
  PUBLIC_HOME_AUTOPLAY_MS,
  canAutoplayPublicHome,
  getNextPublicHomeSlide,
  splitPublicHomeEmphasis,
} from './publicHomeCarousel';

export const PUBLIC_HOME_SLIDES = [
  {
    image: image1,
    title: 'Crea flashcards en segundos con IA.',
    titleEmphasis: 'en segundos con IA.',
    description: 'Convierte tus apuntes en material listo para estudiar.',
    descriptionEmphasis: 'tus apuntes',
    accentClass: 'text-violet-700 dark:text-violet-300',
    dotClass: 'bg-violet-600',
  },
  {
    image: image2,
    title: 'Estudia justo antes de olvidar.',
    titleEmphasis: 'antes de olvidar.',
    description: 'Usa repetición espaciada para recordar por más tiempo.',
    descriptionEmphasis: 'repetición espaciada',
    accentClass: 'text-blue-700 dark:text-blue-300',
    dotClass: 'bg-blue-600',
  },
  {
    image: image3,
    title: 'Practica como si ya fuera el examen.',
    titleEmphasis: 'como si ya fuera el examen.',
    description: 'Genera quizzes y exámenes para poner a prueba lo que sabes.',
    descriptionEmphasis: 'quizzes y exámenes',
    accentClass: 'text-orange-700 dark:text-orange-300',
    dotClass: 'bg-orange-600',
  },
  {
    image: image4,
    title: 'Todo tu semestre, bajo control.',
    titleEmphasis: 'bajo control.',
    description: 'Organiza clases, horarios, materias y sesiones de estudio en un solo lugar.',
    descriptionEmphasis: 'en un solo lugar',
    accentClass: 'text-emerald-700 dark:text-emerald-300',
    dotClass: 'bg-emerald-600',
  },
];

function HighlightedText({ text, emphasis, accentClass }) {
  return splitPublicHomeEmphasis(text, emphasis).map((segment) => (
    <span key={`${segment.text}-${segment.emphasized}`} className={segment.emphasized ? accentClass : undefined}>
      {segment.text}
    </span>
  ));
}

export default function PublicHomeCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [timerRevision, setTimerRevision] = useState(0);
  const [interacting, setInteracting] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(
    typeof document === 'undefined' || document.visibilityState === 'visible',
  );
  const [reducedMotion, setReducedMotion] = useState(false);
  const pointerStartRef = useRef(null);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReducedMotion(media.matches);
    updatePreference();
    media.addEventListener?.('change', updatePreference);
    return () => media.removeEventListener?.('change', updatePreference);
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => setDocumentVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (!canAutoplayPublicHome({ reducedMotion, documentVisible, interacting })) return undefined;
    const timeoutId = window.setTimeout(() => {
      setActiveIndex((current) => getNextPublicHomeSlide(current));
    }, PUBLIC_HOME_AUTOPLAY_MS);
    return () => window.clearTimeout(timeoutId);
  }, [activeIndex, documentVisible, interacting, reducedMotion, timerRevision]);

  const goToSlide = useCallback((index) => {
    setActiveIndex(index);
    setTimerRevision((revision) => revision + 1);
  }, []);

  const handlePointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointerStartRef.current = event.clientX;
    setInteracting(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const finishPointerInteraction = (event, cancelled = false) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    setInteracting(false);
    if (cancelled || start === null) return;
    const distance = event.clientX - start;
    if (Math.abs(distance) < 44) {
      setTimerRevision((revision) => revision + 1);
      return;
    }
    goToSlide(getNextPublicHomeSlide(activeIndex, distance < 0 ? 1 : -1));
  };

  return (
    <section
      aria-label="Descubre Under Flashcards"
      aria-roledescription="carrusel"
      className="flex h-full min-h-0 w-full max-w-3xl flex-col"
      onPointerDown={handlePointerDown}
      onPointerUp={(event) => finishPointerInteraction(event)}
      onPointerCancel={(event) => finishPointerInteraction(event, true)}
      onMouseEnter={() => setInteracting(true)}
      onMouseLeave={() => {
        pointerStartRef.current = null;
        setInteracting(false);
      }}
      style={{ touchAction: 'pan-y pinch-zoom' }}
    >
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {PUBLIC_HOME_SLIDES.map((slide, index) => {
          const active = index === activeIndex;
          return (
            <article
              key={slide.title}
              aria-hidden={!active}
              className={`absolute inset-0 grid min-h-0 grid-rows-[minmax(0,1fr)_auto] transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none ${
                active ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-5 opacity-0'
              }`}
            >
              <div className="flex min-h-0 items-center justify-center bg-transparent px-1 pt-1 sm:px-8">
                <img
                  src={slide.image}
                  alt=""
                  aria-hidden="true"
                  draggable="false"
                  className="h-full min-h-0 w-full select-none object-contain drop-shadow-[0_12px_18px_rgba(76,55,118,0.08)]"
                />
              </div>

              <div className="px-1 pb-0.5 pt-1 text-center sm:px-8 sm:pt-2">
                <h2 className="mx-auto max-w-2xl text-[clamp(1.9rem,7.5vw,2.75rem)] font-black leading-[1.04] tracking-[-0.04em] text-slate-900 [text-wrap:balance] dark:text-white lg:text-[3rem]">
                  <HighlightedText
                    text={slide.title}
                    emphasis={slide.titleEmphasis}
                    accentClass={slide.accentClass}
                  />
                </h2>
                <p className="mx-auto mt-[clamp(0.3rem,1.2dvh,0.65rem)] max-w-xl text-[clamp(1.05rem,4.2vw,1.35rem)] font-medium leading-[1.34] text-slate-600 [text-wrap:balance] dark:text-slate-300 lg:text-[1.4rem]">
                  <HighlightedText
                    text={slide.description}
                    emphasis={slide.descriptionEmphasis}
                    accentClass={`${slide.accentClass} font-extrabold`}
                  />
                </p>
              </div>
            </article>
          );
        })}
      </div>

      <div className="flex h-8 shrink-0 items-center justify-center gap-1.5" aria-label="Seleccionar slide">
        {PUBLIC_HOME_SLIDES.map((slide, index) => (
          <button
            key={slide.title}
            type="button"
            onClick={() => goToSlide(index)}
            aria-label={`Ir al slide ${index + 1} de 4`}
            aria-current={index === activeIndex ? 'true' : undefined}
            className="group flex h-8 items-center justify-center rounded-full px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-1"
          >
            <span
              className={`block h-2.5 rounded-full transition-[width,background-color] duration-300 motion-reduce:transition-none ${
                index === activeIndex
                  ? `w-8 ${slide.dotClass}`
                  : 'w-2.5 bg-slate-300 group-hover:bg-slate-400 dark:bg-slate-600'
              }`}
            />
          </button>
        ))}
      </div>
    </section>
  );
}
