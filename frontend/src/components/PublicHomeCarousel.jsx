import { useCallback, useEffect, useRef, useState } from 'react';
import image1 from '../../media/svg/pantalla de secion/Imagen 1.PNG?url';
import image2 from '../../media/svg/pantalla de secion/Imagen 2.PNG?url';
import image3 from '../../media/svg/pantalla de secion/Imagen 3.PNG?url';
import image4 from '../../media/svg/pantalla de secion/Imagen 4.PNG?url';
import {
  PUBLIC_HOME_AUTOPLAY_MS,
  canAutoplayPublicHome,
  getNextPublicHomeSlide,
} from './publicHomeCarousel';

export const PUBLIC_HOME_SLIDES = [
  {
    image: image1,
    title: 'Crea flashcards en segundos con IA.',
    description: 'Convierte tus apuntes en material listo para estudiar.',
    accent: 'bg-[#F0E9FF]',
  },
  {
    image: image2,
    title: 'Estudia justo antes de olvidar.',
    description: 'Usa repetición espaciada para recordar por más tiempo.',
    accent: 'bg-[#FFF5CE]',
  },
  {
    image: image3,
    title: 'Practica como si ya fuera el examen.',
    description: 'Genera quizzes y exámenes para poner a prueba lo que sabes.',
    accent: 'bg-[#E3F3FF]',
  },
  {
    image: image4,
    title: 'Todo tu semestre, bajo control.',
    description: 'Organiza clases, horarios, materias y sesiones de estudio en un solo lugar.',
    accent: 'bg-[#E8F7E9]',
  },
];

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
      className="w-full max-w-2xl"
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
      <div className="relative h-[clamp(20rem,55dvh,35rem)] overflow-hidden sm:h-[34rem]">
        {PUBLIC_HOME_SLIDES.map((slide, index) => {
          const active = index === activeIndex;
          return (
            <article
              key={slide.title}
              aria-hidden={!active}
              className={`absolute inset-0 grid grid-rows-[minmax(0,1fr)_auto] transition-all duration-500 ease-out motion-reduce:transition-none ${
                active ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-4 opacity-0'
              }`}
            >
              <div className={`mx-auto flex h-full w-full items-center justify-center overflow-hidden rounded-[2rem] ${slide.accent}`}>
                <img
                  src={slide.image}
                  alt=""
                  aria-hidden="true"
                  draggable="false"
                  className="h-full w-full select-none object-contain p-2 sm:p-4"
                />
              </div>
              <div className="min-h-[8.75rem] px-2 pt-5 text-center sm:px-8 sm:pt-6">
                <h2 className="text-[clamp(1.35rem,6vw,2rem)] font-extrabold leading-tight tracking-[-0.025em] text-slate-900 dark:text-white">
                  {slide.title}
                </h2>
                <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-slate-600 dark:text-slate-300 sm:text-base">
                  {slide.description}
                </p>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-2 flex min-h-11 items-center justify-center gap-2" aria-label="Seleccionar slide">
        {PUBLIC_HOME_SLIDES.map((slide, index) => (
          <button
            key={slide.title}
            type="button"
            onClick={() => goToSlide(index)}
            aria-label={`Ir al slide ${index + 1} de 4`}
            aria-current={index === activeIndex ? 'true' : undefined}
            className="group flex h-11 items-center justify-center rounded-full px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2"
          >
            <span
              className={`block h-2.5 rounded-full transition-[width,background-color] duration-300 motion-reduce:transition-none ${
                index === activeIndex
                  ? 'w-8 bg-violet-600'
                  : 'w-2.5 bg-violet-200 group-hover:bg-violet-300 dark:bg-violet-700'
              }`}
            />
          </button>
        ))}
      </div>
    </section>
  );
}
